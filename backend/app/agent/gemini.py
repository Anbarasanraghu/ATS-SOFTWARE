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

from typing import Any

import httpx

from app.core.config import settings

_BASE = "https://generativelanguage.googleapis.com/v1beta"


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

    url = f"{_BASE}/models/{settings.gemini_model}:generateContent"
    url, headers = _auth(url)

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, json=body, headers=headers)
    except httpx.HTTPError as exc:
        raise GeminiError(f"Could not reach Gemini API: {exc}") from exc

    if resp.status_code != 200:
        detail = resp.text
        try:
            detail = resp.json().get("error", {}).get("message", detail)
        except Exception:
            pass
        raise GeminiError(f"Gemini API error ({resp.status_code}): {detail}")

    data = resp.json()
    candidates = data.get("candidates") or []
    if not candidates:
        fb = data.get("promptFeedback", {})
        raise GeminiError(f"Gemini returned no candidates. {fb}")
    content = candidates[0].get("content")
    if not content:
        reason = candidates[0].get("finishReason", "unknown")
        raise GeminiError(f"Gemini returned an empty response (finishReason={reason}).")
    return content


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
