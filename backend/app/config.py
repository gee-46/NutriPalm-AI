"""
Application configuration.

All secrets and environment-specific values MUST come from environment
variables. Nothing sensitive is hardcoded here.
"""
from __future__ import annotations

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables / .env file."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Supabase ---
    # SUPABASE_URL: the project URL, e.g. https://xxxx.supabase.co
    # SUPABASE_SERVICE_ROLE_KEY: server-side ONLY. Never send this to the
    #   frontend / browser. Used by this backend to perform privileged reads
    #   (e.g. resolving plot/soil-report data) while still enforcing
    #   ownership checks in application code and RLS in the database.
    # SUPABASE_JWT_SECRET: used to verify the Supabase Auth JWT sent by the
    #   authenticated frontend so we know which user is calling the API.
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""
    supabase_jwks_url: str = ""

    # --- App ---
    environment: str = "development"  # development | staging | production
    api_v1_prefix: str = "/api"
    cors_allow_origins: str = "http://localhost:5173"

    # --- Feature flags ---
    # When true, repositories fall back to raising NotConfiguredError instead
    # of silently returning fake data if Supabase is not configured. This
    # must always be true outside of local dev.
    strict_no_mock_data: bool = True

    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allow_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
