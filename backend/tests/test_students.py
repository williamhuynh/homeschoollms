"""
Tests for student routes (/api/students/*).

Covers CRUD operations, slug resolution, parent access management,
and subscription limit enforcement.
"""

import pytest
from unittest.mock import patch, AsyncMock
from bson import ObjectId
from datetime import datetime, timezone


class TestListStudents:

    async def test_list_students_returns_seeded_student(self, client):
        """GET /api/students should return the test student."""
        resp = await client.get("/api/students")
        assert resp.status_code == 200
        students = resp.json()
        assert isinstance(students, list)
        assert len(students) >= 1
        names = [s["first_name"] for s in students]
        assert "Alice" in names

    async def test_list_students_trailing_slash(self, client):
        """GET /api/students/ with trailing slash should also work."""
        resp = await client.get("/api/students/")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    async def test_list_students_unauthenticated(self, unauthenticated_client):
        """Unauthenticated request should return 401."""
        resp = await unauthenticated_client.get("/api/students")
        assert resp.status_code == 401


class TestGetStudent:

    async def test_get_student_by_id(self, client, test_student_id):
        """GET /api/students/{id} should return the student."""
        resp = await client.get(f"/api/students/{str(test_student_id)}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["first_name"] == "Alice"
        assert body["last_name"] == "Smith"

    async def test_get_student_by_slug_explicit(self, client):
        """GET /api/students/by-slug/{slug} should work."""
        resp = await client.get("/api/students/by-slug/alice-smith")
        assert resp.status_code == 200
        body = resp.json()
        assert body["first_name"] == "Alice"

    async def test_get_student_not_found(self, client):
        """Nonexistent student should return 404."""
        fake_id = str(ObjectId())
        resp = await client.get(f"/api/students/{fake_id}")
        assert resp.status_code in (404, 500)

    async def test_get_student_for_parent(self, client):
        """GET /api/students/for-parent should return students."""
        resp = await client.get("/api/students/for-parent")
        assert resp.status_code == 200
        students = resp.json()
        assert isinstance(students, list)
        assert len(students) >= 1


class TestCreateStudent:

    @patch("app.routes.student_routes.SubscriptionService.can_add_student", new_callable=AsyncMock)
    async def test_create_student_success(self, mock_can_add, client, test_user_id):
        """Creating a student should return the new student with a slug."""
        mock_can_add.return_value = (True, "OK")

        resp = await client.post(
            "/api/students/",
            json={
                "first_name": "Bob",
                "last_name": "Jones",
                "date_of_birth": "2018-06-20",
                "gender": "male",
                "grade_level": "Year 2",
                "organization_id": None,
                "family_id": None,
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["first_name"] == "Bob"
        assert body["last_name"] == "Jones"
        assert "slug" in body
        assert body["slug"].startswith("bob-jones")

    @patch("app.routes.student_routes.SubscriptionService.can_add_student", new_callable=AsyncMock)
    async def test_create_student_subscription_limit(self, mock_can_add, client):
        """Should return 403 when subscription limit is reached."""
        mock_can_add.return_value = (False, "Student limit reached")

        resp = await client.post(
            "/api/students/",
            json={
                "first_name": "Blocked",
                "last_name": "User",
                "date_of_birth": "2019-01-01",
                "gender": "other",
                "grade_level": "Year 1",
                "organization_id": None,
                "family_id": None,
            },
        )
        assert resp.status_code == 403
        assert "limit" in resp.json()["detail"].lower()


class TestUpdateStudent:

    async def test_update_student_grade(self, client, test_student_id):
        """PATCH /api/students/{id}/grade should update the grade."""
        resp = await client.patch(
            f"/api/students/{str(test_student_id)}/grade",
            json={"new_grade_level": "Year 4"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["grade_level"] == "Year 4"

    async def test_update_student_details(self, client, test_student_id):
        """PATCH /api/students/{id} should update the name."""
        resp = await client.patch(
            f"/api/students/{str(test_student_id)}",
            json={"first_name": "Alicia"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["first_name"] == "Alicia"


class TestDeleteStudent:

    async def test_delete_student(self, client, test_student_id):
        """DELETE /api/students/{id} should remove the student."""
        resp = await client.delete(f"/api/students/{str(test_student_id)}")
        assert resp.status_code == 200

        # Verify it's gone
        resp2 = await client.get(f"/api/students/{str(test_student_id)}")
        assert resp2.status_code in (404, 500)


class TestParentAccess:

    async def test_get_student_parents(self, client, test_student_id):
        """GET /api/students/{id}/parents should list parent access."""
        resp = await client.get(f"/api/students/{str(test_student_id)}/parents")
        assert resp.status_code == 200
        parents = resp.json()
        assert isinstance(parents, list)
        assert len(parents) >= 1

    async def test_add_parent_access_nonexistent_email(self, client, test_student_id):
        """Adding access for a non-existent email should fail."""
        resp = await client.post(
            f"/api/students/{str(test_student_id)}/parents",
            json={
                "email": "nonexistent@test.com",
                "access_level": "view",
            },
        )
        # Should fail because the user doesn't exist
        assert resp.status_code in (404, 400, 500)
