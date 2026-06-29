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
import re
from typing import Any

import httpx

from app.core.config import settings

_BASE = "https://generativelanguage.googleapis.com/v1beta"
# Transient server-side errors worth retrying (overloaded / hiccup / timeout).
_TRANSIENT = {500, 502, 503, 504}
# 429 = rate limit; usually a short per-minute throttle that recovers quickly.
_RETRYABLE = _TRANSIENT | {429}


def _retry_after(detail: str) -> float | None:
    """Pull the server-suggested wait (e.g. 'Please retry in 1.83s') if present."""
    m = re.search(r"retry in ([\d.]+)s", detail or "")
    return float(m.group(1)) if m else None


class GeminiError(RuntimeError):
    pass


# Sticky cursor — once a key works, keep starting from it instead of re-hitting
# exhausted keys on every request.
_key_idx = 0


def _all_keys() -> list[str]:
    """Ordered, de-duplicated list of API keys (primary + extras)."""
    keys: list[str] = []
    for raw in [settings.gemini_api_key, *(settings.gemini_api_keys or "").split(",")]:
        k = (raw or "").strip()
        if k and k not in keys:
            keys.append(k)
    return keys


def _auth(url: str, key: str) -> tuple[str, dict]:
    mode = (settings.gemini_auth_mode or "auto").lower()
    if mode == "bearer":
        return url, {"Authorization": f"Bearer {key}"}
    # "auto"/"key": Google AI Studio keys (AIza... and AQ.Ab8RN6... both) auth via
    # the ?key= query param. Bearer is only for explicit OAuth tokens.
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
    global _key_idx
    keys = _all_keys()
    if not keys:
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

    # Try the primary model then fallbacks. Across them, rotate API keys: when a
    # key is rate-limited / out of quota (429) we move to the next key (different
    # free-tier bucket). 503/overload retries with backoff on the same key/model.
    models = [settings.gemini_model] + [
        m.strip() for m in (settings.gemini_fallback_models or "").split(",")
        if m.strip() and m.strip() != settings.gemini_model
    ]
    max_retries = max(1, settings.gemini_max_retries)
    n = len(keys)
    start = _key_idx % n
    last_status, last_detail = None, ""

    async with httpx.AsyncClient(timeout=60) as client:
        for off in range(n):                       # rotate keys, starting at the cursor
            kidx = (start + off) % n
            key = keys[kidx]
            for model in models:                   # each key: try every model
                url, headers = _auth(f"{_BASE}/models/{model}:generateContent", key)
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
                        content = candidates[0].get("content") if candidates else None
                        if not content:
                            fr = candidates[0].get("finishReason", "unknown") if candidates else data.get("promptFeedback", {})
                            raise GeminiError(f"The AI returned an empty/blocked response ({fr}).")
                        _key_idx = kidx           # remember the working key
                        return content

                    try:
                        last_detail = resp.json().get("error", {}).get("message", resp.text)
                    except Exception:
                        last_detail = resp.text
                    last_status = resp.status_code
                    # Only wait-retry genuine transient overloads; 429 (quota) →
                    # move on immediately to the next model/key (faster than waiting).
                    if resp.status_code in _TRANSIENT and attempt < max_retries - 1:
                        wait = _retry_after(last_detail)
                        await asyncio.sleep(min(wait, 8.0) if wait else delay)
                        delay *= 2
                        continue
                    break  # 429 / 404 / 400 / out of retries → next model (then next key)

    if last_status == 429:
        extra = (f" All {n} keys are exhausted." if n > 1 else "")
        raise GeminiError(
            "The AI is rate-limited right now (free-tier quota)." + extra +
            " Please wait a bit and try again. To remove these limits, add more keys "
            "(GEMINI_API_KEYS) or use a paid Gemini API key."
        )
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
