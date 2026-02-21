"""
Tests for learning outcome and evidence routes.

Covers outcome retrieval, evidence upload/fetch, batch evidence,
and access control on evidence endpoints.
"""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from bson import ObjectId
from datetime import datetime, timezone
import io


class TestGetStudentLearningOutcome:

    async def test_get_outcome_not_found(self, client, test_student_id):
        """Fetching a non-existent outcome should return empty or 404."""
        resp = await client.get(
            f"/api/learning-outcomes/{str(test_student_id)}/FAKE-CODE-01"
        )
        # Service returns None/empty for non-existent outcomes
        assert resp.status_code in (200, 404)


class TestGetEvidence:

    async def test_get_evidence_empty(self, client, test_student_id):
        """Fetching evidence for an outcome with none should return empty list."""
        resp = await client.get(
            f"/api/learning-outcomes/{str(test_student_id)}/MA2-RN-01/evidence"
        )
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_get_evidence_with_grade_filter(self, client, test_student_id):
        """Grade filter parameter should be accepted."""
        resp = await client.get(
            f"/api/learning-outcomes/{str(test_student_id)}/MA2-RN-01/evidence",
            params={"student_grade": "Year 3"},
        )
        assert resp.status_code == 200


class TestBatchEvidence:

    async def test_batch_evidence_empty(self, client, test_student_id):
        """Batch evidence for non-existent outcomes should return empty dict."""
        resp = await client.get(
            f"/api/evidence/batch/student/{str(test_student_id)}",
            params={"outcomes": "MA2-RN-01,MA2-AR-01"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, dict)

    async def test_batch_evidence_no_outcomes(self, client, test_student_id):
        """Empty outcomes param should return empty dict."""
        resp = await client.get(
            f"/api/evidence/batch/student/{str(test_student_id)}",
            params={"outcomes": ""},
        )
        assert resp.status_code == 200
        assert resp.json() == {}


class TestUploadEvidence:

    @patch("app.routes.learning_outcome_routes.SubscriptionService.can_add_evidence", new_callable=AsyncMock)
    @patch("app.routes.learning_outcome_routes.file_storage_service.upload_file", new_callable=AsyncMock)
    async def test_upload_evidence_success(
        self, mock_upload, mock_can_add, client, seeded_db, test_student_id
    ):
        """Uploading evidence with valid data should succeed."""
        mock_can_add.return_value = (True, "OK")
        mock_upload.return_value = {
            "original_url": "https://cdn.example.com/test.jpg",
            "thumbnail_small_url": "https://cdn.example.com/test_thumb.jpg",
        }

        # Seed a learning outcome
        seeded_db._db["learning_outcomes"].insert_one({
            "_id": ObjectId(),
            "code": "MA2-RN-01",
            "name": "Recognise Numbers",
            "description": "Student can recognise numbers to 10000",
            "subject_id": ObjectId(),
            "grade_level": "Year 3",
            "is_standard": True,
            "created_at": datetime.now(timezone.utc),
        })

        # Create a fake JPEG file (starts with JPEG magic bytes)
        file_content = b"\xff\xd8\xff\xe0" + b"\x00" * 100
        files = {"files": ("test.jpg", io.BytesIO(file_content), "image/jpeg")}
        data = {
            "title": "Math worksheet",
            "description": "Counting exercise",
            "learning_outcome_code": "MA2-RN-01",
            "student_grade": "Year 3",
        }

        resp = await client.post(
            f"/api/learning-outcomes/{str(test_student_id)}/MA2-RN-01/evidence",
            files=files,
            data=data,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "uploaded_files" in body
        assert len(body["uploaded_files"]) == 1

    @patch("app.routes.learning_outcome_routes.SubscriptionService.can_add_evidence", new_callable=AsyncMock)
    async def test_upload_evidence_subscription_limit(
        self, mock_can_add, client, test_student_id
    ):
        """Should return 403 when evidence limit is reached."""
        mock_can_add.return_value = (False, "Evidence limit reached")

        file_content = b"\xff\xd8\xff\xe0" + b"\x00" * 100
        files = {"files": ("test.jpg", io.BytesIO(file_content), "image/jpeg")}
        data = {"title": "Blocked", "description": ""}

        resp = await client.post(
            f"/api/learning-outcomes/{str(test_student_id)}/MA2-RN-01/evidence",
            files=files,
            data=data,
        )
        assert resp.status_code == 403


class TestDeleteEvidence:

    async def test_delete_nonexistent_evidence(self, client, test_student_id):
        """Deleting non-existent evidence should return 404 or 500."""
        fake_evidence_id = str(ObjectId())
        resp = await client.delete(
            f"/api/learning-outcomes/{str(test_student_id)}/MA2-RN-01/evidence/{fake_evidence_id}"
        )
        assert resp.status_code in (404, 500)


class TestEvidenceAccessControl:

    async def test_evidence_unauthenticated(self, unauthenticated_client, test_student_id):
        """Unauthenticated requests to evidence endpoints should return 401."""
        resp = await unauthenticated_client.get(
            f"/api/learning-outcomes/{str(test_student_id)}/MA2-RN-01/evidence"
        )
        assert resp.status_code == 401
