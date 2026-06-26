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
    gemini_model: str = "gemini-2.5-flash"
    # "auto" picks query-param auth for AIza... keys and Bearer auth otherwise.
    gemini_auth_mode: str = "auto"  # auto | key | bearer
    agent_max_tool_loops: int = 6   # safety cap on tool-call rounds per message


settings = Settings()