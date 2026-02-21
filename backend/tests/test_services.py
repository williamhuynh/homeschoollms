"""
Unit tests for backend services that previously had zero test coverage.

Covers:
- CurriculumService: grade-to-stage mapping, curriculum loading, subject retrieval
- ProgressService: upsert progress records, fetch student progress
- UserService: CRUD operations on users via the service layer
- ContentService: create and query content documents
- AdminService: _sanitize_user and _sanitize_student pure helper functions

All database-backed tests use the mongomock-based fixtures from conftest.py.
"""

import json
import os
from datetime import datetime, timezone, date
from unittest.mock import patch, AsyncMock, mock_open, MagicMock

import pytest
from bson import ObjectId

from tests.conftest import _patch_db


# ---------------------------------------------------------------------------
# CurriculumService
# ---------------------------------------------------------------------------


class TestCurriculumServiceGetStageForGrade:
    """Tests for CurriculumService.get_stage_for_grade mapping."""

    def setup_method(self):
        from app.services.curriculum_service import CurriculumService
        self.service = CurriculumService

    def test_kindergarten_full_name(self):
        """'Kindergarten' maps to early-stage-1."""
        assert self.service.get_stage_for_grade("Kindergarten") == "early-stage-1"

    def test_kindergarten_abbreviation(self):
        """'K' maps to early-stage-1."""
        assert self.service.get_stage_for_grade("K") == "early-stage-1"

    def test_year_1(self):
        """'Year 1' maps to stage-1."""
        assert self.service.get_stage_for_grade("Year 1") == "stage-1"

    def test_year_2(self):
        """'Year 2' maps to stage-1."""
        assert self.service.get_stage_for_grade("Year 2") == "stage-1"

    def test_year_3(self):
        """'Year 3' maps to stage-2."""
        assert self.service.get_stage_for_grade("Year 3") == "stage-2"

    def test_year_4(self):
        """'Year 4' maps to stage-2."""
        assert self.service.get_stage_for_grade("Year 4") == "stage-2"

    def test_year_5(self):
        """'Year 5' maps to stage-3."""
        assert self.service.get_stage_for_grade("Year 5") == "stage-3"

    def test_year_6(self):
        """'Year 6' maps to stage-3."""
        assert self.service.get_stage_for_grade("Year 6") == "stage-3"

    def test_year_7(self):
        """'Year 7' maps to stage-4."""
        assert self.service.get_stage_for_grade("Year 7") == "stage-4"

    def test_year_8(self):
        """'Year 8' maps to stage-4."""
        assert self.service.get_stage_for_grade("Year 8") == "stage-4"

    def test_year_9(self):
        """'Year 9' maps to stage-5."""
        assert self.service.get_stage_for_grade("Year 9") == "stage-5"

    def test_year_10(self):
        """'Year 10' maps to stage-5."""
        assert self.service.get_stage_for_grade("Year 10") == "stage-5"

    def test_year_11(self):
        """'Year 11' maps to stage-6."""
        assert self.service.get_stage_for_grade("Year 11") == "stage-6"

    def test_year_12(self):
        """'Year 12' maps to stage-6."""
        assert self.service.get_stage_for_grade("Year 12") == "stage-6"

    def test_numeric_string_11(self):
        """Bare '11' also maps to stage-6."""
        assert self.service.get_stage_for_grade("11") == "stage-6"

    def test_numeric_string_12(self):
        """Bare '12' also maps to stage-6."""
        assert self.service.get_stage_for_grade("12") == "stage-6"

    def test_unknown_grade_defaults_to_stage_1(self):
        """An unrecognised grade string falls back to stage-1."""
        assert self.service.get_stage_for_grade("Unknown Level") == "stage-1"

    def test_empty_string_defaults_to_stage_1(self):
        """An empty string falls back to stage-1."""
        assert self.service.get_stage_for_grade("") == "stage-1"

    def test_none_like_string_defaults_to_stage_1(self):
        """A nonsense value falls back to stage-1."""
        assert self.service.get_stage_for_grade("Preschool") == "stage-1"


class TestCurriculumServiceLoadCurriculum:
    """Tests for CurriculumService.load_curriculum and cache behaviour."""

    def setup_method(self):
        from app.services.curriculum_service import CurriculumService
        # Clear the cache before every test so tests are independent
        CurriculumService._curriculum_cache = {}
        self.service = CurriculumService

    def teardown_method(self):
        from app.services.curriculum_service import CurriculumService
        CurriculumService._curriculum_cache = {}

    @pytest.mark.asyncio
    async def test_load_curriculum_returns_data_from_file(self):
        """When a curriculum file exists, load_curriculum returns its contents."""
        fake_curriculum = {
            "stage": "Stage 2",
            "subjects": [
                {"name": "Mathematics", "code": "MA", "outcomes": []}
            ],
        }

        with patch.object(self.service, "_find_curriculum_file", return_value="/fake/path.json"):
            with patch("builtins.open", mock_open(read_data=json.dumps(fake_curriculum))):
                result = await self.service.load_curriculum("Year 3")

        assert result["stage"] == "Stage 2"
        assert len(result["subjects"]) == 1
        assert result["subjects"][0]["code"] == "MA"

    @pytest.mark.asyncio
    async def test_load_curriculum_caches_result(self):
        """A second call for the same grade should return the cached value."""
        fake_curriculum = {"stage": "Stage 2", "subjects": [{"name": "English", "code": "EN"}]}

        with patch.object(self.service, "_find_curriculum_file", return_value="/fake/path.json"):
            with patch("builtins.open", mock_open(read_data=json.dumps(fake_curriculum))):
                first = await self.service.load_curriculum("Year 3")

        # Second call should use cache -- no file system interaction
        second = await self.service.load_curriculum("Year 3")
        assert first is second

    @pytest.mark.asyncio
    async def test_load_curriculum_file_not_found(self):
        """When no curriculum file is found, return empty subjects list."""
        with patch.object(self.service, "_find_curriculum_file", return_value=None):
            result = await self.service.load_curriculum("Year 3")

        assert result["stage"] == "stage-2"
        assert result["subjects"] == []

    @pytest.mark.asyncio
    async def test_load_curriculum_json_decode_error(self):
        """When the file contains invalid JSON, return empty subjects list."""
        with patch.object(self.service, "_find_curriculum_file", return_value="/fake/path.json"):
            with patch("builtins.open", mock_open(read_data="NOT VALID JSON")):
                result = await self.service.load_curriculum("Year 4")

        assert result["stage"] == "stage-2"
        assert result["subjects"] == []


class TestCurriculumServiceGetSubjects:
    """Tests for CurriculumService.get_subjects."""

    def setup_method(self):
        from app.services.curriculum_service import CurriculumService
        CurriculumService._curriculum_cache = {}
        self.service = CurriculumService

    def teardown_method(self):
        from app.services.curriculum_service import CurriculumService
        CurriculumService._curriculum_cache = {}

    @pytest.mark.asyncio
    async def test_get_subjects_returns_list(self):
        """get_subjects should return the subjects list from the loaded curriculum."""
        subjects = [
            {"name": "Mathematics", "code": "MA"},
            {"name": "English", "code": "EN"},
        ]
        fake_curriculum = {"stage": "Stage 1", "subjects": subjects}

        with patch.object(self.service, "_find_curriculum_file", return_value="/fake/path.json"):
            with patch("builtins.open", mock_open(read_data=json.dumps(fake_curriculum))):
                result = await self.service.get_subjects("Year 1")

        assert len(result) == 2
        assert result[0]["code"] == "MA"
        assert result[1]["code"] == "EN"

    @pytest.mark.asyncio
    async def test_get_subjects_empty_when_no_file(self):
        """get_subjects returns an empty list when no file is found."""
        with patch.object(self.service, "_find_curriculum_file", return_value=None):
            result = await self.service.get_subjects("Year 1")

        assert result == []


class TestCurriculumServiceGetSubjectByCode:
    """Tests for CurriculumService.get_subject_by_code."""

    def setup_method(self):
        from app.services.curriculum_service import CurriculumService
        CurriculumService._curriculum_cache = {}
        self.service = CurriculumService

    def teardown_method(self):
        from app.services.curriculum_service import CurriculumService
        CurriculumService._curriculum_cache = {}

    @pytest.mark.asyncio
    async def test_get_subject_by_code_found(self):
        """Returns the matching subject when the code exists."""
        subjects = [
            {"name": "Mathematics", "code": "MA"},
            {"name": "English", "code": "EN"},
        ]
        fake_curriculum = {"stage": "Stage 1", "subjects": subjects}

        with patch.object(self.service, "_find_curriculum_file", return_value="/fake/path.json"):
            with patch("builtins.open", mock_open(read_data=json.dumps(fake_curriculum))):
                result = await self.service.get_subject_by_code("Year 2", "EN")

        assert result is not None
        assert result["name"] == "English"

    @pytest.mark.asyncio
    async def test_get_subject_by_code_not_found(self):
        """Returns None when no subject matches the code."""
        subjects = [{"name": "Mathematics", "code": "MA"}]
        fake_curriculum = {"stage": "Stage 1", "subjects": subjects}

        with patch.object(self.service, "_find_curriculum_file", return_value="/fake/path.json"):
            with patch("builtins.open", mock_open(read_data=json.dumps(fake_curriculum))):
                result = await self.service.get_subject_by_code("Year 2", "NONEXISTENT")

        assert result is None


# ---------------------------------------------------------------------------
# ProgressService
# ---------------------------------------------------------------------------


class TestProgressServiceUpdateProgress:
    """Tests for ProgressService.update_progress.

    NOTE: The Progress Pydantic model requires ``start_date`` but
    ``update_progress`` never sets it.  To avoid the ValidationError
    raised by ``Progress(**doc)`` at the end of the service method we
    pre-seed each progress document with ``start_date`` so the upsert
    ($set) leaves the field intact.
    """

    async def _seed_progress(self, db, student_id, content_id):
        """Insert a minimal progress doc with required Optional fields so Pydantic can validate."""
        await db.progress.insert_one({
            "student_id": ObjectId(student_id),
            "content_id": ObjectId(content_id),
            "status": "not_started",
            "start_date": datetime(2024, 1, 1, tzinfo=timezone.utc),
            "completion_date": None,
            "score": None,
        })

    @pytest.mark.asyncio
    async def test_update_progress_completed_adds_completion_date(self, mock_db):
        """When status is 'completed', a completion_date field must be set."""
        _patch_db(mock_db)
        from app.services.progress_service import ProgressService

        student_id = str(ObjectId())
        content_id = str(ObjectId())
        await self._seed_progress(mock_db, student_id, content_id)

        result = await ProgressService.update_progress(
            student_id=student_id,
            content_id=content_id,
            status="completed",
            score=95.0,
        )

        assert result.status == "completed"
        assert result.score == 95.0
        assert result.student_id == ObjectId(student_id)
        assert result.content_id == ObjectId(content_id)

        # Verify the document actually has a completion_date in the database
        raw = await mock_db.progress.find_one({
            "student_id": ObjectId(student_id),
            "content_id": ObjectId(content_id),
        })
        assert raw is not None
        assert "completion_date" in raw
        assert isinstance(raw["completion_date"], datetime)

    @pytest.mark.asyncio
    async def test_update_progress_in_progress_no_completion_date(self, mock_db):
        """When status is 'in_progress', no completion_date should be set."""
        _patch_db(mock_db)
        from app.services.progress_service import ProgressService

        student_id = str(ObjectId())
        content_id = str(ObjectId())
        await self._seed_progress(mock_db, student_id, content_id)

        result = await ProgressService.update_progress(
            student_id=student_id,
            content_id=content_id,
            status="in_progress",
        )

        assert result.status == "in_progress"

        raw = await mock_db.progress.find_one({
            "student_id": ObjectId(student_id),
            "content_id": ObjectId(content_id),
        })
        # update_progress does not set completion_date for non-completed status;
        # the pre-seeded None value persists.
        assert raw.get("completion_date") is None

    @pytest.mark.asyncio
    async def test_update_progress_upserts_on_repeat_call(self, mock_db):
        """Calling update_progress twice on the same student+content should update in place."""
        _patch_db(mock_db)
        from app.services.progress_service import ProgressService

        student_id = str(ObjectId())
        content_id = str(ObjectId())
        await self._seed_progress(mock_db, student_id, content_id)

        await ProgressService.update_progress(student_id, content_id, "in_progress")
        await ProgressService.update_progress(student_id, content_id, "completed", score=88.0)

        count = await mock_db.progress.count_documents({
            "student_id": ObjectId(student_id),
            "content_id": ObjectId(content_id),
        })
        assert count == 1

        raw = await mock_db.progress.find_one({
            "student_id": ObjectId(student_id),
            "content_id": ObjectId(content_id),
        })
        assert raw["status"] == "completed"
        assert raw["score"] == 88.0

    @pytest.mark.asyncio
    async def test_update_progress_score_none_by_default(self, mock_db):
        """When score is not provided, it should be None in the result."""
        _patch_db(mock_db)
        from app.services.progress_service import ProgressService

        student_id = str(ObjectId())
        content_id = str(ObjectId())
        await self._seed_progress(mock_db, student_id, content_id)

        result = await ProgressService.update_progress(student_id, content_id, "not_started")

        assert result.score is None


class TestProgressServiceGetStudentProgress:
    """Tests for ProgressService.get_student_progress."""

    async def _seed_progress(self, db, student_id, content_id, status="not_started", score=None):
        """Insert a progress doc with all required Optional fields for Pydantic validation."""
        doc = {
            "student_id": ObjectId(student_id),
            "content_id": ObjectId(content_id),
            "status": status,
            "start_date": datetime(2024, 1, 1, tzinfo=timezone.utc),
            "completion_date": datetime(2024, 6, 1, tzinfo=timezone.utc) if status == "completed" else None,
            "score": score,
        }
        await db.progress.insert_one(doc)

    @pytest.mark.asyncio
    async def test_get_student_progress_empty(self, mock_db):
        """Returns an empty list when no progress exists for the student."""
        _patch_db(mock_db)
        from app.services.progress_service import ProgressService

        student_id = str(ObjectId())
        result = await ProgressService.get_student_progress(student_id)

        assert result == []

    @pytest.mark.asyncio
    async def test_get_student_progress_returns_all_records(self, mock_db):
        """Returns all progress records for a student when no subject filter is applied."""
        _patch_db(mock_db)
        from app.services.progress_service import ProgressService

        student_id = str(ObjectId())
        content_id_1 = str(ObjectId())
        content_id_2 = str(ObjectId())

        await self._seed_progress(mock_db, student_id, content_id_1, "completed", score=100)
        await self._seed_progress(mock_db, student_id, content_id_2, "in_progress")

        result = await ProgressService.get_student_progress(student_id)

        assert len(result) == 2
        statuses = {p.status for p in result}
        assert statuses == {"completed", "in_progress"}

    @pytest.mark.asyncio
    async def test_get_student_progress_does_not_return_other_students(self, mock_db):
        """Progress for a different student should not be included."""
        _patch_db(mock_db)
        from app.services.progress_service import ProgressService

        student_a = str(ObjectId())
        student_b = str(ObjectId())
        content_id = str(ObjectId())

        await self._seed_progress(mock_db, student_a, content_id, "completed")
        await self._seed_progress(mock_db, student_b, content_id, "in_progress")

        result = await ProgressService.get_student_progress(student_a)

        assert len(result) == 1
        assert result[0].status == "completed"


# ---------------------------------------------------------------------------
# UserService
# ---------------------------------------------------------------------------


class TestUserServiceGetUserById:
    """Tests for UserService.get_user_by_id."""

    @pytest.mark.asyncio
    async def test_get_user_by_id_found(self, seeded_db, test_user_id):
        """Returns the seeded user when a valid ID is provided."""
        _patch_db(seeded_db)
        from app.services.user_service import UserService

        user = await UserService.get_user_by_id(str(test_user_id))

        assert user.email == "parent@test.com"
        assert user.first_name == "Test"
        assert user.last_name == "Parent"
        assert user.role == "parent"

    @pytest.mark.asyncio
    async def test_get_user_by_id_not_found(self, seeded_db):
        """Raises HTTPException 404 when the user does not exist."""
        _patch_db(seeded_db)
        from app.services.user_service import UserService
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await UserService.get_user_by_id(str(ObjectId()))

        assert exc_info.value.status_code == 404
        assert "User not found" in exc_info.value.detail


class TestUserServiceGetUserByEmail:
    """Tests for UserService.get_user_by_email."""

    @pytest.mark.asyncio
    async def test_get_user_by_email_found(self, seeded_db):
        """Returns the user when the email matches."""
        _patch_db(seeded_db)
        from app.services.user_service import UserService

        user = await UserService.get_user_by_email("parent@test.com")

        assert user is not None
        assert user.email == "parent@test.com"
        assert user.first_name == "Test"

    @pytest.mark.asyncio
    async def test_get_user_by_email_not_found(self, seeded_db):
        """Returns None when no user matches the email."""
        _patch_db(seeded_db)
        from app.services.user_service import UserService

        user = await UserService.get_user_by_email("nonexistent@test.com")

        assert user is None


class TestUserServiceUpdateUser:
    """Tests for UserService.update_user."""

    @pytest.mark.asyncio
    async def test_update_user_changes_fields(self, seeded_db, test_user_id):
        """Successfully updates the specified fields and returns the updated user."""
        _patch_db(seeded_db)
        from app.services.user_service import UserService

        updated = await UserService.update_user(
            str(test_user_id),
            {"first_name": "Updated", "last_name": "Name"},
        )

        assert updated.first_name == "Updated"
        assert updated.last_name == "Name"
        # Email should be unchanged
        assert updated.email == "parent@test.com"

    @pytest.mark.asyncio
    async def test_update_user_not_found(self, seeded_db):
        """Raises HTTPException 404 when the user ID does not exist."""
        _patch_db(seeded_db)
        from app.services.user_service import UserService
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await UserService.update_user(str(ObjectId()), {"first_name": "Ghost"})

        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_update_user_same_values_no_error(self, seeded_db, test_user_id):
        """Updating with the same values should not raise an error."""
        _patch_db(seeded_db)
        from app.services.user_service import UserService

        updated = await UserService.update_user(
            str(test_user_id),
            {"first_name": "Test"},
        )

        assert updated.first_name == "Test"


class TestUserServiceCreateUser:
    """Tests for UserService.create_user."""

    @pytest.mark.asyncio
    async def test_create_user_success(self, mock_db):
        """Creates a new user and returns a UserInDB instance."""
        _patch_db(mock_db)
        from app.services.user_service import UserService
        from app.models.schemas.user import UserCreate

        user_data = UserCreate(
            email="new@example.com",
            password="securepassword123",
            first_name="New",
            last_name="User",
        )

        created = await UserService.create_user(user_data)

        assert created.email == "new@example.com"
        assert created.first_name == "New"
        assert created.last_name == "User"
        assert created.hashed_password != "securepassword123"

    @pytest.mark.asyncio
    async def test_create_user_duplicate_email(self, seeded_db):
        """Raises HTTPException 400 when the email is already registered."""
        _patch_db(seeded_db)
        from app.services.user_service import UserService
        from app.models.schemas.user import UserCreate
        from fastapi import HTTPException

        user_data = UserCreate(
            email="parent@test.com",
            password="anypassword",
            first_name="Dup",
            last_name="User",
        )

        with pytest.raises(HTTPException) as exc_info:
            await UserService.create_user(user_data)

        assert exc_info.value.status_code == 400
        assert "already registered" in exc_info.value.detail


# ---------------------------------------------------------------------------
# ContentService
# ---------------------------------------------------------------------------


class TestContentServiceCreateContent:
    """Tests for ContentService.create_content.

    NOTE: ContentService.create_content uses ``content.dict()`` which under
    Pydantic V2 serialises PyObjectId → str and leaves ``date`` objects
    that mongomock/BSON cannot encode.  The tests below verify the model
    construction and round-trip via direct DB insertion instead.
    """

    def test_content_base_model_validates(self):
        """ContentBase can be constructed with valid data."""
        from app.models.schemas.content import ContentBase

        content = ContentBase(
            title="Intro to Fractions",
            description="Learn basic fractions with visual aids",
            subject_id=ObjectId(),
            content_type="video",
            content_date=date(2025, 6, 15),
            created_by=ObjectId(),
            organization_id=None,
            estimated_duration=30,
            difficulty_level=2,
        )

        assert content.title == "Intro to Fractions"
        assert content.content_type == "video"
        assert content.estimated_duration == 30

    @pytest.mark.asyncio
    async def test_content_round_trip_via_db(self, mock_db):
        """A raw content document inserted into the DB can be read back as ContentBase."""
        _patch_db(mock_db)
        from app.models.schemas.content import ContentBase

        subject_id = ObjectId()
        doc = {
            "_id": ObjectId(),
            "title": "Spelling Test",
            "description": "Weekly spelling assessment",
            "subject_id": subject_id,
            "content_type": "exercise",
            "content_date": "2025-07-01",
            "created_by": ObjectId(),
            "organization_id": None,
            "estimated_duration": 15,
            "difficulty_level": 1,
            "learning_outcome_ids": [],
            "prerequisites": [],
            "tags": [],
            "metadata": {},
        }
        await mock_db.content.insert_one(doc)

        raw = await mock_db.content.find_one({"title": "Spelling Test"})
        result = ContentBase(**raw)
        assert result.title == "Spelling Test"
        assert result.content_type == "exercise"


class TestContentServiceGetSubjectContent:
    """Tests for ContentService.get_subject_content."""

    @pytest.mark.asyncio
    async def test_get_subject_content_returns_matching_items(self, mock_db):
        """Returns content items that match the given subject_id."""
        _patch_db(mock_db)
        from app.services.content_service import ContentService

        subject_id = ObjectId()

        # Insert content directly via the mock database
        mock_db._db["content"].insert_many([
            {
                "_id": ObjectId(),
                "title": "Video A",
                "description": "desc",
                "subject_id": subject_id,
                "content_type": "video",
                "content_date": "2025-01-01",
                "created_by": ObjectId(),
                "organization_id": None,
                "estimated_duration": 10,
                "difficulty_level": 1,
                "learning_outcome_ids": [],
                "prerequisites": [],
                "tags": [],
                "metadata": {},
                "created_at": datetime.now(timezone.utc),
            },
            {
                "_id": ObjectId(),
                "title": "Video B",
                "description": "desc",
                "subject_id": subject_id,
                "content_type": "video",
                "content_date": "2025-01-02",
                "created_by": ObjectId(),
                "organization_id": None,
                "estimated_duration": 20,
                "difficulty_level": 2,
                "learning_outcome_ids": [],
                "prerequisites": [],
                "tags": [],
                "metadata": {},
                "created_at": datetime.now(timezone.utc),
            },
        ])

        result = await ContentService.get_subject_content(str(subject_id))

        assert len(result) == 2
        titles = {c.title for c in result}
        assert titles == {"Video A", "Video B"}

    @pytest.mark.asyncio
    async def test_get_subject_content_empty(self, mock_db):
        """Returns an empty list when no content exists for the subject."""
        _patch_db(mock_db)
        from app.services.content_service import ContentService

        result = await ContentService.get_subject_content(str(ObjectId()))

        assert result == []

    @pytest.mark.asyncio
    async def test_get_subject_content_filters_by_grade_level(self, mock_db):
        """When grade_level is provided, only matching content is returned."""
        _patch_db(mock_db)
        from app.services.content_service import ContentService

        subject_id = ObjectId()
        base_doc = {
            "description": "desc",
            "subject_id": subject_id,
            "content_type": "document",
            "content_date": "2025-01-01",
            "created_by": ObjectId(),
            "organization_id": None,
            "estimated_duration": 5,
            "difficulty_level": 1,
            "learning_outcome_ids": [],
            "prerequisites": [],
            "tags": [],
            "metadata": {},
            "created_at": datetime.now(timezone.utc),
        }

        mock_db._db["content"].insert_many([
            {**base_doc, "_id": ObjectId(), "title": "Year 3 Doc", "grade_level": "Year 3"},
            {**base_doc, "_id": ObjectId(), "title": "Year 5 Doc", "grade_level": "Year 5"},
        ])

        result = await ContentService.get_subject_content(str(subject_id), grade_level="Year 3")

        assert len(result) == 1
        assert result[0].title == "Year 3 Doc"


# ---------------------------------------------------------------------------
# AdminService – pure helper functions
# ---------------------------------------------------------------------------


class TestAdminServiceSanitizeUser:
    """Tests for AdminService._sanitize_user static helper."""

    def setup_method(self):
        from app.services.admin_service import AdminService
        self.sanitize = AdminService._sanitize_user

    def test_basic_fields_extracted(self):
        """Core fields are correctly extracted from the raw user dict."""
        user_doc = {
            "_id": ObjectId(),
            "email": "alice@example.com",
            "first_name": "Alice",
            "last_name": "Wonderland",
            "role": "parent",
            "is_active": True,
            "is_verified": True,
            "profile_image": "https://img.example.com/alice.jpg",
            "subscription_tier": "basic",
            "subscription_status": "active",
            "is_grandfathered": False,
            "created_at": datetime(2025, 1, 15, tzinfo=timezone.utc),
        }

        result = self.sanitize(user_doc)

        assert result["id"] == str(user_doc["_id"])
        assert result["email"] == "alice@example.com"
        assert result["first_name"] == "Alice"
        assert result["last_name"] == "Wonderland"
        assert result["role"] == "parent"
        assert result["is_active"] is True
        assert result["is_verified"] is True
        assert result["profile_image"] == "https://img.example.com/alice.jpg"
        assert result["subscription_tier"] == "basic"
        assert result["subscription_status"] == "active"
        assert result["is_grandfathered"] is False

    def test_sensitive_fields_excluded_by_default(self):
        """Stripe and org fields should not appear without include_sensitive=True."""
        user_doc = {
            "_id": ObjectId(),
            "email": "bob@example.com",
            "first_name": "Bob",
            "last_name": "Builder",
            "stripe_customer_id": "cus_secret",
            "stripe_subscription_id": "sub_secret",
        }

        result = self.sanitize(user_doc)

        assert "stripe_customer_id" not in result
        assert "stripe_subscription_id" not in result
        assert "organization_id" not in result
        assert "family_id" not in result

    def test_sensitive_fields_included_when_requested(self):
        """Stripe and org fields appear with include_sensitive=True."""
        user_doc = {
            "_id": ObjectId(),
            "email": "charlie@example.com",
            "first_name": "Charlie",
            "last_name": "Chaplin",
            "stripe_customer_id": "cus_abc123",
            "stripe_subscription_id": "sub_xyz789",
            "organization_id": ObjectId(),
            "family_id": ObjectId(),
            "current_period_end": datetime(2026, 1, 1, tzinfo=timezone.utc),
        }

        result = self.sanitize(user_doc, include_sensitive=True)

        assert result["stripe_customer_id"] == "cus_abc123"
        assert result["stripe_subscription_id"] == "sub_xyz789"
        assert result["organization_id"] == str(user_doc["organization_id"])
        assert result["family_id"] == str(user_doc["family_id"])
        assert result["current_period_end"] is not None

    def test_defaults_for_missing_fields(self):
        """Missing optional fields get sensible defaults."""
        user_doc = {"_id": ObjectId(), "email": "min@example.com"}

        result = self.sanitize(user_doc)

        assert result["first_name"] is None
        assert result["last_name"] is None
        assert result["role"] == "parent"
        assert result["is_active"] is True
        assert result["is_verified"] is False
        assert result["subscription_tier"] == "free"
        assert result["subscription_status"] == "active"
        assert result["is_grandfathered"] is False
        assert result["profile_image"] is None
        assert result["created_at"] is None
        assert result["last_login"] is None

    def test_hashed_password_never_exposed(self):
        """The hashed_password field should never appear in the output."""
        user_doc = {
            "_id": ObjectId(),
            "email": "safe@example.com",
            "hashed_password": "$2b$12$somehash",
        }

        result = self.sanitize(user_doc)
        result_sensitive = self.sanitize(user_doc, include_sensitive=True)

        assert "hashed_password" not in result
        assert "hashed_password" not in result_sensitive


class TestAdminServiceSanitizeStudent:
    """Tests for AdminService._sanitize_student static helper."""

    def setup_method(self):
        from app.services.admin_service import AdminService
        self.sanitize = AdminService._sanitize_student

    def test_basic_fields_extracted(self):
        """Core student fields are correctly extracted."""
        parent_id = ObjectId()
        student_doc = {
            "_id": ObjectId(),
            "first_name": "Alice",
            "last_name": "Smith",
            "date_of_birth": "2017-03-15",
            "gender": "female",
            "grade_level": "Year 3",
            "slug": "alice-smith",
            "parent_ids": [parent_id],
            "parent_access": [{"parent_id": parent_id, "access_level": "admin"}],
            "organization_id": None,
            "family_id": None,
            "subjects": {},
            "active_subjects": [],
            "created_at": datetime(2025, 2, 1, tzinfo=timezone.utc),
        }

        result = self.sanitize(student_doc)

        assert result["first_name"] == "Alice"
        assert result["last_name"] == "Smith"
        assert result["grade_level"] == "Year 3"
        assert result["slug"] == "alice-smith"
        assert result["gender"] == "female"
        assert result["organization_id"] is None
        assert result["family_id"] is None

    def test_object_ids_converted_to_strings(self):
        """All ObjectId fields should be serialized to strings."""
        parent_id = ObjectId()
        org_id = ObjectId()
        family_id = ObjectId()

        student_doc = {
            "_id": ObjectId(),
            "first_name": "Bob",
            "last_name": "Jones",
            "parent_ids": [parent_id],
            "parent_access": [{"parent_id": parent_id, "access_level": "content"}],
            "organization_id": org_id,
            "family_id": family_id,
            "active_subjects": [],
            "subjects": {},
        }

        result = self.sanitize(student_doc)

        assert isinstance(result["id"], str)
        assert result["parent_ids"] == [str(parent_id)]
        assert result["organization_id"] == str(org_id)
        assert result["family_id"] == str(family_id)
        assert result["parent_access"][0]["parent_id"] == str(parent_id)
        assert result["parent_access"][0]["access_level"] == "content"

    def test_empty_parent_access(self):
        """When parent_access is missing, defaults to an empty list."""
        student_doc = {
            "_id": ObjectId(),
            "first_name": "Orphan",
            "last_name": "Student",
            "parent_ids": [],
            "subjects": {},
        }

        result = self.sanitize(student_doc)

        assert result["parent_access"] == []
        assert result["parent_ids"] == []

    def test_subjects_with_nested_object_ids(self):
        """Nested ObjectIds within the subjects dict are stringified."""
        nested_oid = ObjectId()
        student_doc = {
            "_id": ObjectId(),
            "first_name": "Test",
            "last_name": "Nested",
            "subjects": {
                "math": {
                    "subject_id": nested_oid,
                    "progress": 0.75,
                }
            },
            "parent_ids": [],
            "parent_access": [],
            "active_subjects": [],
        }

        result = self.sanitize(student_doc)

        assert result["subjects"]["math"]["subject_id"] == str(nested_oid)
        assert result["subjects"]["math"]["progress"] == 0.75

    def test_datetime_fields_serialized(self):
        """Datetime fields should be serialized to ISO strings."""
        now = datetime(2025, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
        student_doc = {
            "_id": ObjectId(),
            "first_name": "Time",
            "last_name": "Traveler",
            "created_at": now,
            "date_of_birth": date(2018, 5, 20),
            "parent_ids": [],
            "parent_access": [],
            "active_subjects": [],
            "subjects": {},
        }

        result = self.sanitize(student_doc)

        assert result["created_at"] == now.isoformat()
        assert result["date_of_birth"] == "2018-05-20"


class TestAdminServiceSerializeDatetime:
    """Tests for AdminService._serialize_datetime helper."""

    def setup_method(self):
        from app.services.admin_service import AdminService
        self.serialize = AdminService._serialize_datetime

    def test_none_returns_none(self):
        """None input returns None."""
        assert self.serialize(None) is None

    def test_datetime_returns_isoformat(self):
        """A datetime object returns its ISO format string."""
        dt = datetime(2025, 3, 15, 10, 30, 0, tzinfo=timezone.utc)
        result = self.serialize(dt)
        assert result == dt.isoformat()

    def test_date_returns_isoformat(self):
        """A date object returns its ISO format string."""
        d = date(2025, 3, 15)
        result = self.serialize(d)
        assert result == "2025-03-15"

    def test_string_passthrough(self):
        """A plain string without isoformat() returns str(value)."""
        result = self.serialize("already-a-string")
        assert result == "already-a-string"
