"""
Tests for the file routes (signed URLs, file existence).

Covers:
- GET  /api/files/signed-url
- GET  /api/files/check-existence
- POST /api/signed-url
"""

import pytest
import pytest_asyncio
from unittest.mock import patch, MagicMock, AsyncMock
from httpx import AsyncClient, ASGITransport


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture()
async def super_admin_client(seeded_db, super_admin_user):
    """An authenticated HTTPX AsyncClient with super_admin privileges."""
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


# ---------------------------------------------------------------------------
# POST /api/signed-url (SignedUrlRequest body)
# ---------------------------------------------------------------------------

class TestSignedUrlPost:
    """Tests for POST /api/signed-url."""

    @pytest.mark.asyncio
    async def test_signed_url_success(self, client):
        """Should return signed URL on success."""
        with patch(
            "app.routes.file_routes.FileStorageService"
        ) as MockFSS:
            instance = MockFSS.return_value
            instance.generate_user_signed_url = AsyncMock(
                return_value="https://example.com/signed"
            )

            response = await client.post(
                "/api/files/signed-url",
                json={"file_path": "evidence/test.jpg"},
            )

        assert response.status_code == 200
        data = response.json()
        assert "signed_url" in data
        assert "expires_at" in data

    @pytest.mark.asyncio
    async def test_signed_url_unauthenticated(self, unauthenticated_client):
        """Should return 401 for unauthenticated requests."""
        response = await unauthenticated_client.post(
            "/api/files/signed-url",
            json={"file_path": "test.jpg"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_signed_url_missing_path(self, client):
        """Should return 422 when file_path is missing."""
        response = await client.post("/api/files/signed-url", json={})
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_signed_url_internal_error(self, client):
        """Should return 500 when storage service fails."""
        with patch(
            "app.routes.file_routes.FileStorageService"
        ) as MockFSS:
            instance = MockFSS.return_value
            instance.generate_user_signed_url = AsyncMock(
                side_effect=Exception("Storage error")
            )

            response = await client.post(
                "/api/files/signed-url",
                json={"file_path": "evidence/test.jpg"},
            )

        assert response.status_code == 500


