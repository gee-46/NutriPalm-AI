"""
database.py

Server-side Supabase client factory.

CRITICAL: this uses the SERVICE ROLE key and must only ever run on the
backend. Never send SUPABASE_SERVICE_ROLE_KEY to the frontend / browser.
The frontend continues to use its own anon-key Supabase client
(src/lib/supabaseClient.ts) for auth; this backend uses the service-role
client only to perform the specific, ownership-checked reads/writes its
endpoints need, with RLS still enabled on every table as defense in depth.
"""
from __future__ import annotations

from functools import lru_cache

from app.config import get_settings
from app.exceptions import RepositoryNotConfigured


@lru_cache
def get_supabase_client():
    """
    Returns a cached Supabase client, or raises RepositoryNotConfigured if
    SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set.

    Repositories call this lazily (not at import time) so the test suite and
    pure-logic services never require Supabase credentials to run.
    """
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RepositoryNotConfigured(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set as "
            "environment variables for database-backed repositories to work. "
            "See backend/.env.example and backend/docs/integration_contract.md."
        )

    from supabase import Client, create_client  # imported lazily

    client: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return client


# PostgREST reports a table it cannot see in two ways: the raw PostgreSQL SQLSTATE 42P01
# ("undefined table") and, in current PostgREST, PGRST205 ("could not find the table ... in the
# schema cache"). Both mean "this deployment has not applied the migration yet".
MISSING_TABLE_CODES = frozenset({"42P01", "PGRST205"})


def is_missing_table(exc: Exception) -> bool:
    return getattr(exc, "code", None) in MISSING_TABLE_CODES
