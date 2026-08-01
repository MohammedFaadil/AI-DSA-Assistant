"""Environment contract for the AI service.

Parsed once at import. The service refuses to start on a malformed value, so a
running container is a fully configured one.
"""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


_HERE = Path(__file__).resolve()
# apps/ai/.env wins, then the monorepo-root .env — same precedence as the API.
_ENV_FILES = (_HERE.parents[2] / ".env", _HERE.parents[4] / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[str(p) for p in _ENV_FILES if p.exists()],
        extra="ignore",
        case_sensitive=False,
    )

    # ── Service ──────────────────────────────────────────────────────────
    port: int = 8000
    ai_log_level: str = "INFO"
    ai_service_hmac_secret: str = "change-me-shared-hmac-secret-32-chars-min"
    # Signature verification is disabled in development so you can curl the
    # service directly; it is mandatory in production.
    require_signature: bool = False

    # ── Providers ────────────────────────────────────────────────────────
    # Every provider is optional. With no keys at all the service still serves
    # Stage-1 mentoring (complexity, warnings, structure) and returns a
    # graceful fallback for Stage 2 — that is the whole point of the design.
    openrouter_api_key: str | None = None
    groq_api_key: str | None = None
    together_api_key: str | None = None
    ollama_url: str = "http://localhost:11434"
    # Ollama needs no API key, so it would otherwise always look "configured"
    # and every turn would burn seconds failing to reach a local server that
    # isn't running. Opt in explicitly.
    enable_ollama: bool = False

    openrouter_url: str = "https://openrouter.ai/api/v1"
    groq_url: str = "https://api.groq.com/openai/v1"
    together_url: str = "https://api.together.xyz/v1"

    # Model ids are configuration, not code — switching providers when one
    # rate-limits is an env change and a restart, never a deploy.
    model_tier_reason: str = "deepseek/deepseek-r1-distill-llama-70b:free"
    model_tier_fast: str = "qwen/qwen-2.5-coder-32b-instruct:free"
    model_tier_tiny: str = "meta-llama/llama-3.1-8b-instruct:free"

    # ── Budgets ──────────────────────────────────────────────────────────
    daily_token_budget: int = 2_000_000
    per_user_daily_tokens: int = 60_000
    enable_ghost_text: bool = True
    semantic_cache_ttl: int = 1800

    # ── Guard thresholds ─────────────────────────────────────────────────
    # Dice similarity against the reference-solution fingerprint above which a
    # response is rejected as "about to hand over the answer".
    solution_similarity_threshold: float = 0.62

    request_timeout_s: float = 40.0


settings = Settings()
