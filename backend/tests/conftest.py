"""
Shared test fixtures for the Homeschool LMS backend test suite.

Provides:
- An in-process MongoDB mock (mongomock + motor-like async wrappers)
- A pre-authenticated HTTPX AsyncClient wired to the FastAPI app
- Helper factories for users, students, and evidence documents
"""

import asyncio
import os
import sys
from datetime import datetime, timezone, date
from unittest.mock import AsyncMock, patch, MagicMock

import mongomock
import pytest
import pytest_asyncio
from bson import ObjectId
from httpx import AsyncClient, ASGITransport

# ---------------------------------------------------------------------------
# Environment – must be set BEFORE any app module is imported so that
# pydantic-settings picks them up.
# ---------------------------------------------------------------------------
os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017/test_db")
os.environ.setdefault("JWT_SECRET", "test-secret-key-for-testing-only")
os.environ.setdefault("SUPABASE_URL", "")
os.environ.setdefault("SUPABASE_ANON_KEY", "")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "")
os.environ.setdefault("SUPABASE_JWT_SECRET", "")
os.environ.setdefault("GOOGLE_API_KEY", "")
os.environ.setdefault("STRIPE_SECRET_KEY", "")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "")
os.environ.setdefault("STRIPE_MONTHLY_PRICE_ID", "price_monthly_test")
os.environ.setdefault("STRIPE_ANNUAL_PRICE_ID", "price_annual_test")
os.environ.setdefault("CLOUDINARY_CLOUD_NAME", "")
os.environ.setdefault("CLOUDINARY_API_KEY", "")
os.environ.setdefault("CLOUDINARY_API_SECRET", "")
os.environ.setdefault("BACKBLAZE_ENDPOINT", "https://s3.us-west-000.backblazeb2.com")
os.environ.setdefault("BACKBLAZE_KEY_ID", "test-key-id")
os.environ.setdefault("BACKBLAZE_APPLICATION_KEY", "test-app-key")
os.environ.setdefault("BACKBLAZE_BUCKET_NAME", "")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")

# Ensure the backend package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ---------------------------------------------------------------------------
# Async wrapper around mongomock so it behaves like motor
# ---------------------------------------------------------------------------

class AsyncCursor:
    """Wraps a mongomock cursor to provide async iteration."""

    def __init__(self, cursor):
        self._cursor = cursor
        self._items = list(cursor)
        self._index = 0

    def skip(self, n):
        self._items = self._items[n:]
        return self

    def limit(self, n):
        self._items = self._items[:n]
        return self

    def sort(self, *args, **kwargs):
        return self

    async def to_list(self, length=None):
        if length:
            return self._items[:length]
        return self._items

    def __aiter__(self):
        self._index = 0
        return self

    async def __anext__(self):
        if self._index >= len(self._items):
            raise StopAsyncIteration
        item = self._items[self._index]
        self._index += 1
        return item


class AsyncMongoCollection:
    """Wraps a mongomock collection to provide an async interface."""

    def __init__(self, collection):
        self._col = collection

    async def find_one(self, filter=None, *args, **kwargs):
        return self._col.find_one(filter, *args, **kwargs)

    def find(self, filter=None, *args, **kwargs):
        cursor = self._col.find(filter, *args, **kwargs)
        return AsyncCursor(cursor)

    async def insert_one(self, document, **kwargs):
        return self._col.insert_one(document, **kwargs)

    async def insert_many(self, documents, **kwargs):
        return self._col.insert_many(documents, **kwargs)

    async def update_one(self, filter, update, **kwargs):
        return self._col.update_one(filter, update, **kwargs)

    async def update_many(self, filter, update, **kwargs):
        return self._col.update_many(filter, update, **kwargs)

    async def delete_one(self, filter, **kwargs):
        return self._col.delete_one(filter, **kwargs)

    async def delete_many(self, filter, **kwargs):
        return self._col.delete_many(filter, **kwargs)

    async def count_documents(self, filter, **kwargs):
        return self._col.count_documents(filter, **kwargs)

    async def find_one_and_update(self, filter, update, **kwargs):
        return self._col.find_one_and_update(filter, update, **kwargs)

    async def find_one_and_delete(self, filter, **kwargs):
        return self._col.find_one_and_delete(filter, **kwargs)

    async def create_index(self, keys, **kwargs):
        return self._col.create_index(keys, **kwargs)

    async def aggregate(self, pipeline, **kwargs):
        result = list(self._col.aggregate(pipeline))
        return AsyncCursor(iter(result))

    async def distinct(self, key, filter=None, **kwargs):
        return self._col.distinct(key, filter)


class AsyncMongoDB:
    """Wraps a mongomock database to provide motor-like async access."""

    def __init__(self, db):
        self._db = db
        self.client = MagicMock()
        self.client.close = MagicMock()

    def __getattr__(self, name):
        if name.startswith("_") or name == "client":
            return object.__getattribute__(self, name)
        return AsyncMongoCollection(self._db[name])

    def __getitem__(self, name):
        return AsyncMongoCollection(self._db[name])

    async def command(self, cmd):
        return {"ok": 1}

    def get_collection(self, name):
        return AsyncMongoCollection(self._db[name])


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def event_loop():
    """Override default event loop to be session-scoped."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture()
def mock_db():
    """Create a fresh mongomock database for each test."""
    client = mongomock.MongoClient()
    db = client["test_homeschool_lms"]
    async_db = AsyncMongoDB(db)
    return async_db


@pytest.fixture()
def test_user_id():
    return ObjectId()


@pytest.fixture()
def test_user(test_user_id):
    """A UserInDB-compatible dict for a regular parent user."""
    from app.models.schemas.user import UserInDB
    return UserInDB(
        _id=test_user_id,
        email="parent@test.com",
        first_name="Test",
        last_name="Parent",
        hashed_password="$2b$12$fakehash",
        role="parent",
        is_active=True,
        is_verified=True,
        subscription_tier="free",
        subscription_status="active",
    )


@pytest.fixture()
def admin_user():
    from app.models.schemas.user import UserInDB
    return UserInDB(
        _id=ObjectId(),
        email="admin@test.com",
        first_name="Admin",
        last_name="User",
        hashed_password="$2b$12$fakehash",
        role="admin",
        is_active=True,
        is_verified=True,
        subscription_tier="basic",
        subscription_status="active",
    )


@pytest.fixture()
def super_admin_user():
    from app.models.schemas.user import UserInDB
    return UserInDB(
        _id=ObjectId(),
        email="superadmin@test.com",
        first_name="Super",
        last_name="Admin",
        hashed_password="$2b$12$fakehash",
        role="super_admin",
        is_active=True,
        is_verified=True,
        subscription_tier="basic",
        subscription_status="active",
    )


@pytest.fixture()
def test_student_id():
    return ObjectId()


@pytest.fixture()
def test_student_data(test_student_id, test_user_id):
    """Raw MongoDB document for a student."""
    return {
        "_id": test_student_id,
        "first_name": "Alice",
        "last_name": "Smith",
        "date_of_birth": "2017-03-15",
        "gender": "female",
        "grade_level": "Year 3",
        "slug": "alice-smith",
        "parent_ids": [test_user_id],
        "parent_access": [
            {"parent_id": test_user_id, "access_level": "admin"}
        ],
        "organization_id": None,
        "family_id": None,
        "subjects": {},
        "active_subjects": [],
        "created_at": datetime.now(timezone.utc),
    }


@pytest.fixture()
def test_report_id():
    return ObjectId()


@pytest.fixture()
def test_report_data(test_report_id, test_student_id, test_user_id):
    """Raw MongoDB document for a report."""
    return {
        "_id": test_report_id,
        "student_id": test_student_id,
        "report_period": "annual",
        "title": "Annual Report 2025",
        "learning_area_summaries": [],
        "generated_at": datetime.now(timezone.utc),
        "last_modified": datetime.now(timezone.utc),
        "created_by": test_user_id,
        "status": "draft",
        "export_settings": {"include_thumbnails": True, "include_evidence_links": True, "include_progress_charts": False},
        "grade_level": "Year 3",
        "version": 1,
        "created_at": datetime.now(timezone.utc),
    }


@pytest.fixture()
def seeded_db(mock_db, test_user_id, test_student_data, test_report_data):
    """A mock DB pre-populated with one user, one student, and one report."""
    from app.utils.password_utils import get_password_hash

    user_doc = {
        "_id": test_user_id,
        "email": "parent@test.com",
        "first_name": "Test",
        "last_name": "Parent",
        "hashed_password": get_password_hash("testpassword123"),
        "role": "parent",
        "is_active": True,
        "is_verified": True,
        "subscription_tier": "free",
        "subscription_status": "active",
        "is_grandfathered": False,
        "created_at": datetime.now(timezone.utc),
    }
    # Synchronous insert into the underlying mongomock
    mock_db._db["users"].insert_one(user_doc)
    mock_db._db["students"].insert_one(test_student_data)
    mock_db._db["student_reports"].insert_one(test_report_data)

    return mock_db


def _patch_db(db):
    """Monkey-patch Database.get_db to return our mock."""
    from app.utils.database_utils import Database
    Database.db = db
    Database.client = db.client


@pytest_asyncio.fixture()
async def client(seeded_db, test_user):
    """
    An authenticated HTTPX AsyncClient using the FastAPI test app.

    - Patches Database.get_db → seeded mongomock
    - Overrides get_current_user → returns test_user
    - Disables rate limiter cleanup (no event loop needed)
    """
    _patch_db(seeded_db)

    from app.main import app
    from app.utils.auth_utils import get_current_user

    # Override auth dependency
    app.dependency_overrides[get_current_user] = lambda: test_user

    # Patch the rate limiter to be a no-op during startup
    with patch("app.main.get_rate_limiter") as mock_rl:
        mock_rl.return_value.start_cleanup = MagicMock()
        mock_rl.return_value.stop_cleanup = MagicMock()
        mock_rl.return_value.check_rate_limit = MagicMock(return_value=(True, 10, 900))

        # Patch ensure_report_indexes to be a no-op
        with patch("app.main.ensure_report_indexes", new_callable=AsyncMock):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture()
async def admin_client(seeded_db, admin_user):
    """An authenticated HTTPX AsyncClient with admin privileges."""
    _patch_db(seeded_db)

    from app.main import app
    from app.utils.auth_utils import get_current_user

    app.dependency_overrides[get_current_user] = lambda: admin_user

    with patch("app.main.get_rate_limiter") as mock_rl:
        mock_rl.return_value.start_cleanup = MagicMock()
        mock_rl.return_value.stop_cleanup = MagicMock()
        mock_rl.return_value.check_rate_limit = MagicMock(return_value=(True, 10, 900))

        with patch("app.main.ensure_report_indexes", new_callable=AsyncMock):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture()
async def unauthenticated_client(seeded_db):
    """An HTTPX AsyncClient WITHOUT auth – requests should fail with 401."""
    _patch_db(seeded_db)

    from app.main import app

    app.dependency_overrides.clear()

    with patch("app.main.get_rate_limiter") as mock_rl:
        mock_rl.return_value.start_cleanup = MagicMock()
        mock_rl.return_value.stop_cleanup = MagicMock()
        mock_rl.return_value.check_rate_limit = MagicMock(return_value=(True, 10, 900))

        with patch("app.main.ensure_report_indexes", new_callable=AsyncMock):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                yield ac

    app.dependency_overrides.clear()
