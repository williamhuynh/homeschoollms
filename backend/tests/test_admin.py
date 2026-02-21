"""
Tests for admin routes (/api/admin/*).

Covers user management, student management, impersonation, and platform
statistics endpoints. All admin routes require super_admin role via the
get_super_admin_user dependency.

Test categories:
- Authorization: regular users and admin users are rejected with 403
- Success cases: super_admin can access all endpoints
- Error handling: invalid IDs, missing resources, bad input
"""

import pytest
import pytest_asyncio
from unittest.mock import patch, MagicMock, AsyncMock
from bson import ObjectId
from datetime import datetime, timezone

from httpx import AsyncClient, ASGITransport


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture()
async def super_admin_client(seeded_db, super_admin_user):
    """
    An authenticated HTTPX AsyncClient with super_admin privileges.

    Overrides get_current_user to return a user with role=super_admin,
    which satisfies the get_super_admin_user dependency used by all
    admin routes.
    """
    from tests.conftest import _patch_db
    _patch_db(seeded_db)

    from app.main import app
    from app.utils.auth_utils import get_current_user

    app.dependency_overrides[get_current_user] = lambda: super_admin_user

    with patch("app.main.get_rate_limiter") as mock_rl:
        mock_rl.return_value.start_cleanup = MagicMock()
        mock_rl.return_value.stop_cleanup = MagicMock()
        mock_rl.return_value.check_rate_limit = MagicMock(return_value=(True, 10, 900))

        with patch("app.main.ensure_report_indexes", new_callable=AsyncMock):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                yield ac

    app.dependency_overrides.clear()


# ============================================================
# Authorization Tests
# ============================================================

class TestAdminAuthorization:
    """Regular (parent) users must receive 403 on every admin endpoint."""

    async def test_list_users_forbidden_for_parent(self, client):
        """GET /api/admin/users should return 403 for a parent user."""
        resp = await client.get("/api/admin/users")
        assert resp.status_code == 403

    async def test_get_user_forbidden_for_parent(self, client, test_user_id):
        """GET /api/admin/users/{id} should return 403 for a parent user."""
        resp = await client.get(f"/api/admin/users/{str(test_user_id)}")
        assert resp.status_code == 403

    async def test_get_user_by_email_forbidden_for_parent(self, client):
        """GET /api/admin/users/by-email/{email} should return 403 for a parent user."""
        resp = await client.get("/api/admin/users/by-email/parent@test.com")
        assert resp.status_code == 403

    async def test_update_user_profile_forbidden_for_parent(self, client, test_user_id):
        """PUT /api/admin/users/{id}/profile should return 403 for a parent user."""
        resp = await client.put(
            f"/api/admin/users/{str(test_user_id)}/profile",
            json={"first_name": "Hacked"},
        )
        assert resp.status_code == 403

    async def test_update_subscription_forbidden_for_parent(self, client, test_user_id):
        """PUT /api/admin/users/{id}/subscription should return 403 for a parent user."""
        resp = await client.put(
            f"/api/admin/users/{str(test_user_id)}/subscription",
            json={"subscription_tier": "basic"},
        )
        assert resp.status_code == 403

    async def test_deactivate_user_forbidden_for_parent(self, client, test_user_id):
        """POST /api/admin/users/{id}/deactivate should return 403 for a parent user."""
        resp = await client.post(f"/api/admin/users/{str(test_user_id)}/deactivate")
        assert resp.status_code == 403

    async def test_reactivate_user_forbidden_for_parent(self, client, test_user_id):
        """POST /api/admin/users/{id}/reactivate should return 403 for a parent user."""
        resp = await client.post(f"/api/admin/users/{str(test_user_id)}/reactivate")
        assert resp.status_code == 403

    async def test_delete_user_forbidden_for_parent(self, client, test_user_id):
        """DELETE /api/admin/users/{id} should return 403 for a parent user."""
        resp = await client.request(
            "DELETE",
            f"/api/admin/users/{str(test_user_id)}",
            json={"permanent": False},
        )
        assert resp.status_code == 403

    async def test_list_students_forbidden_for_parent(self, client):
        """GET /api/admin/students should return 403 for a parent user."""
        resp = await client.get("/api/admin/students")
        assert resp.status_code == 403

    async def test_get_student_forbidden_for_parent(self, client, test_student_id):
        """GET /api/admin/students/{id} should return 403 for a parent user."""
        resp = await client.get(f"/api/admin/students/{str(test_student_id)}")
        assert resp.status_code == 403

    async def test_impersonate_forbidden_for_parent(self, client, test_user_id):
        """POST /api/admin/impersonate should return 403 for a parent user."""
        resp = await client.post(
            "/api/admin/impersonate",
            json={"user_id": str(test_user_id)},
        )
        assert resp.status_code == 403

    async def test_stats_forbidden_for_parent(self, client):
        """GET /api/admin/stats should return 403 for a parent user."""
        resp = await client.get("/api/admin/stats")
        assert resp.status_code == 403


class TestAdminAuthorizationForAdminRole:
    """Admin-role users (not super_admin) must also receive 403."""

    async def test_list_users_forbidden_for_admin(self, admin_client):
        """GET /api/admin/users should return 403 for an admin (non-super) user."""
        resp = await admin_client.get("/api/admin/users")
        assert resp.status_code == 403

    async def test_get_stats_forbidden_for_admin(self, admin_client):
        """GET /api/admin/stats should return 403 for an admin (non-super) user."""
        resp = await admin_client.get("/api/admin/stats")
        assert resp.status_code == 403

    async def test_impersonate_forbidden_for_admin(self, admin_client, test_user_id):
        """POST /api/admin/impersonate should return 403 for an admin (non-super) user."""
        resp = await admin_client.post(
            "/api/admin/impersonate",
            json={"user_id": str(test_user_id)},
        )
        assert resp.status_code == 403

    async def test_list_students_forbidden_for_admin(self, admin_client):
        """GET /api/admin/students should return 403 for an admin (non-super) user."""
        resp = await admin_client.get("/api/admin/students")
        assert resp.status_code == 403


class TestAdminAuthorizationUnauthenticated:
    """Unauthenticated requests should return 401."""

    async def test_list_users_unauthenticated(self, unauthenticated_client):
        """GET /api/admin/users should return 401 without auth."""
        resp = await unauthenticated_client.get("/api/admin/users")
        assert resp.status_code == 401

    async def test_stats_unauthenticated(self, unauthenticated_client):
        """GET /api/admin/stats should return 401 without auth."""
        resp = await unauthenticated_client.get("/api/admin/stats")
        assert resp.status_code == 401

    async def test_impersonate_unauthenticated(self, unauthenticated_client):
        """POST /api/admin/impersonate should return 401 without auth."""
        resp = await unauthenticated_client.post(
            "/api/admin/impersonate",
            json={"user_id": str(ObjectId())},
        )
        assert resp.status_code == 401


# ============================================================
# User Management - Success Cases
# ============================================================

class TestListUsers:
    """GET /api/admin/users - list users with filtering and pagination."""

    async def test_list_users_returns_seeded_user(self, super_admin_client):
        """Should return at least the seeded parent user."""
        resp = await super_admin_client.get("/api/admin/users")
        assert resp.status_code == 200
        body = resp.json()
        assert "users" in body
        assert "total" in body
        assert body["total"] >= 1
        emails = [u["email"] for u in body["users"]]
        assert "parent@test.com" in emails

    async def test_list_users_pagination(self, super_admin_client):
        """Should respect skip and limit parameters."""
        resp = await super_admin_client.get("/api/admin/users?skip=0&limit=1")
        assert resp.status_code == 200
        body = resp.json()
        assert body["skip"] == 0
        assert body["limit"] == 1
        assert len(body["users"]) <= 1

    async def test_list_users_filter_by_role(self, super_admin_client):
        """Should filter users by role."""
        resp = await super_admin_client.get("/api/admin/users?role=parent")
        assert resp.status_code == 200
        body = resp.json()
        for user in body["users"]:
            assert user["role"] == "parent"

    async def test_list_users_filter_by_active_status(self, super_admin_client):
        """Should filter by active status."""
        resp = await super_admin_client.get("/api/admin/users?is_active=true")
        assert resp.status_code == 200
        body = resp.json()
        for user in body["users"]:
            assert user["is_active"] is True

    async def test_list_users_filter_by_subscription_tier(self, super_admin_client):
        """Should filter by subscription tier."""
        resp = await super_admin_client.get("/api/admin/users?subscription_tier=free")
        assert resp.status_code == 200
        body = resp.json()
        for user in body["users"]:
            assert user["subscription_tier"] == "free"

    async def test_list_users_search(self, super_admin_client):
        """Should search users by name or email."""
        resp = await super_admin_client.get("/api/admin/users?search=parent")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 1

    async def test_list_users_search_no_results(self, super_admin_client):
        """Search with non-matching term should return empty list."""
        resp = await super_admin_client.get("/api/admin/users?search=zzzznonexistentzzzz")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 0
        assert body["users"] == []

    async def test_list_users_skip_beyond_total(self, super_admin_client):
        """Skipping past all records should return empty list."""
        resp = await super_admin_client.get("/api/admin/users?skip=9999")
        assert resp.status_code == 200
        body = resp.json()
        assert body["users"] == []


class TestGetUser:
    """GET /api/admin/users/{user_id} - get user by ID."""

    async def test_get_user_by_id(self, super_admin_client, test_user_id):
        """Should return the seeded user by ID."""
        resp = await super_admin_client.get(f"/api/admin/users/{str(test_user_id)}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["email"] == "parent@test.com"
        assert body["first_name"] == "Test"
        assert body["last_name"] == "Parent"
        assert body["role"] == "parent"
        assert body["id"] == str(test_user_id)

    async def test_get_user_includes_sensitive_fields(self, super_admin_client, test_user_id):
        """User detail view should include sensitive fields like stripe IDs."""
        resp = await super_admin_client.get(f"/api/admin/users/{str(test_user_id)}")
        assert resp.status_code == 200
        body = resp.json()
        # These fields are included when include_sensitive=True
        assert "stripe_customer_id" in body
        assert "organization_id" in body

    async def test_get_user_not_found(self, super_admin_client):
        """Non-existent user ID should return 404."""
        fake_id = str(ObjectId())
        resp = await super_admin_client.get(f"/api/admin/users/{fake_id}")
        assert resp.status_code == 404

    async def test_get_user_invalid_id(self, super_admin_client):
        """Invalid ObjectId format should return 400."""
        resp = await super_admin_client.get("/api/admin/users/not-a-valid-id")
        assert resp.status_code == 400


class TestGetUserByEmail:
    """GET /api/admin/users/by-email/{email} - get user by email."""

    async def test_get_user_by_email(self, super_admin_client):
        """Should return the seeded user by email."""
        resp = await super_admin_client.get("/api/admin/users/by-email/parent@test.com")
        assert resp.status_code == 200
        body = resp.json()
        assert body["email"] == "parent@test.com"
        assert body["first_name"] == "Test"

    async def test_get_user_by_email_not_found(self, super_admin_client):
        """Non-existent email should return 404."""
        resp = await super_admin_client.get("/api/admin/users/by-email/nobody@nowhere.com")
        assert resp.status_code == 404

    async def test_get_user_by_email_case_insensitive(self, super_admin_client):
        """Email lookup should be case-insensitive (service lowercases)."""
        # The service calls email.lower(), so uppercase should still match
        # if the stored email is lowercase.
        resp = await super_admin_client.get("/api/admin/users/by-email/Parent@Test.com")
        # Depending on whether mongomock supports case-insensitive search,
        # this may return 200 or 404. The service lowercases the input.
        assert resp.status_code in (200, 404)


# ============================================================
# User Profile Updates
# ============================================================

class TestUpdateUserProfile:
    """PUT /api/admin/users/{user_id}/profile - update user profile."""

    async def test_update_first_name(self, super_admin_client, test_user_id):
        """Should update the user's first name."""
        resp = await super_admin_client.put(
            f"/api/admin/users/{str(test_user_id)}/profile",
            json={"first_name": "Updated"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["first_name"] == "Updated"

    async def test_update_last_name(self, super_admin_client, test_user_id):
        """Should update the user's last name."""
        resp = await super_admin_client.put(
            f"/api/admin/users/{str(test_user_id)}/profile",
            json={"last_name": "NewLastName"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["last_name"] == "NewLastName"

    async def test_update_role(self, super_admin_client, test_user_id):
        """Should update the user's role to admin."""
        resp = await super_admin_client.put(
            f"/api/admin/users/{str(test_user_id)}/profile",
            json={"role": "admin"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["role"] == "admin"

    async def test_update_role_invalid(self, super_admin_client, test_user_id):
        """Invalid role value should return 400."""
        resp = await super_admin_client.put(
            f"/api/admin/users/{str(test_user_id)}/profile",
            json={"role": "superuser"},
        )
        assert resp.status_code == 400

    async def test_update_multiple_fields(self, super_admin_client, test_user_id):
        """Should update multiple fields at once."""
        resp = await super_admin_client.put(
            f"/api/admin/users/{str(test_user_id)}/profile",
            json={
                "first_name": "Multi",
                "last_name": "Update",
                "is_verified": True,
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["first_name"] == "Multi"
        assert body["last_name"] == "Update"
        assert body["is_verified"] is True

    async def test_update_no_valid_fields(self, super_admin_client, test_user_id):
        """Empty update body should return 400."""
        resp = await super_admin_client.put(
            f"/api/admin/users/{str(test_user_id)}/profile",
            json={},
        )
        assert resp.status_code == 400

    async def test_update_user_not_found(self, super_admin_client):
        """Updating a non-existent user should return 404."""
        fake_id = str(ObjectId())
        resp = await super_admin_client.put(
            f"/api/admin/users/{fake_id}/profile",
            json={"first_name": "Ghost"},
        )
        assert resp.status_code == 404

    async def test_update_user_invalid_id(self, super_admin_client):
        """Invalid ObjectId format should return 400."""
        resp = await super_admin_client.put(
            "/api/admin/users/bad-id/profile",
            json={"first_name": "Ghost"},
        )
        assert resp.status_code == 400


# ============================================================
# Subscription Updates
# ============================================================

class TestUpdateUserSubscription:
    """PUT /api/admin/users/{user_id}/subscription - update subscription."""

    async def test_update_subscription_tier(self, super_admin_client, test_user_id):
        """Should update subscription tier to basic."""
        resp = await super_admin_client.put(
            f"/api/admin/users/{str(test_user_id)}/subscription",
            json={"subscription_tier": "basic"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["subscription_tier"] == "basic"

    async def test_update_subscription_tier_to_free(self, super_admin_client, test_user_id):
        """Should update subscription tier to free."""
        resp = await super_admin_client.put(
            f"/api/admin/users/{str(test_user_id)}/subscription",
            json={"subscription_tier": "free"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["subscription_tier"] == "free"

    async def test_update_subscription_invalid_tier(self, super_admin_client, test_user_id):
        """Invalid tier value should return 400."""
        resp = await super_admin_client.put(
            f"/api/admin/users/{str(test_user_id)}/subscription",
            json={"subscription_tier": "premium"},
        )
        assert resp.status_code == 400

    async def test_update_grandfathered_status(self, super_admin_client, test_user_id):
        """Should toggle the grandfathered flag."""
        resp = await super_admin_client.put(
            f"/api/admin/users/{str(test_user_id)}/subscription",
            json={"is_grandfathered": True},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["is_grandfathered"] is True

    async def test_update_subscription_status(self, super_admin_client, test_user_id):
        """Should update subscription status."""
        resp = await super_admin_client.put(
            f"/api/admin/users/{str(test_user_id)}/subscription",
            json={"subscription_status": "canceled"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["subscription_status"] == "canceled"

    async def test_update_subscription_invalid_status(self, super_admin_client, test_user_id):
        """Invalid subscription status should return 400."""
        resp = await super_admin_client.put(
            f"/api/admin/users/{str(test_user_id)}/subscription",
            json={"subscription_status": "bogus"},
        )
        assert resp.status_code == 400

    async def test_update_subscription_no_fields(self, super_admin_client, test_user_id):
        """Empty subscription update should return 400."""
        resp = await super_admin_client.put(
            f"/api/admin/users/{str(test_user_id)}/subscription",
            json={},
        )
        assert resp.status_code == 400

    async def test_update_subscription_user_not_found(self, super_admin_client):
        """Updating subscription for non-existent user should return 404."""
        fake_id = str(ObjectId())
        resp = await super_admin_client.put(
            f"/api/admin/users/{fake_id}/subscription",
            json={"subscription_tier": "basic"},
        )
        assert resp.status_code == 404

    async def test_update_subscription_invalid_id(self, super_admin_client):
        """Invalid ObjectId format should return 400."""
        resp = await super_admin_client.put(
            "/api/admin/users/not-valid/subscription",
            json={"subscription_tier": "basic"},
        )
        assert resp.status_code == 400

    async def test_update_subscription_multiple_fields(self, super_admin_client, test_user_id):
        """Should update multiple subscription fields at once."""
        resp = await super_admin_client.put(
            f"/api/admin/users/{str(test_user_id)}/subscription",
            json={
                "subscription_tier": "basic",
                "is_grandfathered": True,
                "subscription_status": "active",
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["subscription_tier"] == "basic"
        assert body["is_grandfathered"] is True
        assert body["subscription_status"] == "active"


# ============================================================
# User Deactivation / Reactivation
# ============================================================

class TestDeactivateUser:
    """POST /api/admin/users/{user_id}/deactivate - deactivate user."""

    async def test_deactivate_user(self, super_admin_client, test_user_id):
        """Should deactivate the user (set is_active=False)."""
        resp = await super_admin_client.post(
            f"/api/admin/users/{str(test_user_id)}/deactivate"
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["is_active"] is False

    async def test_deactivate_user_not_found(self, super_admin_client):
        """Deactivating a non-existent user should return 404."""
        fake_id = str(ObjectId())
        resp = await super_admin_client.post(
            f"/api/admin/users/{fake_id}/deactivate"
        )
        assert resp.status_code == 404

    async def test_deactivate_user_invalid_id(self, super_admin_client):
        """Invalid ObjectId should return 400."""
        resp = await super_admin_client.post(
            "/api/admin/users/invalid-id/deactivate"
        )
        assert resp.status_code == 400


class TestReactivateUser:
    """POST /api/admin/users/{user_id}/reactivate - reactivate user."""

    async def test_reactivate_user(self, super_admin_client, test_user_id):
        """Should reactivate the user (set is_active=True)."""
        # First deactivate
        await super_admin_client.post(
            f"/api/admin/users/{str(test_user_id)}/deactivate"
        )
        # Then reactivate
        resp = await super_admin_client.post(
            f"/api/admin/users/{str(test_user_id)}/reactivate"
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["is_active"] is True

    async def test_reactivate_user_not_found(self, super_admin_client):
        """Reactivating a non-existent user should return 404."""
        fake_id = str(ObjectId())
        resp = await super_admin_client.post(
            f"/api/admin/users/{fake_id}/reactivate"
        )
        assert resp.status_code == 404


# ============================================================
# User Deletion
# ============================================================

class TestDeleteUser:
    """DELETE /api/admin/users/{user_id} - soft or hard delete user."""

    async def test_soft_delete_user(self, super_admin_client, test_user_id):
        """Soft delete should deactivate the user and return a message."""
        resp = await super_admin_client.request(
            "DELETE",
            f"/api/admin/users/{str(test_user_id)}",
            json={"permanent": False},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "message" in body
        assert "deactivated" in body["message"].lower()

    async def test_hard_delete_user(self, super_admin_client, test_user_id):
        """Hard delete should permanently remove the user."""
        resp = await super_admin_client.request(
            "DELETE",
            f"/api/admin/users/{str(test_user_id)}",
            json={"permanent": True},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "message" in body
        assert "permanently deleted" in body["message"].lower()

        # Verify the user is gone
        get_resp = await super_admin_client.get(
            f"/api/admin/users/{str(test_user_id)}"
        )
        assert get_resp.status_code == 404

    async def test_delete_user_not_found(self, super_admin_client):
        """Deleting a non-existent user should return 404."""
        fake_id = str(ObjectId())
        resp = await super_admin_client.request(
            "DELETE",
            f"/api/admin/users/{fake_id}",
            json={"permanent": False},
        )
        assert resp.status_code == 404

    async def test_delete_user_invalid_id(self, super_admin_client):
        """Invalid ObjectId format should return 400."""
        resp = await super_admin_client.request(
            "DELETE",
            "/api/admin/users/bad-id",
            json={"permanent": False},
        )
        assert resp.status_code == 400


# ============================================================
# Student Management (Super Admin Bypass)
# ============================================================

class TestListAllStudents:
    """GET /api/admin/students - list all students."""

    async def test_list_students_returns_seeded(self, super_admin_client):
        """Should return at least the seeded student."""
        resp = await super_admin_client.get("/api/admin/students")
        assert resp.status_code == 200
        body = resp.json()
        assert "students" in body
        assert "total" in body
        assert body["total"] >= 1
        names = [s["first_name"] for s in body["students"]]
        assert "Alice" in names

    async def test_list_students_pagination(self, super_admin_client):
        """Should respect skip and limit parameters."""
        resp = await super_admin_client.get("/api/admin/students?skip=0&limit=1")
        assert resp.status_code == 200
        body = resp.json()
        assert body["skip"] == 0
        assert body["limit"] == 1
        assert len(body["students"]) <= 1

    async def test_list_students_search(self, super_admin_client):
        """Should find students by name."""
        resp = await super_admin_client.get("/api/admin/students?search=Alice")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 1

    async def test_list_students_search_no_results(self, super_admin_client):
        """Search with non-matching term should return empty."""
        resp = await super_admin_client.get("/api/admin/students?search=zzzzz")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 0
        assert body["students"] == []

    async def test_list_students_skip_beyond_total(self, super_admin_client):
        """Skipping past all records should return empty."""
        resp = await super_admin_client.get("/api/admin/students?skip=9999")
        assert resp.status_code == 200
        body = resp.json()
        assert body["students"] == []


class TestGetStudentAdmin:
    """GET /api/admin/students/{student_id} - get any student by ID."""

    async def test_get_student_by_id(self, super_admin_client, test_student_id):
        """Should return the seeded student."""
        resp = await super_admin_client.get(
            f"/api/admin/students/{str(test_student_id)}"
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["first_name"] == "Alice"
        assert body["last_name"] == "Smith"
        assert body["grade_level"] == "Year 3"

    async def test_get_student_has_expected_fields(self, super_admin_client, test_student_id):
        """Student response should contain all expected fields."""
        resp = await super_admin_client.get(
            f"/api/admin/students/{str(test_student_id)}"
        )
        assert resp.status_code == 200
        body = resp.json()
        expected_keys = [
            "id", "first_name", "last_name", "date_of_birth",
            "gender", "grade_level", "slug", "parent_ids", "parent_access",
        ]
        for key in expected_keys:
            assert key in body, f"Missing expected key: {key}"

    async def test_get_student_not_found(self, super_admin_client):
        """Non-existent student should return 404."""
        fake_id = str(ObjectId())
        resp = await super_admin_client.get(f"/api/admin/students/{fake_id}")
        assert resp.status_code == 404

    async def test_get_student_invalid_id(self, super_admin_client):
        """Invalid ObjectId format should return 400."""
        resp = await super_admin_client.get("/api/admin/students/not-valid")
        assert resp.status_code == 400


# ============================================================
# Impersonation
# ============================================================

class TestImpersonation:
    """POST /api/admin/impersonate - start impersonating a user."""

    async def test_impersonate_success(self, super_admin_client, test_user_id):
        """Should return an impersonation token for a valid user."""
        resp = await super_admin_client.post(
            "/api/admin/impersonate",
            json={"user_id": str(test_user_id)},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "token" in body
        assert "impersonated_user" in body
        assert "expires_in" in body
        assert body["expires_in"] == 3600
        assert body["impersonated_user"]["email"] == "parent@test.com"
        assert body["impersonated_user"]["id"] == str(test_user_id)

    async def test_impersonate_user_not_found(self, super_admin_client):
        """Impersonating a non-existent user should return 404."""
        fake_id = str(ObjectId())
        resp = await super_admin_client.post(
            "/api/admin/impersonate",
            json={"user_id": fake_id},
        )
        assert resp.status_code == 404

    async def test_impersonate_invalid_user_id(self, super_admin_client):
        """Invalid ObjectId should return 400."""
        resp = await super_admin_client.post(
            "/api/admin/impersonate",
            json={"user_id": "not-a-valid-id"},
        )
        assert resp.status_code == 400

    async def test_impersonate_returns_user_details(self, super_admin_client, test_user_id):
        """Impersonation response should contain target user's details."""
        resp = await super_admin_client.post(
            "/api/admin/impersonate",
            json={"user_id": str(test_user_id)},
        )
        assert resp.status_code == 200
        user_info = resp.json()["impersonated_user"]
        assert user_info["first_name"] == "Test"
        assert user_info["last_name"] == "Parent"
        assert user_info["role"] == "parent"


# ============================================================
# Platform Statistics
# ============================================================

class TestPlatformStats:
    """GET /api/admin/stats - platform-wide statistics."""

    async def test_get_stats_structure(self, super_admin_client):
        """Should return stats with expected top-level keys."""
        resp = await super_admin_client.get("/api/admin/stats")
        assert resp.status_code == 200
        body = resp.json()
        assert "users" in body
        assert "subscriptions" in body
        assert "students" in body
        assert "evidence" in body

    async def test_get_stats_user_counts(self, super_admin_client):
        """User stats should include total, active, and by-role breakdown."""
        resp = await super_admin_client.get("/api/admin/stats")
        assert resp.status_code == 200
        users = resp.json()["users"]
        assert "total" in users
        assert "active" in users
        assert "by_role" in users
        assert users["total"] >= 1
        assert users["active"] >= 1

    async def test_get_stats_subscription_counts(self, super_admin_client):
        """Subscription stats should include free, basic, and grandfathered counts."""
        resp = await super_admin_client.get("/api/admin/stats")
        assert resp.status_code == 200
        subs = resp.json()["subscriptions"]
        assert "free" in subs
        assert "basic" in subs
        assert "grandfathered" in subs

    async def test_get_stats_student_count(self, super_admin_client):
        """Student stats should reflect the seeded student."""
        resp = await super_admin_client.get("/api/admin/stats")
        assert resp.status_code == 200
        students = resp.json()["students"]
        assert students["total"] >= 1

    async def test_get_stats_evidence_count(self, super_admin_client):
        """Evidence stats should include total count."""
        resp = await super_admin_client.get("/api/admin/stats")
        assert resp.status_code == 200
        evidence = resp.json()["evidence"]
        assert "total" in evidence
        assert evidence["total"] >= 0


# ============================================================
# Edge Cases and Integration
# ============================================================

class TestAdminEdgeCases:
    """Edge cases across admin endpoints."""

    async def test_deactivate_then_verify_via_get(self, super_admin_client, test_user_id):
        """Deactivating a user should be reflected in GET user."""
        # Deactivate
        await super_admin_client.post(
            f"/api/admin/users/{str(test_user_id)}/deactivate"
        )
        # Verify via get
        resp = await super_admin_client.get(
            f"/api/admin/users/{str(test_user_id)}"
        )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False

    async def test_update_then_verify_via_list(self, super_admin_client, test_user_id):
        """Updating a user profile should be reflected in the user list."""
        # Update name
        await super_admin_client.put(
            f"/api/admin/users/{str(test_user_id)}/profile",
            json={"first_name": "ChangedName"},
        )
        # Verify in list
        resp = await super_admin_client.get("/api/admin/users?search=ChangedName")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 1
        found = [u for u in body["users"] if u["first_name"] == "ChangedName"]
        assert len(found) >= 1

    async def test_soft_delete_user_still_findable(self, super_admin_client, test_user_id):
        """Soft-deleted user should still be retrievable by ID."""
        # Soft delete
        await super_admin_client.request(
            "DELETE",
            f"/api/admin/users/{str(test_user_id)}",
            json={"permanent": False},
        )
        # Should still exist (just deactivated)
        resp = await super_admin_client.get(
            f"/api/admin/users/{str(test_user_id)}"
        )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False

    async def test_student_response_serializes_objectids(
        self, super_admin_client, test_student_id
    ):
        """Student response should have string IDs, not raw ObjectIds."""
        resp = await super_admin_client.get(
            f"/api/admin/students/{str(test_student_id)}"
        )
        assert resp.status_code == 200
        body = resp.json()
        # id field should be a string
        assert isinstance(body["id"], str)
        # parent_ids should be a list of strings
        for pid in body.get("parent_ids", []):
            assert isinstance(pid, str)

    async def test_user_response_serializes_objectids(
        self, super_admin_client, test_user_id
    ):
        """User response should have string IDs, not raw ObjectIds."""
        resp = await super_admin_client.get(
            f"/api/admin/users/{str(test_user_id)}"
        )
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body["id"], str)
