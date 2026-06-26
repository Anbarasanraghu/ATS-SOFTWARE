"""
AI Agent API.

  POST /agent/chat                       — send a message, get a reply (drives the
                                           tool-calling loop; may return a pending
                                           action that needs confirmation)
  GET  /agent/tools                      — tools available to the current user
  GET  /agent/conversations              — recent conversations
  GET  /agent/conversations/{id}/messages — full transcript of one conversation
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text

from app.agent.gemini import GeminiError
from app.agent.orchestrator import run_turn
from app.agent.registry import REGISTRY
from app.agent.schemas import (
    ChatRequest, ChatResponse, ConversationOut, MessageOut, PendingAction,
    ToolCallOut, ToolInfo,
)
from app.auth.deps import get_request_context

router = APIRouter()

_HISTORY_LIMIT = 20  # messages of context fed to the model


@router.get("/tools", response_model=list[ToolInfo])
async def list_tools(ctx=Depends(get_request_context)):
    return [
        ToolInfo(name=t.name, description=t.description, category=t.category,
                 destructive=t.destructive)
        for t in REGISTRY.available_for(ctx["user"])
    ]


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(ctx=Depends(get_request_context)):
    rows = await ctx["session"].execute(text("""
        select id, title, to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS') as updated_at
        from agent_conversations order by updated_at desc limit 50
    """))
    return [ConversationOut(id=str(r.id), title=r.title, updated_at=r.updated_at) for r in rows]


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut])
async def conversation_messages(conversation_id: str, ctx=Depends(get_request_context)):
    rows = await ctx["session"].execute(text("""
        select role, content, tool_calls,
               to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS') as created_at
        from agent_messages where conversation_id = :cid order by created_at
    """), {"cid": conversation_id})
    return [
        MessageOut(role=r.role, content=r.content,
                   tool_calls=r.tool_calls or [], created_at=r.created_at)
        for r in rows
    ]


async def _load_history(session, conversation_id: str) -> list[dict]:
    rows = await session.execute(text("""
        select role, content, tool_calls from agent_messages
        where conversation_id = :cid order by created_at desc limit :lim
    """), {"cid": conversation_id, "lim": _HISTORY_LIMIT})
    history = [dict(r._mapping) for r in rows]
    history.reverse()
    return history


async def _save_message(session, conversation_id, role, content, tool_calls):
    await session.execute(text("""
        insert into agent_messages (tenant_id, conversation_id, role, content, tool_calls)
        values (current_tenant_id(), :cid, :role, :content, cast(:tc as jsonb))
    """), {"cid": conversation_id, "role": role, "content": content,
           "tc": json.dumps(tool_calls or [])})
    await session.execute(text(
        "update agent_conversations set updated_at = now() where id = :cid"),
        {"cid": conversation_id})


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]

    if not body.message and not body.confirm_action:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Provide a message or a confirm_action.")

    # ── Resolve / create the conversation ──────────────────────────────────
    conversation_id = body.conversation_id
    if conversation_id:
        exists = (await session.execute(text(
            "select 1 from agent_conversations where id = :cid"),
            {"cid": conversation_id})).first()
        if not exists:
            conversation_id = None
    if not conversation_id:
        title = (body.message or "New conversation")[:60]
        row = (await session.execute(text("""
            insert into agent_conversations (tenant_id, user_id, title)
            values (current_tenant_id(), :uid, :title) returning id
        """), {"uid": str(user.id), "title": title})).first()
        conversation_id = str(row.id)

    # History BEFORE this turn's new user message (orchestrator appends it).
    history = await _load_history(session, conversation_id)

    # A plain message is a user utterance and is persisted; a confirm click is not.
    if body.message and not body.confirm_action:
        await _save_message(session, conversation_id, "user", body.message, [])

    confirm = body.confirm_action.model_dump() if body.confirm_action else None
    try:
        result = await run_turn(ctx, conversation_id, history, body.message, confirm)
    except GeminiError as exc:
        # Surface LLM/config problems as themselves — not as a generic 503 from the
        # request-context dependency's catch-all DB handler.
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc

    tool_calls = [ToolCallOut(**tc) for tc in result.get("tool_calls", [])]

    if result["status"] == "needs_confirmation":
        # Don't persist an assistant message yet — we're waiting on the human.
        return ChatResponse(
            conversation_id=conversation_id,
            status="needs_confirmation",
            reply=result.get("preamble") or "",
            pending_action=PendingAction(**result["pending_action"]),
            tool_calls=tool_calls,
        )

    reply = result["text"]
    await _save_message(session, conversation_id, "assistant", reply,
                        [tc.model_dump() for tc in tool_calls])
    return ChatResponse(
        conversation_id=conversation_id,
        status="completed",
        reply=reply,
        tool_calls=tool_calls,
    )
