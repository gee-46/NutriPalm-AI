"""
Application configuration.

All secrets and environment-specific values MUST come from environment
variables. Nothing sensitive is hardcoded here.

Production safety:
- Mock/fallback behavior must never be allowed outside development.
- Production and staging always require strict_no_mock_data=True.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import ValidationInfo, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables / .env file."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        extra="ignore",
    )

    # --- Supabase ---
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""
    supabase_jwks_url: str = ""

    # --- Satellite / External APIs ---
    sentinel_hub_client_id: str = ""
    sentinel_hub_client_secret: str = ""

    # --- App ---
    environment: str = "development"
    api_v1_prefix: str = "/api"
    cors_allow_origins: str = "http://localhost:5173"

    # --- Feature flags ---
    strict_no_mock_data: bool = True

    @field_validator("environment")
    @classmethod
    def validate_environment(cls, value: str) -> str:
        """Normalize and validate the deployment environment."""
        normalized = value.strip().lower()

        allowed = {
            "development",
            "staging",
            "production",
        }

        if normalized not in allowed:
            raise ValueError(
                "environment must be one of: "
                "development, staging, production"
            )

        return normalized

    @field_validator("strict_no_mock_data")
    @classmethod
    def enforce_production_strict_mode(
        cls,
        value: bool,
        info: ValidationInfo,
    ) -> bool:
        """
        Prevent staging/production deployments from disabling strict mode.

        This ensures production code cannot silently fall back to mock or
        unconfigured-data behavior even if the environment variable is
        accidentally set to false.
        """
        environment = info.data.get("environment", "development")

        if environment in {"staging", "production"} and not value:
            raise ValueError(
                "strict_no_mock_data must be True in staging and production."
            )

        return value

    def cors_origins_list(self) -> list[str]:
        """Return configured CORS origins as a cleaned list."""
        return [
            origin.strip()
            for origin in self.cors_allow_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    """Return the cached application settings."""
    return Settings()
