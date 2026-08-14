"""
dependencies.py

FastAPI dependencies for authentication and repository wiring.

Auth model: the frontend (already using Supabase Auth per Team Member 1's
work) sends the user's Supabase access token as a Bearer token. This backend
verifies that JWT itself (HS256, using SUPABASE_JWT_SECRET) rather than
trusting a client-supplied owner_id/user_id - this is what makes "a user can
never access another user's recommendation by changing an ID" actually true.

NOTE: Supabase projects created after the JWT-signing-keys migration may use
asymmetric (ES256/RS256) signing with a JWKS endpoint instead of a single
shared HS256 secret. If Team Member 1's Supabase project uses that mode,
swap the verification in `_decode_token` for a JWKS-based verifier - the
rest of this module (and every router) is unaffected.
"""
from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt

from app.config import Settings, get_settings


@dataclass(frozen=True)
class AuthenticatedUser:
    user_id: str
    email: str | None = None


def _decode_token(token: str, settings: Settings) -> dict:
    if not settings.supabase_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_JWT_SECRET is not configured on the backend.",
        )
    try:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
        ) from exc


def get_current_user(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    """
    Extracts and verifies the caller's identity from the `Authorization:
    Bearer <supabase_access_token>` header. Raises 401 if missing/invalid.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
        )

    token = authorization.split(" ", 1)[1].strip()
    payload = _decode_token(token, settings)

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token did not contain a subject (user id).",
        )

    return AuthenticatedUser(user_id=user_id, email=payload.get("email"))
