"""
FastAPI authentication and dependency wiring.

Supports:
- Legacy Supabase HS256 JWTs using SUPABASE_JWT_SECRET.
- Supabase asymmetric RS256/ES256 JWTs using the project's JWKS endpoint.

Verification is fail-closed: the algorithm is taken from the allow-list per path (never trusted from the token
alone), `exp`, `aud` and `sub` are REQUIRED, the audience must be "authenticated", and any problem with the key or
token (including a key of the wrong type) is a 401, never a 500. Implemented with PyJWT (python-jose and its `ecdsa`
dependency were removed; see docs/PRODUCTION_READINESS_AUDIT.md section 7).
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from threading import Lock

import httpx
from fastapi import Depends, Header, HTTPException, status
import jwt
from jwt import PyJWTError

from app.config import Settings, get_settings


@dataclass(frozen=True)
class AuthenticatedUser:
    user_id: str
    email: str | None = None


_JWKS_CACHE: dict | None = None
_JWKS_CACHE_EXPIRES_AT = 0.0
_JWKS_CACHE_LOCK = Lock()
_JWKS_CACHE_TTL_SECONDS = 600


def _get_jwks_url(settings: Settings) -> str:
    """Return the configured JWKS URL, deriving it from SUPABASE_URL if needed."""
    if settings.supabase_jwks_url:
        return settings.supabase_jwks_url.rstrip("/")

    if settings.supabase_url:
        return (
            f"{settings.supabase_url.rstrip('/')}"
            "/auth/v1/.well-known/jwks.json"
        )

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Supabase URL/JWKS configuration is missing.",
    )


def _get_jwks(settings: Settings) -> dict:
    """Fetch and cache the Supabase JSON Web Key Set."""
    global _JWKS_CACHE, _JWKS_CACHE_EXPIRES_AT

    now = time.time()

    if _JWKS_CACHE is not None and now < _JWKS_CACHE_EXPIRES_AT:
        return _JWKS_CACHE

    with _JWKS_CACHE_LOCK:
        now = time.time()

        if _JWKS_CACHE is not None and now < _JWKS_CACHE_EXPIRES_AT:
            return _JWKS_CACHE

        try:
            response = httpx.get(
                _get_jwks_url(settings),
                timeout=5.0,
            )
            response.raise_for_status()
            jwks = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to retrieve Supabase signing keys.",
            ) from exc

        if not isinstance(jwks, dict) or not isinstance(
            jwks.get("keys"), list
        ):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Invalid Supabase JWKS response.",
            )

        _JWKS_CACHE = jwks
        _JWKS_CACHE_EXPIRES_AT = now + _JWKS_CACHE_TTL_SECONDS

        return jwks


_UNAUTHORIZED = "Invalid or expired authentication token."
_REQUIRED_CLAIMS = {"require": ["exp", "aud", "sub"]}
# JWK key type each permitted asymmetric algorithm may be verified with.
_KEY_TYPE_FOR_ALGORITHM = {"RS256": ("RSA", None), "ES256": ("EC", "P-256")}


def _reject(detail: str = _UNAUTHORIZED) -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def _decode_token(token: str, settings: Settings) -> dict:
    """Verify a Supabase JWT using HS256 or an asymmetric JWKS key."""
    try:
        header = jwt.get_unverified_header(token)
    except PyJWTError as exc:
        raise _reject() from exc

    algorithm = header.get("alg")

    # Legacy Supabase signing mode.
    if algorithm == "HS256":
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
                options=_REQUIRED_CLAIMS,
            )
        except PyJWTError as exc:
            raise _reject() from exc

    # Supabase asymmetric signing.
    if algorithm in _KEY_TYPE_FOR_ALGORITHM:
        kid = header.get("kid")

        if not kid:
            raise _reject("Authentication token is missing a signing key id.")

        jwks = _get_jwks(settings)

        def find(keys):
            return next((jwk for jwk in keys["keys"] if jwk.get("kid") == kid), None)

        key = find(jwks)

        if key is None:
            # Refresh once in case a signing key was rotated.
            global _JWKS_CACHE, _JWKS_CACHE_EXPIRES_AT

            with _JWKS_CACHE_LOCK:
                _JWKS_CACHE = None
                _JWKS_CACHE_EXPIRES_AT = 0.0

            key = find(_get_jwks(settings))

        if key is None:
            raise _reject("Authentication signing key was not found.")

        # The token's header must not be able to choose a weaker verification than the key allows.
        kty, crv = _KEY_TYPE_FOR_ALGORITHM[algorithm]
        if key.get("kty") != kty or (crv is not None and key.get("crv") != crv):
            raise _reject()

        try:
            public_key = jwt.PyJWK(key).key
            return jwt.decode(
                token,
                public_key,
                algorithms=[algorithm],
                audience="authenticated",
                options=_REQUIRED_CLAIMS,
            )
        except PyJWTError as exc:
            raise _reject() from exc

    raise _reject("Unsupported authentication signing algorithm.")


def get_current_user(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    """
    Extract and verify the caller identity from an Authorization Bearer token.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
        )

    token = authorization.split(" ", 1)[1].strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
        )

    payload = _decode_token(token, settings)

    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token did not contain a subject (user id).",
        )

    return AuthenticatedUser(
        user_id=user_id,
        email=payload.get("email"),
    )
