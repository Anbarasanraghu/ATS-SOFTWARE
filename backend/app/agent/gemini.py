"""
Thin async client for the Google Gemini ``generateContent`` REST API with
function calling. We use REST (httpx) rather than a heavy SDK so the only new
dependency is httpx.

Auth: standard Google AI Studio keys look like ``AIzaSy...`` and go in the
``?key=`` query param. Some Google credentials are OAuth access tokens instead
(they don't start with "AIza"); those go in an ``Authorization: Bearer`` header.
``gemini_auth_mode=auto`` picks the right one; override via .env if needed.
"""
from __future__ import annotations

import asyncio
from typing import Any

import httpx

from app.core.config import settings

_BASE = "https://generativelanguage.googleapis.com/v1beta"
# Transient server-side errors worth retrying (overloaded / hiccup / timeout).
_TRANSIENT = {500, 502, 503, 504}


class GeminiError(RuntimeError):
    pass


def _auth(url: str) -> tuple[str, dict]:
    key = settings.gemini_api_key
    mode = (settings.gemini_auth_mode or "auto").lower()
    if mode == "auto":
        mode = "key" if key.startswith("AIza") else "bearer"
    if mode == "bearer":
        return url, {"Authorization": f"Bearer {key}"}
    # default: query-param key
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}key={key}", {}


async def generate(
    *,
    system_instruction: str,
    contents: list[dict],
    tools: list[dict] | None = None,
) -> dict:
    """One ``generateContent`` round-trip. Returns the first candidate's
    ``content`` ({"role": "model", "parts": [...]}). Raises GeminiError on
    transport/API errors or a blocked/empty response."""
    if not settings.gemini_api_key:
        raise GeminiError(
            "Gemini API key not configured. Add GEMINI_API_KEY=... to backend/.env "
            "(get one at https://aistudio.google.com/apikey) and restart the server."
        )

    body: dict[str, Any] = {
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.2},
    }
    if tools:
        body["tools"] = [{"functionDeclarations": tools}]
        body["toolConfig"] = {"functionCallingConfig": {"mode": "AUTO"}}

    # Try the primary model, then any fallbacks. Each model gets retries with
    # exponential backoff on transient (overloaded) errors so a momentary 503
    # recovers on its own instead of surfacing to the user.
    models = [settings.gemini_model] + [
        m.strip() for m in (settings.gemini_fallback_models or "").split(",")
        if m.strip() and m.strip() != settings.gemini_model
    ]
    max_retries = max(1, settings.gemini_max_retries)
    last_status, last_detail = None, ""

    async with httpx.AsyncClient(timeout=60) as client:
        for model in models:
            url, headers = _auth(f"{_BASE}/models/{model}:generateContent")
            delay = 0.8
            for attempt in range(max_retries):
                try:
                    resp = await client.post(url, json=body, headers=headers)
                except httpx.HTTPError as exc:
                    last_status, last_detail = None, f"network error: {exc}"
                    if attempt < max_retries - 1:
                        await asyncio.sleep(delay); delay *= 2; continue
                    break

                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates") or []
                    if not candidates:
                        last_detail = f"blocked/empty {data.get('promptFeedback', {})}"
                        break  # content issue — a different model won't help
                    content = candidates[0].get("content")
                    if not content:
                        last_detail = f"empty (finishReason={candidates[0].get('finishReason', 'unknown')})"
                        break
                    return content

                # Non-200: capture detail, retry transient, else move to next model.
                try:
                    last_detail = resp.json().get("error", {}).get("message", resp.text)
                except Exception:
                    last_detail = resp.text
                last_status = resp.status_code
                if resp.status_code in _TRANSIENT and attempt < max_retries - 1:
                    await asyncio.sleep(delay); delay *= 2; continue
                break  # non-transient (404/429/400) or out of retries → next model

    if last_status in _TRANSIENT or last_status is None:
        raise GeminiError(
            "The assistant is busy right now (the AI model is temporarily overloaded). "
            "Please try again in a few seconds."
        )
    raise GeminiError(f"Gemini API error ({last_status}): {last_detail}")


def split_parts(content: dict) -> tuple[str, list[dict]]:
    """Split a model ``content`` into (text, function_calls)."""
    text_out = ""
    calls: list[dict] = []
    for part in content.get("parts", []):
        if "text" in part and part["text"]:
            text_out += part["text"]
        fc = part.get("functionCall")
        if fc:
            calls.append({"name": fc.get("name"), "args": fc.get("args") or {}})
    return text_out.strip(), calls
