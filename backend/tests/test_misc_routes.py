"""
Tests for miscellaneous route files: content, progress, and subject routes.

Covers:
- Content routes: POST /api/content/, GET /api/content/subject/{subject_id}
- Progress routes: POST /api/progress/{student_id}/{content_id}, GET /api/progress/{student_id}
- Subject routes: POST /api/subjects/, GET /api/subjects/, GET /api/subjects/{subject_id}/hierarchy

Each route group tests authentication enforcement and successful operations
with mocked service layers.
"""

import pytest
from unittest.mock import patch, AsyncMock
from bson import ObjectId
from datetime import date, datetime, timezone


# ---------------------------------------------------------------------------
# Content Routes
# ---------------------------------------------------------------------------


class TestContentCreateAuth:
    """POST /api/content/ requires authentication."""

    async def test_create_content_unauthenticated(self, unauthenticated_client):
        """Unauthenticated request to create content should return 401."""
        payload = {
            "title": "Intro to Fractions",
            "description": "A video about fractions",
            "subject_id": str(ObjectId()),
            "content_type": "video",
            "content_date": "2026-02-21",
            "created_by": str(ObjectId()),
            "organization_id": None,
            "learning_outcome_ids": [],
            "difficulty_level": 1,
            "estimated_duration": 15,
            "prerequisites": [],
            "tags": ["maths"],
            "metadata": {},
        }
        resp = await unauthenticated_client.post("/api/content/", json=payload)
        assert resp.status_code == 401


class TestContentCreate:
    """POST /api/content/ with authenticated client."""

    @patch(
        "app.routes.content_routes.ContentService.create_content",
        new_callable=AsyncMock,
    )
    async def test_create_content_success(self, mock_create, client, test_user_id):
        """Creating content should delegate to ContentService and return the result."""
        subject_id = ObjectId()
        content_id = ObjectId()
        now = datetime.now(timezone.utc)

        mock_create.return_value = {
            "_id": str(content_id),
            "title": "Intro to Fractions",
            "description": "A video about fractions",
            "subject_id": str(subject_id),
            "content_type": "video",
            "content_date": "2026-02-21",
            "created_by": str(test_user_id),
            "organization_id": None,
            "learning_outcome_ids": [],
            "difficulty_level": 1,
            "estimated_duration": 15,
            "prerequisites": [],
            "tags": ["maths"],
            "metadata": {},
            "created_at": now.isoformat(),
        }

        payload = {
            "title": "Intro to Fractions",
            "description": "A video about fractions",
            "subject_id": str(subject_id),
            "content_type": "video",
            "content_date": "2026-02-21",
            "created_by": str(test_user_id),
            "organization_id": None,
            "learning_outcome_ids": [],
            "difficulty_level": 1,
            "estimated_duration": 15,
            "prerequisites": [],
            "tags": ["maths"],
            "metadata": {},
        }

        resp = await client.post("/api/content/", json=payload)
        assert resp.status_code == 200
        body = resp.json()
        assert body["title"] == "Intro to Fractions"
        assert body["content_type"] == "video"
        mock_create.assert_called_once()


class TestContentGetBySubjectAuth:
    """GET /api/content/subject/{subject_id} requires authentication."""

    async def test_get_subject_content_unauthenticated(self, unauthenticated_client):
        """Unauthenticated request should return 401."""
        resp = await unauthenticated_client.get(
            f"/api/content/subject/{ObjectId()}"
        )
        assert resp.status_code == 401


class TestContentGetBySubject:
    """GET /api/content/subject/{subject_id} with authenticated client."""

    @patch(
        "app.routes.content_routes.ContentService.get_subject_content",
        new_callable=AsyncMock,
    )
    async def test_get_subject_content_returns_list(self, mock_get, client):
        """Should return a list of content items for the given subject."""
        subject_id = ObjectId()
        content_id = ObjectId()
        now = datetime.now(timezone.utc)

        mock_get.return_value = [
            {
                "_id": str(content_id),
                "title": "Fractions Worksheet",
                "description": "Practice worksheet",
                "subject_id": str(subject_id),
                "content_type": "exercise",
                "content_date": "2026-02-20",
                "created_by": str(ObjectId()),
                "organization_id": None,
                "learning_outcome_ids": [],
                "difficulty_level": 2,
                "estimated_duration": 30,
                "prerequisites": [],
                "tags": ["maths", "fractions"],
                "metadata": {},
                "created_at": now.isoformat(),
            }
        ]

        resp = await client.get(f"/api/content/subject/{subject_id}")
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) == 1
        assert body[0]["title"] == "Fractions Worksheet"
        mock_get.assert_called_once_with(str(subject_id), None)

    @patch(
        "app.routes.content_routes.ContentService.get_subject_content",
        new_callable=AsyncMock,
    )
    async def test_get_subject_content_empty(self, mock_get, client):
        """Should return an empty list when no content exists for a subject."""
        mock_get.return_value = []

        resp = await client.get(f"/api/content/subject/{ObjectId()}")
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) == 0

    @patch(
        "app.routes.content_routes.ContentService.get_subject_content",
        new_callable=AsyncMock,
    )
    async def test_get_subject_content_with_grade_level(self, mock_get, client):
        """Should pass grade_level query param to the service."""
        mock_get.return_value = []
        subject_id = ObjectId()

        resp = await client.get(
            f"/api/content/subject/{subject_id}",
            params={"grade_level": "Year 3"},
        )
        assert resp.status_code == 200
        mock_get.assert_called_once_with(str(subject_id), "Year 3")


# ---------------------------------------------------------------------------
# Progress Routes
# ---------------------------------------------------------------------------


class TestProgressUpdateAuth:
    """POST /api/progress/{student_id}/{content_id} requires authentication."""

    async def test_update_progress_unauthenticated(self, unauthenticated_client):
        """Unauthenticated request to update progress should return 401."""
        student_id = ObjectId()
        content_id = ObjectId()
        resp = await unauthenticated_client.post(
            f"/api/progress/{student_id}/{content_id}",
            params={"status": "in_progress"},
        )
        assert resp.status_code == 401


class TestProgressUpdate:
    """POST /api/progress/{student_id}/{content_id} with authenticated client."""

    @patch(
        "app.routes.progress_routes.ProgressService.update_progress",
        new_callable=AsyncMock,
    )
    async def test_update_progress_in_progress(self, mock_update, client):
        """Updating progress with 'in_progress' status should succeed."""
        student_id = ObjectId()
        content_id = ObjectId()
        now = datetime.now(timezone.utc)

        mock_update.return_value = {
            "_id": str(ObjectId()),
            "student_id": str(student_id),
            "content_id": str(content_id),
            "status": "in_progress",
            "start_date": now.isoformat(),
            "completion_date": None,
            "score": None,
            "time_spent": 0,
            "attempts": 1,
            "metadata": {},
            "created_at": now.isoformat(),
        }

        resp = await client.post(
            f"/api/progress/{student_id}/{content_id}",
            params={"status": "in_progress"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "in_progress"
        assert body["score"] is None
        mock_update.assert_called_once_with(
            str(student_id), str(content_id), "in_progress", None
        )

    @patch(
        "app.routes.progress_routes.ProgressService.update_progress",
        new_callable=AsyncMock,
    )
    async def test_update_progress_completed_with_score(self, mock_update, client):
        """Updating progress with 'completed' status and a score should succeed."""
        student_id = ObjectId()
        content_id = ObjectId()
        now = datetime.now(timezone.utc)

        mock_update.return_value = {
            "_id": str(ObjectId()),
            "student_id": str(student_id),
            "content_id": str(content_id),
            "status": "completed",
            "start_date": now.isoformat(),
            "completion_date": now.isoformat(),
            "score": 95.5,
            "time_spent": 1200,
            "attempts": 2,
            "metadata": {},
            "created_at": now.isoformat(),
        }

        resp = await client.post(
            f"/api/progress/{student_id}/{content_id}",
            params={"status": "completed", "score": 95.5},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "completed"
        assert body["score"] == 95.5
        assert body["completion_date"] is not None
        mock_update.assert_called_once_with(
            str(student_id), str(content_id), "completed", 95.5
        )

    @patch(
        "app.routes.progress_routes.ProgressService.update_progress",
        new_callable=AsyncMock,
    )
    async def test_update_progress_not_started(self, mock_update, client):
        """Updating progress with 'not_started' status should succeed."""
        student_id = ObjectId()
        content_id = ObjectId()
        now = datetime.now(timezone.utc)

        mock_update.return_value = {
            "_id": str(ObjectId()),
            "student_id": str(student_id),
            "content_id": str(content_id),
            "status": "not_started",
            "start_date": None,
            "completion_date": None,
            "score": None,
            "time_spent": 0,
            "attempts": 0,
            "metadata": {},
            "created_at": now.isoformat(),
        }

        resp = await client.post(
            f"/api/progress/{student_id}/{content_id}",
            params={"status": "not_started"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "not_started"
        assert body["completion_date"] is None
        assert body["score"] is None


class TestProgressGetAuth:
    """GET /api/progress/{student_id} requires authentication."""

    async def test_get_progress_unauthenticated(self, unauthenticated_client):
        """Unauthenticated request to get progress should return 401."""
        resp = await unauthenticated_client.get(
            f"/api/progress/{ObjectId()}"
        )
        assert resp.status_code == 401


class TestProgressGet:
    """GET /api/progress/{student_id} with authenticated client."""

    @patch(
        "app.routes.progress_routes.ProgressService.get_student_progress",
        new_callable=AsyncMock,
    )
    async def test_get_student_progress_returns_list(self, mock_get, client):
        """Should return a list of progress records for the student."""
        student_id = ObjectId()
        now = datetime.now(timezone.utc)

        mock_get.return_value = [
            {
                "_id": str(ObjectId()),
                "student_id": str(student_id),
                "content_id": str(ObjectId()),
                "status": "completed",
                "start_date": now.isoformat(),
                "completion_date": now.isoformat(),
                "score": 88.0,
                "time_spent": 600,
                "attempts": 1,
                "metadata": {},
                "created_at": now.isoformat(),
            },
            {
                "_id": str(ObjectId()),
                "student_id": str(student_id),
                "content_id": str(ObjectId()),
                "status": "in_progress",
                "start_date": now.isoformat(),
                "completion_date": None,
                "score": None,
                "time_spent": 300,
                "attempts": 1,
                "metadata": {},
                "created_at": now.isoformat(),
            },
        ]

        resp = await client.get(f"/api/progress/{student_id}")
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) == 2
        assert body[0]["status"] == "completed"
        assert body[1]["status"] == "in_progress"
        mock_get.assert_called_once_with(str(student_id), None)

    @patch(
        "app.routes.progress_routes.ProgressService.get_student_progress",
        new_callable=AsyncMock,
    )
    async def test_get_student_progress_empty(self, mock_get, client):
        """Should return an empty list when no progress exists."""
        mock_get.return_value = []

        resp = await client.get(f"/api/progress/{ObjectId()}")
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) == 0

    @patch(
        "app.routes.progress_routes.ProgressService.get_student_progress",
        new_callable=AsyncMock,
    )
    async def test_get_student_progress_with_subject_filter(self, mock_get, client):
        """Should pass subject_id query param to the service."""
        mock_get.return_value = []
        student_id = ObjectId()
        subject_id = ObjectId()

        resp = await client.get(
            f"/api/progress/{student_id}",
            params={"subject_id": str(subject_id)},
        )
        assert resp.status_code == 200
        mock_get.assert_called_once_with(str(student_id), str(subject_id))


# ---------------------------------------------------------------------------
# Subject Routes
# ---------------------------------------------------------------------------


class TestSubjectCreateAuth:
    """POST /api/subjects/ requires authentication with an organization."""

    async def test_create_subject_unauthenticated(self, unauthenticated_client):
        """Unauthenticated request to create a subject should return 401."""
        payload = {
            "name": "Mathematics",
            "code": "MATH",
            "description": "Core mathematics curriculum",
            "grade_levels": ["Year 3", "Year 4"],
            "organization_id": None,
            "is_standard": True,
            "parent_subject_id": None,
        }
        resp = await unauthenticated_client.post("/api/subjects/", json=payload)
        assert resp.status_code == 401

    async def test_create_subject_no_org(self, client):
        """Authenticated user without organization_id should get 403.

        The default test_user fixture has organization_id=None, so the
        get_current_user_with_org dependency should reject the request.
        """
        payload = {
            "name": "Mathematics",
            "code": "MATH",
            "description": "Core maths",
            "grade_levels": ["Year 3"],
            "organization_id": None,
            "is_standard": True,
            "parent_subject_id": None,
        }
        resp = await client.post("/api/subjects/", json=payload)
        assert resp.status_code == 403
        assert "organization" in resp.json()["detail"].lower()


class TestSubjectCreate:
    """POST /api/subjects/ with an org-associated user."""

    @patch(
        "app.routes.subject_routes.SubjectService.create_subject",
        new_callable=AsyncMock,
    )
    async def test_create_subject_success(self, mock_create, client):
        """Creating a subject should succeed when user has an organization.

        We override get_current_user_with_org directly so the dependency
        returns a user with a valid organization_id.
        """
        from app.main import app
        from app.utils.auth_utils import get_current_user_with_org
        from app.models.schemas.user import UserInDB

        org_id = ObjectId()
        org_user = UserInDB(
            _id=ObjectId(),
            email="orguser@test.com",
            first_name="Org",
            last_name="User",
            hashed_password="$2b$12$fakehash",
            role="parent",
            is_active=True,
            is_verified=True,
            subscription_tier="basic",
            subscription_status="active",
            organization_id=org_id,
        )

        app.dependency_overrides[get_current_user_with_org] = lambda: org_user

        subject_id = ObjectId()
        now = datetime.now(timezone.utc)

        mock_create.return_value = {
            "_id": str(subject_id),
            "name": "Mathematics",
            "code": "MATH",
            "description": "Core mathematics curriculum",
            "grade_levels": ["Year 3", "Year 4"],
            "organization_id": str(org_id),
            "is_standard": True,
            "parent_subject_id": None,
            "created_at": now.isoformat(),
        }

        payload = {
            "name": "Mathematics",
            "code": "MATH",
            "description": "Core mathematics curriculum",
            "grade_levels": ["Year 3", "Year 4"],
            "organization_id": str(org_id),
            "is_standard": True,
            "parent_subject_id": None,
        }

        resp = await client.post("/api/subjects/", json=payload)
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == "Mathematics"
        assert body["code"] == "MATH"
        mock_create.assert_called_once()

        # Clean up override
        app.dependency_overrides.pop(get_current_user_with_org, None)


class TestSubjectGetAuth:
    """GET /api/subjects/ requires authentication."""

    async def test_get_subjects_unauthenticated(self, unauthenticated_client):
        """Unauthenticated request should return 401."""
        resp = await unauthenticated_client.get("/api/subjects/")
        assert resp.status_code == 401


class TestSubjectGet:
    """GET /api/subjects/ with authenticated client."""

    @patch(
        "app.routes.subject_routes.SubjectService.get_subjects",
        new_callable=AsyncMock,
    )
    async def test_get_subjects_returns_list(self, mock_get, client):
        """Should return a list of subjects."""
        now = datetime.now(timezone.utc)
        mock_get.return_value = [
            {
                "_id": str(ObjectId()),
                "name": "Mathematics",
                "code": "MATH",
                "description": "Core maths",
                "grade_levels": ["Year 3", "Year 4"],
                "organization_id": None,
                "is_standard": True,
                "parent_subject_id": None,
                "created_at": now.isoformat(),
            },
            {
                "_id": str(ObjectId()),
                "name": "English",
                "code": "ENG",
                "description": "English language arts",
                "grade_levels": ["Year 3", "Year 4"],
                "organization_id": None,
                "is_standard": True,
                "parent_subject_id": None,
                "created_at": now.isoformat(),
            },
        ]

        resp = await client.get("/api/subjects/")
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) == 2
        names = [s["name"] for s in body]
        assert "Mathematics" in names
        assert "English" in names
        # test_user has no organization_id, so org_id=None is passed
        mock_get.assert_called_once_with(None, None)

    @patch(
        "app.routes.subject_routes.SubjectService.get_subjects",
        new_callable=AsyncMock,
    )
    async def test_get_subjects_empty(self, mock_get, client):
        """Should return an empty list when no subjects exist."""
        mock_get.return_value = []

        resp = await client.get("/api/subjects/")
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) == 0

    @patch(
        "app.routes.subject_routes.SubjectService.get_subjects",
        new_callable=AsyncMock,
    )
    async def test_get_subjects_with_grade_level(self, mock_get, client):
        """Should pass grade_level query param to the service."""
        mock_get.return_value = []

        resp = await client.get("/api/subjects/", params={"grade_level": "Year 5"})
        assert resp.status_code == 200
        mock_get.assert_called_once_with(None, "Year 5")


class TestSubjectHierarchyAuth:
    """GET /api/subjects/{subject_id}/hierarchy requires authentication."""

    async def test_get_hierarchy_unauthenticated(self, unauthenticated_client):
        """Unauthenticated request should return 401."""
        resp = await unauthenticated_client.get(
            f"/api/subjects/{ObjectId()}/hierarchy"
        )
        assert resp.status_code == 401


class TestSubjectHierarchy:
    """GET /api/subjects/{subject_id}/hierarchy with authenticated client."""

    @patch(
        "app.routes.subject_routes.SubjectService.get_subject_hierarchy",
        new_callable=AsyncMock,
    )
    async def test_get_hierarchy_returns_list(self, mock_hierarchy, client):
        """Should return the subject hierarchy as a list."""
        parent_id = ObjectId()
        child_id = ObjectId()
        now = datetime.now(timezone.utc)

        mock_hierarchy.return_value = [
            {
                "_id": str(parent_id),
                "name": "Mathematics",
                "code": "MATH",
                "description": "Core maths",
                "grade_levels": ["Year 3", "Year 4"],
                "organization_id": None,
                "is_standard": True,
                "parent_subject_id": None,
                "created_at": now.isoformat(),
            },
            {
                "_id": str(child_id),
                "name": "Algebra",
                "code": "MATH-ALG",
                "description": "Algebra strand",
                "grade_levels": ["Year 3", "Year 4"],
                "organization_id": None,
                "is_standard": True,
                "parent_subject_id": str(parent_id),
                "created_at": now.isoformat(),
            },
        ]

        resp = await client.get(f"/api/subjects/{parent_id}/hierarchy")
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) == 2
        assert body[0]["name"] == "Mathematics"
        assert body[1]["name"] == "Algebra"
        assert body[1]["parent_subject_id"] == str(parent_id)
        mock_hierarchy.assert_called_once_with(str(parent_id))

    @patch(
        "app.routes.subject_routes.SubjectService.get_subject_hierarchy",
        new_callable=AsyncMock,
    )
    async def test_get_hierarchy_empty(self, mock_hierarchy, client):
        """Should return an empty list when no hierarchy exists."""
        mock_hierarchy.return_value = []

        resp = await client.get(f"/api/subjects/{ObjectId()}/hierarchy")
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) == 0
