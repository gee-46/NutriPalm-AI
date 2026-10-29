"""
Token-verification attack tests. They pin the fail-closed behaviour of app.dependencies.get_current_user and are
independent of which JWT library implements it (the suite was written against python-jose and kept unchanged across
the move to PyJWT).
"""
import base64
import json
import time

import jwt as pyjwt  # only used here to MAKE tokens and keys
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from fastapi import HTTPException

from app import dependencies
from app.config import Settings
from app.dependencies import get_current_user

SECRET = "unit-test-signing-secret-0123456789abcdef"
NOW = int(time.time())


def settings(**kw):
    return Settings(_env_file=None, supabase_jwt_secret=SECRET, **kw)


def claims(**over):
    return {"sub": "user-1", "aud": "authenticated", "exp": NOW + 600, **over}


def status_of(token, st=None):
    try:
        get_current_user(authorization=f"Bearer {token}", settings=st or settings())
    except HTTPException as exc:
        return exc.status_code
    return 200


def b64(obj):
    return base64.urlsafe_b64encode(json.dumps(obj).encode()).rstrip(b"=").decode()


@pytest.fixture(scope="module")
def rsa_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(scope="module")
def ec_key():
    return ec.generate_private_key(ec.SECP256R1())


def jwk_of(private_key, kid, alg):
    algo = pyjwt.algorithms.RSAAlgorithm if alg == "RS256" else pyjwt.algorithms.ECAlgorithm
    jwk = json.loads(algo.to_jwk(private_key.public_key()))
    jwk.update(kid=kid, alg=alg, use="sig")
    return jwk


@pytest.fixture
def jwks(monkeypatch, rsa_key, ec_key):
    keys = {"keys": [jwk_of(rsa_key, "rsa-1", "RS256"), jwk_of(ec_key, "ec-1", "ES256")]}
    monkeypatch.setattr(dependencies, "_get_jwks", lambda s: keys)
    return keys


# ------------------------------------------------------------------ HS256
def test_valid_hs256_token_is_accepted():
    assert status_of(pyjwt.encode(claims(), SECRET, algorithm="HS256")) == 200


def test_alg_none_is_rejected():
    token = f"{b64({'alg': 'none', 'typ': 'JWT'})}.{b64(claims())}."
    assert status_of(token) == 401


@pytest.mark.parametrize("alg", ["HS384", "HS512"])
def test_other_hmac_algorithms_are_refused(alg):
    assert status_of(pyjwt.encode(claims(), SECRET, algorithm=alg)) == 401


def test_expired_token_is_rejected():
    assert status_of(pyjwt.encode(claims(exp=NOW - 10), SECRET, algorithm="HS256")) == 401


def test_a_token_that_never_expires_is_rejected():
    c = claims()
    del c["exp"]
    assert status_of(pyjwt.encode(c, SECRET, algorithm="HS256")) == 401


def test_not_yet_valid_token_is_rejected():
    assert status_of(pyjwt.encode(claims(nbf=NOW + 3600), SECRET, algorithm="HS256")) == 401


@pytest.mark.parametrize("aud", ["anon", "service_role", "https://other.example", None])
def test_wrong_or_missing_audience_is_rejected(aud):
    c = claims()
    if aud is None:
        del c["aud"]
    else:
        c["aud"] = aud
    assert status_of(pyjwt.encode(c, SECRET, algorithm="HS256")) == 401


def test_wrong_secret_and_missing_subject_are_rejected():
    assert status_of(pyjwt.encode(claims(), "x" * 40, algorithm="HS256")) == 401
    c = claims()
    del c["sub"]
    assert status_of(pyjwt.encode(c, SECRET, algorithm="HS256")) == 401


def test_hs256_token_without_a_configured_secret_is_a_server_error_not_a_pass():
    st = Settings(_env_file=None, supabase_jwt_secret="")
    assert status_of(pyjwt.encode(claims(), SECRET, algorithm="HS256"), st) == 500


@pytest.mark.parametrize("garbage", ["", "abc", "a.b", "a.b.c", "....", "eyJhbGciOiJIUzI1NiJ9.e30.", "\x00\x01"])
def test_garbage_is_rejected(garbage):
    assert status_of(garbage) == 401


# ------------------------------------------------------------------ algorithm confusion
def test_hs256_token_signed_with_the_public_key_is_rejected(rsa_key, jwks):
    """Classic RS256->HS256 confusion: the attacker only has the (public) key and uses it as the HMAC secret."""
    pem = rsa_key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
    forged = b64({"alg": "HS256", "typ": "JWT", "kid": "rsa-1"}) + "." + b64(claims())
    import hashlib
    import hmac

    sig = base64.urlsafe_b64encode(hmac.new(pem, forged.encode(), hashlib.sha256).digest()).rstrip(b"=").decode()
    assert status_of(f"{forged}.{sig}") == 401


def test_hs256_token_signed_with_der_public_key_is_rejected(rsa_key, jwks):
    """The python-jose advisory (PYSEC-2026-4298): DER-encoded public key accepted as an HMAC secret."""
    import hashlib
    import hmac

    der = rsa_key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    forged = b64({"alg": "HS256", "typ": "JWT"}) + "." + b64(claims())
    sig = base64.urlsafe_b64encode(hmac.new(der, forged.encode(), hashlib.sha256).digest()).rstrip(b"=").decode()
    assert status_of(f"{forged}.{sig}") == 401


# ------------------------------------------------------------------ asymmetric (JWKS)
def test_valid_rs256_and_es256_tokens_are_accepted(rsa_key, ec_key, jwks):
    assert status_of(pyjwt.encode(claims(), rsa_key, algorithm="RS256", headers={"kid": "rsa-1"})) == 200
    assert status_of(pyjwt.encode(claims(), ec_key, algorithm="ES256", headers={"kid": "ec-1"})) == 200


def test_token_signed_by_another_key_with_a_known_kid_is_rejected(jwks):
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    assert status_of(pyjwt.encode(claims(), other, algorithm="RS256", headers={"kid": "rsa-1"})) == 401


def test_unknown_or_missing_kid_is_rejected(rsa_key, jwks):
    assert status_of(pyjwt.encode(claims(), rsa_key, algorithm="RS256", headers={"kid": "nope"})) == 401
    assert status_of(pyjwt.encode(claims(), rsa_key, algorithm="RS256")) == 401


def test_header_algorithm_must_match_the_key_type(rsa_key, ec_key, jwks):
    # an ES256-headed token pointing at the RSA key id (and vice versa) can never verify
    assert status_of(pyjwt.encode(claims(), ec_key, algorithm="ES256", headers={"kid": "rsa-1"})) == 401
    assert status_of(pyjwt.encode(claims(), rsa_key, algorithm="RS256", headers={"kid": "ec-1"})) == 401


def test_expired_and_wrong_audience_asymmetric_tokens_are_rejected(rsa_key, jwks):
    assert status_of(pyjwt.encode(claims(exp=NOW - 5), rsa_key, algorithm="RS256", headers={"kid": "rsa-1"})) == 401
    assert status_of(pyjwt.encode(claims(aud="anon"), rsa_key, algorithm="RS256", headers={"kid": "rsa-1"})) == 401


def test_unsupported_asymmetric_algorithms_are_refused(rsa_key, jwks):
    assert status_of(pyjwt.encode(claims(), rsa_key, algorithm="RS512", headers={"kid": "rsa-1"})) == 401
    assert status_of(pyjwt.encode(claims(), rsa_key, algorithm="PS256", headers={"kid": "rsa-1"})) == 401
