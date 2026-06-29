from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://app_user:app_pass@localhost:5432/erp"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 720  # 12 hours
    admin_database_url: str = ""

    # Per-user monthly price (each active user = 1 paid seat).
    price_per_user: int = 100

    # ── AI Agent (Gemini) ──────────────────────────────────────
    # Get a key from https://aistudio.google.com/apikey and put it in backend/.env
    # as GEMINI_API_KEY=... — never hardcode it here.
    gemini_api_key: str = ""
    # Extra keys (comma-separated) from other free-tier accounts. The agent
    # rotates to the next key when one is rate-limited / out of quota (429),
    # and remembers the working key for subsequent requests.
    gemini_api_keys: str = ""
    gemini_model: str = "gemini-2.5-flash-lite"
    # "auto" picks query-param auth for AIza... keys and Bearer auth otherwise.
    gemini_auth_mode: str = "auto"  # auto | key | bearer
    agent_max_tool_loops: int = 6   # safety cap on tool-call rounds per message
    # Transient 503/500 "model overloaded" errors auto-retry with backoff.
    gemini_max_retries: int = 3
    # Fallback models tried if the primary is rate-limited/overloaded. The free
    # tier has SEPARATE per-model quotas, so rotating across these multiplies the
    # effective free quota.
    gemini_fallback_models: str = "gemini-flash-latest,gemini-flash-lite-latest"


settings = Settings()