"""
Tests for authentication routes (/api/auth/*).

Covers login, registration, token verification, and auth edge cases.
"""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from bson import ObjectId
from datetime import datetime, timezone


class TestLogin:

    async def test_login_success(self, client, seeded_db):
        """Valid credentials should return a JWT token."""
        resp = await client.post(
            "/api/auth/login",
            data={"username": "parent@test.com", "password": "testpassword123"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"

    async def test_login_wrong_password(self, client, seeded_db):
        """Invalid password should return 401."""
        resp = await client.post(
            "/api/auth/login",
            data={"username": "parent@test.com", "password": "wrongpassword"},
        )
        assert resp.status_code == 401

    async def test_login_nonexistent_user(self, client):
        """Unknown email should return 401."""
        resp = await client.post(
            "/api/auth/login",
            data={"username": "nobody@test.com", "password": "whatever"},
        )
        assert resp.status_code == 401

    async def test_login_returns_valid_jwt(self, client, seeded_db):
        """The returned token should be a valid JWT that can be decoded."""
        resp = await client.post(
            "/api/auth/login",
            data={"username": "parent@test.com", "password": "testpassword123"},
        )
        token = resp.json()["access_token"]
        # The token should have 3 parts separated by dots (header.payload.signature)
        parts = token.split(".")
        assert len(parts) == 3


class TestRegister:

    async def test_register_duplicate_email(self, client, seeded_db):
        """Registering with an existing email should return 400."""
        resp = await client.post(
            "/api/auth/register",
            json={
                "email": "parent@test.com",
                "password": "securepass123",
                "first_name": "Dup",
                "last_name": "User",
            },
        )
        assert resp.status_code == 400
        assert "already exists" in resp.json()["detail"]

    async def test_register_missing_fields(self, client):
        """Missing required fields should return 422."""
        resp = await client.post(
            "/api/auth/register",
            json={"email": "incomplete@test.com"},
        )
        assert resp.status_code == 422

    async def test_register_invalid_email(self, client):
        """Invalid email should return 422."""
        resp = await client.post(
            "/api/auth/register",
            json={
                "email": "not-an-email",
                "password": "securepass123",
                "first_name": "Bad",
                "last_name": "Email",
            },
        )
        assert resp.status_code == 422


class TestTokenVerification:

    async def test_verify_token_missing_header(self, client):
        """No Authorization header should return 401."""
        resp = await client.post("/api/auth/verify-token")
        assert resp.status_code == 401

    async def test_verify_token_invalid_scheme(self, client):
        """Non-Bearer scheme should return 401."""
        resp = await client.post(
            "/api/auth/verify-token",
            headers={"Authorization": "Basic abc123"},
        )
        assert resp.status_code == 401

    async def test_verify_token_malformed(self, client):
        """Malformed token should return valid=False."""
        resp = await client.post(
            "/api/auth/verify-token",
            headers={"Authorization": "Bearer invalidtoken"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["valid"] is False

    async def test_login_then_decode_jwt(self, client, seeded_db):
        """A valid legacy JWT from login should decode to the correct email."""
        from jose import jwt as jose_jwt

        login_resp = await client.post(
            "/api/auth/login",
            data={"username": "parent@test.com", "password": "testpassword123"},
        )
        token = login_resp.json()["access_token"]
        payload = jose_jwt.decode(token, "test-secret-key-for-testing-only", algorithms=["HS256"])
        assert payload["sub"] == "parent@test.com"


class TestGetCurrentUser:

    async def test_me_unauthenticated(self, unauthenticated_client):
        """Without auth, GET /api/auth/me should return 401."""
        resp = await unauthenticated_client.get("/api/auth/me")
        assert resp.status_code == 401

    async def test_users_me_returns_info(self, client):
        """GET /api/users/me should return the authenticated user (uses UserInDB model)."""
        resp = await client.get("/api/users/me")
        assert resp.status_code == 200
        body = resp.json()
        assert body["email"] == "parent@test.com"
        assert body["role"] == "parent"
