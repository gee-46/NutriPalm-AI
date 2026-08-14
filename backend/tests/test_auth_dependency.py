import pytest
from fastapi import HTTPException
from jose import jwt

from app.config import Settings
from app.dependencies import get_current_user

SECRET = "test-jwt-secret"


def _settings() -> Settings:
    return Settings(supabase_jwt_secret=SECRET)


def _make_token(sub: str = "user-123", email: str = "farmer@example.com", **extra) -> str:
    payload = {"sub": sub, "email": email, "aud": "authenticated", **extra}
    return jwt.encode(payload, SECRET, algorithm="HS256")


def test_valid_token_returns_authenticated_user():
    token = _make_token()
    user = get_current_user(authorization=f"Bearer {token}", settings=_settings())
    assert user.user_id == "user-123"
    assert user.email == "farmer@example.com"


def test_missing_header_raises_401():
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(authorization=None, settings=_settings())
    assert exc_info.value.status_code == 401


def test_malformed_header_raises_401():
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(authorization="NotBearer abc", settings=_settings())
    assert exc_info.value.status_code == 401


def test_tampered_token_raises_401():
    token = _make_token()
    tampered = token[:-3] + "xyz"
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(authorization=f"Bearer {tampered}", settings=_settings())
    assert exc_info.value.status_code == 401


def test_wrong_secret_raises_401():
    token = jwt.encode(
        {"sub": "user-123", "aud": "authenticated"}, "wrong-secret", algorithm="HS256"
    )
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(authorization=f"Bearer {token}", settings=_settings())
    assert exc_info.value.status_code == 401


def test_token_without_subject_raises_401():
    token = jwt.encode({"aud": "authenticated"}, SECRET, algorithm="HS256")
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(authorization=f"Bearer {token}", settings=_settings())
    assert exc_info.value.status_code == 401
