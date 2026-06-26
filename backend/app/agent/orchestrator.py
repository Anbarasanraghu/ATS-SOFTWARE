"""
Agent orchestration loop.

Implements the workflow from the architecture guide:
  understand → select tool → validate permissions → execute → summarize.

The LLM (Gemini) only chooses tools and arguments. This module executes the
chosen tool against the tenant-scoped DB session, writes an audit row for every
call, feeds the result back to the model, and repeats until the model produces a
final natural-language answer. Destructive tools are never auto-run — the loop
returns ``needs_confirmation`` so the UI can ask the human first.
"""
from __future__ import annotations

import json
import time
from datetime import date

from sqlalchemy import text

from app.agent import tools as _tools  # noqa: F401 — importing registers all tools
from app.agent.gemini import generate, split_parts
from app.agent.registry import REGISTRY, ToolSpec
from app.core.config import settings


def _system_prompt(user) -> str:
    name = getattr(user, "full_name", None) or getattr(user, "email", "the user")
    role = getattr(user, "role", "member")
    return (
        "You are the ATS Assistant, an AI agent embedded in the ATS ERP system. "
        f"You are helping {name} (role: {role}). Today is {date.today().isoformat()}.\n\n"
        "Rules:\n"
        "- Answer business questions by calling the provided tools. Never invent "
        "numbers, customers, products or invoices — if you don't have a tool for "
        "something, say so plainly.\n"
        "- You may call several tools to answer one question. After gathering data, "
        "give a concise, well-formatted answer (use short lists/tables, show "
        "currency with thousands separators).\n"
        "- Tools that create or change data require the user's confirmation, which "
        "the application handles for you — just call the tool when the user asks.\n"
        "- If a tool returns an error or empty result, explain it briefly instead of "
        "guessing.\n"
        "- Be direct and professional. Keep answers short unless detail is requested."
    )


def _history_to_contents(history: list[dict]) -> list[dict]:
    """Prior saved messages → Gemini contents (text only)."""
    contents: list[dict] = []
    for m in history:
        if not m.get("content"):
            continue
        role = "model" if m["role"] == "assistant" else "user"
        contents.append({"role": role, "parts": [{"text": m["content"]}]})
    return contents


def _filter_args(spec: ToolSpec, args: dict) -> dict:
    props = (spec.parameters or {}).get("properties", {})
    return {k: v for k, v in (args or {}).items() if k in props}


async def _audit(ctx, conversation_id, tool_name, args, status, error, duration_ms):
    await ctx["session"].execute(text("""
        insert into agent_tool_calls
          (tenant_id, conversation_id, user_id, tool_name, arguments, status, error, duration_ms)
        values
          (current_tenant_id(), :cid, :uid, :name, cast(:args as jsonb), :status, :err, :dur)
    """), {
        "cid": str(conversation_id) if conversation_id else None,
        "uid": str(ctx["user"].id),
        "name": tool_name,
        "args": json.dumps(args or {}),
        "status": status,
        "err": error,
        "dur": duration_ms,
    })


async def _execute(ctx, conversation_id, spec: ToolSpec, args: dict) -> tuple[dict, str]:
    """Run one tool inside a SAVEPOINT (so a failure can't poison the outer
    transaction) and audit the outcome. Returns (result, status)."""
    session = ctx["session"]
    filtered = _filter_args(spec, args)
    start = time.perf_counter()
    try:
        async with session.begin_nested():
            result = await spec.handler(ctx, **filtered)
        status, error = "ok", None
    except Exception as exc:  # tool-level failure — keep the conversation alive
        result, status, error = {"error": str(exc)}, "error", str(exc)
    duration_ms = int((time.perf_counter() - start) * 1000)
    await _audit(ctx, conversation_id, spec.name, filtered, status, error, duration_ms)
    return result, status


def _summary(args: dict) -> str:
    parts = [f"{k}={v}" for k, v in (args or {}).items()]
    return ", ".join(parts)


async def run_turn(ctx, conversation_id, history: list[dict], user_message: str | None,
                   confirm_action: dict | None = None) -> dict:
    """Drive one assistant turn.

    Returns one of:
      {"status": "completed", "text": str, "tool_calls": [...]}
      {"status": "needs_confirmation", "pending_action": {...}, "tool_calls": [...]}
    """
    user = ctx["user"]
    available = REGISTRY.available_for(user)
    declarations = [t.to_gemini_declaration() for t in available]
    allowed_names = {t.name for t in available}

    contents = _history_to_contents(history)
    executed: list[dict] = []  # for persisting a summary on the assistant message

    # ── Confirmation path: user approved a destructive action ──────────────
    if confirm_action:
        spec = REGISTRY.get(confirm_action.get("tool", ""))
        if not spec or not spec.allowed_for(user):
            await _audit(ctx, conversation_id, confirm_action.get("tool", "?"),
                         confirm_action.get("args"), "denied", "not permitted", 0)
            return {"status": "completed",
                    "text": "Sorry, you're not allowed to run that action.",
                    "tool_calls": []}
        args = confirm_action.get("args") or {}
        result, status = await _execute(ctx, conversation_id, spec, args)
        executed.append({"name": spec.name, "args": _filter_args(spec, args), "status": status})
        # Seed the model with the call + its result so it can summarize.
        contents.append({"role": "model", "parts": [{"functionCall": {"name": spec.name, "args": args}}]})
        contents.append({"role": "user", "parts": [{"functionResponse": {"name": spec.name, "response": result}}]})
    elif user_message:
        contents.append({"role": "user", "parts": [{"text": user_message}]})

    system = _system_prompt(user)

    # ── Tool-calling loop ──────────────────────────────────────────────────
    for _ in range(max(1, settings.agent_max_tool_loops)):
        content = await generate(system_instruction=system, contents=contents, tools=declarations)
        answer, calls = split_parts(content)

        if not calls:
            return {"status": "completed", "text": answer or "(no response)", "tool_calls": executed}

        # Echo the model's function-call turn back into the running context.
        contents.append(content)

        responses = []
        for call in calls:
            name, args = call["name"], call["args"]
            spec = REGISTRY.get(name)

            if not spec or name not in allowed_names:
                await _audit(ctx, conversation_id, name or "?", args, "denied",
                             "unknown or not permitted", 0)
                responses.append({"functionResponse": {"name": name or "unknown",
                                  "response": {"error": "Tool not available to you."}}})
                continue

            # Destructive → stop and ask the human to confirm.
            if spec.destructive:
                return {
                    "status": "needs_confirmation",
                    "pending_action": {
                        "tool": spec.name,
                        "args": _filter_args(spec, args),
                        "summary": f"{spec.name}({_summary(_filter_args(spec, args))})",
                        "description": spec.description,
                    },
                    "preamble": answer,
                    "tool_calls": executed,
                }

            result, status = await _execute(ctx, conversation_id, spec, args)
            executed.append({"name": name, "args": _filter_args(spec, args), "status": status})
            responses.append({"functionResponse": {"name": name, "response": result}})

        contents.append({"role": "user", "parts": responses})

    # Hit the loop cap without a final answer.
    return {
        "status": "completed",
        "text": "I gathered the data but couldn't finish summarizing it — please try rephrasing.",
        "tool_calls": executed,
    }
