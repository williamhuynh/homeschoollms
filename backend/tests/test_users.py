"""
Tests for user routes (/api/users/*).

Covers fetching current user profile and admin user management.
"""

import pytest
from bson import ObjectId


class TestGetCurrentUserProfile:

    async def test_get_me(self, client):
        """GET /api/users/me should return the authenticated user."""
        resp = await client.get("/api/users/me")
        assert resp.status_code == 200
        body = resp.json()
        assert body["email"] == "parent@test.com"
        assert body["first_name"] == "Test"
        assert body["last_name"] == "Parent"
        assert body["role"] == "parent"

    async def test_get_me_unauthenticated(self, unauthenticated_client):
        """Should return 401 without authentication."""
        resp = await unauthenticated_client.get("/api/users/me")
        assert resp.status_code == 401


class TestAdminUserManagement:

    async def test_regular_user_cannot_update_other_user(self, client):
        """Regular parent should get 403 when trying to update another user."""
        fake_id = str(ObjectId())
        resp = await client.put(
            f"/api/users/{fake_id}",
            json={"role": "admin"},
        )
        assert resp.status_code == 403

    async def test_regular_user_cannot_update_role(self, client):
        """Regular parent should get 403 when trying to change roles."""
        fake_id = str(ObjectId())
        resp = await client.put(
            f"/api/users/{fake_id}/role",
            json={"role": "admin"},
        )
        assert resp.status_code == 403

    async def test_admin_can_update_user(self, admin_client, seeded_db, test_user_id):
        """Admin should be able to update user attributes."""
        resp = await admin_client.put(
            f"/api/users/{str(test_user_id)}",
            json={"first_name": "Updated"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["first_name"] == "Updated"

    async def test_regular_user_cannot_set_admin(self, client):
        """Regular parent should get 403 on set-admin endpoint."""
        resp = await client.put("/api/users/email/test@test.com/set-admin")
        assert resp.status_code == 403
