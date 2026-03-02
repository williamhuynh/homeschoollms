"""
Tests for report routes (/api/reports/*).

Covers report listing, retrieval, generation, updates, and deletion.
"""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from bson import ObjectId
from datetime import datetime, timezone


class TestListReports:

    async def test_list_reports(self, client, test_student_id):
        """GET /api/reports/{student_id} should return the seeded report."""
        resp = await client.get(f"/api/reports/{str(test_student_id)}")
        assert resp.status_code == 200
        reports = resp.json()
        assert isinstance(reports, list)
        assert len(reports) >= 1

    async def test_list_reports_nonexistent_student(self, client):
        """Reports for a non-existent student should return 404 or empty."""
        fake_id = str(ObjectId())
        resp = await client.get(f"/api/reports/{fake_id}")
        # Returns 403 because user has no access, or 404 if student not found
        assert resp.status_code in (403, 404)

    async def test_list_reports_unauthenticated(self, unauthenticated_client, test_student_id):
        """Unauthenticated request should return 401."""
        resp = await unauthenticated_client.get(f"/api/reports/{str(test_student_id)}")
        assert resp.status_code == 401


class TestGetReport:

    async def test_get_report_by_id(self, client, test_student_id, test_report_id):
        """GET /api/reports/{student_id}/{report_id} should return the report."""
        resp = await client.get(
            f"/api/reports/{str(test_student_id)}/{str(test_report_id)}"
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["title"] == "Annual Report 2025"
        assert body["report_period"] == "annual"
        assert body["status"] == "draft"

    async def test_get_report_wrong_student(self, client, test_report_id):
        """Report fetched with wrong student_id should return 403."""
        wrong_student_id = str(ObjectId())
        resp = await client.get(
            f"/api/reports/{wrong_student_id}/{str(test_report_id)}"
        )
        # Should fail access check since user doesn't own this student
        assert resp.status_code in (403, 404)

    async def test_get_nonexistent_report(self, client, test_student_id):
        """Non-existent report_id should return 404 or 500."""
        fake_report_id = str(ObjectId())
        resp = await client.get(
            f"/api/reports/{str(test_student_id)}/{fake_report_id}"
        )
        assert resp.status_code in (404, 500)


class TestGenerateReport:

    @patch("app.routes.report_routes.SubscriptionService.can_generate_reports", new_callable=AsyncMock)
    @patch("app.routes.report_routes.ReportService.generate_report", new_callable=AsyncMock)
    async def test_generate_report_success(
        self, mock_generate, mock_can_generate, client, test_student_id, test_user_id
    ):
        """Report generation with valid subscription should succeed."""
        from app.models.schemas.report import StudentReport

        mock_can_generate.return_value = (True, "OK")
        mock_generate.return_value = StudentReport(
            _id=ObjectId(),
            student_id=test_student_id,
            report_period="annual",
            title="Generated Report",
            learning_area_summaries=[],
            generated_at=datetime.now(timezone.utc),
            last_modified=datetime.now(timezone.utc),
            created_by=test_user_id,
            created_at=datetime.now(timezone.utc),
            status="draft",
            grade_level="Year 3",
            version=1,
            generation_time_seconds=5.2,
        )

        resp = await client.post(
            f"/api/reports/{str(test_student_id)}/generate",
            json={
                "report_period": "annual",
                "grade_level": "Year 3",
            },
        )
        assert resp.status_code == 200

    @patch("app.routes.report_routes.SubscriptionService.can_generate_reports", new_callable=AsyncMock)
    async def test_generate_report_subscription_blocked(
        self, mock_can_generate, client, test_student_id
    ):
        """Should return 403 when subscription doesn't allow reports."""
        mock_can_generate.return_value = (False, "Upgrade to generate reports")

        resp = await client.post(
            f"/api/reports/{str(test_student_id)}/generate",
            json={
                "report_period": "annual",
                "grade_level": "Year 3",
            },
        )
        assert resp.status_code == 403


class TestUpdateReport:

    async def test_update_report_title(self, client, test_student_id, test_report_id):
        """PUT /api/reports/{student_id}/{report_id}/title should update title."""
        resp = await client.put(
            f"/api/reports/{str(test_student_id)}/{str(test_report_id)}/title",
            json={"title": "Updated Title"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["title"] == "Updated Title"

    async def test_update_report_status(self, client, test_student_id, test_report_id):
        """PUT /api/reports/{student_id}/{report_id}/status should update status."""
        resp = await client.put(
            f"/api/reports/{str(test_student_id)}/{str(test_report_id)}/status",
            json={"status": "submitted"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "submitted"

    async def test_update_report_overview(self, client, test_student_id, test_report_id):
        """PUT /api/reports/{student_id}/{report_id}/overview should update overview."""
        resp = await client.put(
            f"/api/reports/{str(test_student_id)}/{str(test_report_id)}/overview",
            json={"parent_overview": "Great progress this year!"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["parent_overview"] == "Great progress this year!"


class TestDeleteReport:

    async def test_delete_report(self, client, test_student_id, test_report_id):
        """DELETE /api/reports/{student_id}/{report_id} should remove the report."""
        resp = await client.delete(
            f"/api/reports/{str(test_student_id)}/{str(test_report_id)}"
        )
        assert resp.status_code == 200
        assert "deleted" in resp.json()["message"].lower()

    async def test_delete_nonexistent_report(self, client, test_student_id):
        """Deleting a non-existent report should return 404 or 500."""
        fake_id = str(ObjectId())
        resp = await client.delete(
            f"/api/reports/{str(test_student_id)}/{fake_id}"
        )
        assert resp.status_code in (404, 500)
