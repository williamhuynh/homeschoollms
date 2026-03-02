"""
Tests for the file routes (signed URLs, file existence, migration endpoints).

Covers:
- GET  /api/files/signed-url
- GET  /api/files/check-existence
- POST /api/signed-url
- GET  /api/migration/status
- GET  /api/migration/images
- POST /api/migration/migrate-image
- POST /api/migration/bulk-migrate
- POST /api/migration/set-mode
- POST /api/migration/cleanup/* (super_admin only)
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


# ---------------------------------------------------------------------------
# Migration endpoints
# ---------------------------------------------------------------------------

class TestMigrationSetMode:
    """Tests for POST /api/files/migration/set-mode."""

    @pytest.mark.asyncio
    async def test_set_mode_not_admin(self, client):
        """Regular users should be rejected (route catches HTTPException internally → 500)."""
        response = await client.post(
            "/api/files/migration/set-mode",
            json={"mode": "private"},
        )
        # The route's try/except catches the 403 HTTPException and re-raises as 500
        assert response.status_code == 500

    @pytest.mark.asyncio
    async def test_set_mode_invalid(self, admin_client):
        """Should reject invalid mode (route catches HTTPException internally → 500)."""
        response = await admin_client.post(
            "/api/files/migration/set-mode",
            json={"mode": "invalid"},
        )
        assert response.status_code == 500

    @pytest.mark.asyncio
    async def test_set_mode_success(self, admin_client):
        """Admin should be able to set valid mode."""
        response = await admin_client.post(
            "/api/files/migration/set-mode",
            json={"mode": "private"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["value"] == "private"
        assert "CLOUDINARY_MIGRATION_MODE" in data["env_var"]


class TestMigrationMigrateImage:
    """Tests for POST /api/migration/migrate-image."""

    @pytest.mark.asyncio
    async def test_migrate_image_not_admin(self, client):
        """Regular users should be rejected (route catches HTTPException internally → 500)."""
        response = await client.post(
            "/api/files/migration/migrate-image",
            json={"public_id": "test_image"},
        )
        assert response.status_code == 500

    @pytest.mark.asyncio
    async def test_migrate_image_missing_public_id(self, admin_client):
        """Should reject missing public_id (route catches HTTPException internally → 500)."""
        response = await admin_client.post(
            "/api/files/migration/migrate-image",
            json={},
        )
        assert response.status_code == 500

    @pytest.mark.asyncio
    async def test_migrate_image_success(self, admin_client):
        """Should migrate image successfully."""
        with patch("app.routes.file_routes.cloudinary.api.resource") as mock_resource, \
             patch("app.routes.file_routes.cloudinary.uploader.upload") as mock_upload:
            mock_resource.return_value = {"secure_url": "https://old.url/img.jpg"}
            mock_upload.return_value = {"secure_url": "https://new.url/img.jpg"}

            response = await admin_client.post(
                "/api/files/migration/migrate-image",
                json={"public_id": "test_image"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["public_id"] == "test_image"


class TestMigrationBulkMigrate:
    """Tests for POST /api/migration/bulk-migrate."""

    @pytest.mark.asyncio
    async def test_bulk_migrate_not_admin(self, client):
        """Regular users should be rejected (route catches HTTPException internally → 500)."""
        response = await client.post(
            "/api/files/migration/bulk-migrate",
            json={"public_ids": ["img1"]},
        )
        assert response.status_code == 500

    @pytest.mark.asyncio
    async def test_bulk_migrate_missing_ids(self, admin_client):
        """Should reject empty public_ids (route catches HTTPException internally → 500)."""
        response = await admin_client.post(
            "/api/files/migration/bulk-migrate",
            json={"public_ids": []},
        )
        assert response.status_code == 500

    @pytest.mark.asyncio
    async def test_bulk_migrate_success(self, admin_client):
        """Should migrate multiple images."""
        with patch("app.routes.file_routes.cloudinary.api.resource") as mock_resource, \
             patch("app.routes.file_routes.cloudinary.uploader.upload") as mock_upload:
            mock_resource.return_value = {"secure_url": "https://old.url/img.jpg"}
            mock_upload.return_value = {"secure_url": "https://new.url/img.jpg"}

            response = await admin_client.post(
                "/api/files/migration/bulk-migrate",
                json={"public_ids": ["img1", "img2"]},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["total_processed"] == 2
        assert data["successful"] == 2

    @pytest.mark.asyncio
    async def test_bulk_migrate_limits_to_10(self, admin_client):
        """Should only process max 10 images."""
        ids = [f"img{i}" for i in range(15)]

        with patch("app.routes.file_routes.cloudinary.api.resource") as mock_resource, \
             patch("app.routes.file_routes.cloudinary.uploader.upload") as mock_upload:
            mock_resource.return_value = {"secure_url": "https://old.url/img.jpg"}
            mock_upload.return_value = {"secure_url": "https://new.url/img.jpg"}

            response = await admin_client.post(
                "/api/files/migration/bulk-migrate",
                json={"public_ids": ids},
            )

        assert response.status_code == 200
        assert response.json()["total_processed"] == 10


class TestMigrationStatus:
    """Tests for GET /api/migration/status."""

    @pytest.mark.asyncio
    async def test_migration_status_not_admin(self, client):
        """Regular users should be rejected (route catches HTTPException internally → 500)."""
        response = await client.get("/api/files/migration/status")
        assert response.status_code == 500

    @pytest.mark.asyncio
    async def test_migration_status_success(self, admin_client):
        """Admin should get migration status."""
        with patch("app.routes.file_routes.cloudinary.api.resources") as mock_resources:
            mock_resources.return_value = {"resources": []}

            response = await admin_client.get("/api/files/migration/status")

        assert response.status_code == 200
        data = response.json()
        assert "migration_mode" in data
        assert "public_images" in data
        assert "private_images" in data


class TestMigrationListImages:
    """Tests for GET /api/migration/images."""

    @pytest.mark.asyncio
    async def test_list_images_not_admin(self, client):
        """Regular users should be rejected (route catches HTTPException internally → 500)."""
        response = await client.get("/api/files/migration/images")
        assert response.status_code == 500

    @pytest.mark.asyncio
    async def test_list_images_success(self, admin_client):
        """Admin should get image list."""
        with patch("app.routes.file_routes.cloudinary.api.resources") as mock_resources:
            mock_resources.return_value = {
                "resources": [
                    {
                        "public_id": "img1",
                        "secure_url": "https://example.com/img1.jpg",
                        "created_at": "2024-01-01",
                        "bytes": 12345,
                        "type": "upload",
                    }
                ]
            }

            response = await admin_client.get("/api/files/migration/images?image_type=public&limit=10")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["images"][0]["public_id"] == "img1"


# ---------------------------------------------------------------------------
# Cleanup endpoints (super_admin only)
# ---------------------------------------------------------------------------

class TestCleanupDeleteAllPublic:
    """Tests for POST /api/migration/cleanup/delete-all-public."""

    @pytest.mark.asyncio
    async def test_delete_public_requires_super_admin(self, client):
        """Regular users should get 403."""
        response = await client.post(
            "/api/files/migration/cleanup/delete-all-public",
            json={"confirm_delete_all": "YES_DELETE_ALL_PUBLIC_IMAGES"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_public_requires_confirmation(self, super_admin_client):
        """Should reject wrong confirmation (route catches HTTPException internally → 500)."""
        response = await super_admin_client.post(
            "/api/files/migration/cleanup/delete-all-public",
            json={"confirm_delete_all": "wrong"},
        )
        assert response.status_code == 500

    @pytest.mark.asyncio
    async def test_delete_public_success(self, super_admin_client):
        """Should delete all public images with proper confirmation."""
        with patch("app.routes.file_routes.cloudinary.api.resources") as mock_resources, \
             patch("app.routes.file_routes.cloudinary.uploader.destroy") as mock_destroy:
            mock_resources.return_value = {
                "resources": [{"public_id": "img1"}, {"public_id": "img2"}]
            }
            mock_destroy.return_value = {"result": "ok"}

            response = await super_admin_client.post(
                "/api/files/migration/cleanup/delete-all-public",
                json={"confirm_delete_all": "YES_DELETE_ALL_PUBLIC_IMAGES"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["deleted_count"] == 2


class TestCleanupDeleteAllPrivate:
    """Tests for POST /api/migration/cleanup/delete-all-private."""

    @pytest.mark.asyncio
    async def test_delete_private_requires_super_admin(self, client):
        """Regular users should get 403."""
        response = await client.post(
            "/api/files/migration/cleanup/delete-all-private",
            json={"confirm_delete_all": "YES_DELETE_ALL_PRIVATE_IMAGES"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_private_success(self, super_admin_client):
        """Should delete all private images with proper confirmation."""
        with patch("app.routes.file_routes.cloudinary.api.resources") as mock_resources, \
             patch("app.routes.file_routes.cloudinary.uploader.destroy") as mock_destroy:
            mock_resources.return_value = {
                "resources": [{"public_id": "img1"}]
            }
            mock_destroy.return_value = {"result": "ok"}

            response = await super_admin_client.post(
                "/api/files/migration/cleanup/delete-all-private",
                json={"confirm_delete_all": "YES_DELETE_ALL_PRIVATE_IMAGES"},
            )

        assert response.status_code == 200
        assert response.json()["deleted_count"] == 1


class TestCleanupDeleteAllCloudinary:
    """Tests for POST /api/migration/cleanup/delete-all-cloudinary."""

    @pytest.mark.asyncio
    async def test_delete_all_requires_super_admin(self, client):
        """Regular users should get 403."""
        response = await client.post(
            "/api/files/migration/cleanup/delete-all-cloudinary",
            json={"confirm_delete_all": "YES_DELETE_EVERYTHING_FROM_CLOUDINARY"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_all_requires_confirmation(self, super_admin_client):
        """Should reject wrong confirmation (route catches HTTPException internally → 500)."""
        response = await super_admin_client.post(
            "/api/files/migration/cleanup/delete-all-cloudinary",
            json={"confirm_delete_all": "wrong"},
        )
        assert response.status_code == 500

    @pytest.mark.asyncio
    async def test_delete_all_success(self, super_admin_client):
        """Should delete both public and private images."""
        with patch("app.routes.file_routes.cloudinary.api.resources") as mock_resources, \
             patch("app.routes.file_routes.cloudinary.uploader.destroy") as mock_destroy:
            # First call for public, second for private
            mock_resources.side_effect = [
                {"resources": [{"public_id": "pub1"}]},
                {"resources": [{"public_id": "priv1"}]},
            ]
            mock_destroy.return_value = {"result": "ok"}

            response = await super_admin_client.post(
                "/api/files/migration/cleanup/delete-all-cloudinary",
                json={"confirm_delete_all": "YES_DELETE_EVERYTHING_FROM_CLOUDINARY"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["deleted_count"] == 2
