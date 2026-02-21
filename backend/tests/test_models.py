"""
Tests for Pydantic models and schema validation.

Ensures data models correctly validate input and produce expected output.
"""

import pytest
from bson import ObjectId
from datetime import datetime, timezone, date


class TestPyObjectId:

    def test_valid_objectid_string(self):
        """Should accept a valid ObjectId string."""
        from app.models.schemas.base import PyObjectId
        oid = PyObjectId.validate("507f1f77bcf86cd799439011")
        assert isinstance(oid, ObjectId)

    def test_valid_objectid_instance(self):
        """Should accept an ObjectId instance."""
        from app.models.schemas.base import PyObjectId
        original = ObjectId()
        result = PyObjectId.validate(original)
        assert result == original

    def test_invalid_objectid_string(self):
        """Should reject an invalid string."""
        from app.models.schemas.base import PyObjectId
        with pytest.raises(ValueError):
            PyObjectId.validate("not-a-valid-id")

    def test_invalid_type(self):
        """Should reject non-string, non-ObjectId types."""
        from app.models.schemas.base import PyObjectId
        with pytest.raises(TypeError):
            PyObjectId.validate(12345)


class TestUserModel:

    def test_user_create_valid(self):
        """UserCreate should accept valid data."""
        from app.models.schemas.user import UserCreate
        user = UserCreate(
            email="valid@example.com",
            password="securepass123",
            first_name="John",
            last_name="Doe",
        )
        assert user.email == "valid@example.com"
        assert user.role == "parent"  # default

    def test_user_create_invalid_email(self):
        """UserCreate should reject invalid email."""
        from app.models.schemas.user import UserCreate
        with pytest.raises(Exception):
            UserCreate(
                email="not-an-email",
                password="pass",
                first_name="John",
                last_name="Doe",
            )

    def test_user_in_db(self):
        """UserInDB should include hashed_password."""
        from app.models.schemas.user import UserInDB
        user = UserInDB(
            _id=ObjectId(),
            email="test@test.com",
            first_name="A",
            last_name="B",
            hashed_password="$2b$12$hash",
        )
        assert user.hashed_password == "$2b$12$hash"
        assert user.role == "parent"
        assert user.subscription_tier == "free"

    def test_user_role_enum(self):
        """UserRole enum should have expected values."""
        from app.models.schemas.user import UserRole
        assert UserRole.PARENT.value == "parent"
        assert UserRole.ADMIN.value == "admin"
        assert UserRole.SUPER_ADMIN.value == "super_admin"


class TestStudentModel:

    def test_student_valid(self):
        """Student model should accept valid data."""
        from app.models.schemas.student import Student
        student = Student(
            _id=ObjectId(),
            first_name="Alice",
            last_name="Smith",
            date_of_birth=date(2017, 3, 15),
            gender="female",
            grade_level="Year 3",
            organization_id=None,
            family_id=None,
        )
        assert student.first_name == "Alice"
        assert student.grade_level == "Year 3"

    def test_student_access_levels(self):
        """AccessLevel enum should define the expected levels."""
        from app.models.schemas.student import AccessLevel
        assert AccessLevel.ADMIN.value == "admin"
        assert AccessLevel.CONTENT.value == "content"
        assert AccessLevel.VIEW.value == "view"


class TestReportModel:

    def test_report_status_enum(self):
        """ReportStatus should define draft, submitted, generating."""
        from app.models.schemas.report import ReportStatus
        assert ReportStatus.DRAFT.value == "draft"
        assert ReportStatus.SUBMITTED.value == "submitted"
        assert ReportStatus.GENERATING.value == "generating"

    def test_report_period_enum(self):
        """ReportPeriod should include all expected periods."""
        from app.models.schemas.report import ReportPeriod
        periods = [p.value for p in ReportPeriod]
        assert "annual" in periods
        assert "term_1" in periods
        assert "custom" in periods

    def test_generate_report_request(self):
        """GenerateReportRequest should accept valid data."""
        from app.models.schemas.report import GenerateReportRequest
        req = GenerateReportRequest(
            report_period="annual",
            grade_level="Year 3",
        )
        assert req.report_period.value == "annual"
        assert req.grade_level == "Year 3"


class TestEvidenceModel:

    def test_evidence_update(self):
        """EvidenceUpdate should allow partial updates."""
        from app.models.schemas.evidence import EvidenceUpdate
        update = EvidenceUpdate(title="New Title", description=None, learning_area_codes=None, learning_outcome_codes=None)
        assert update.title == "New Title"

    def test_evidence_create(self):
        """EvidenceCreate should require learning_outcome_codes."""
        from app.models.schemas.evidence import EvidenceCreate
        ec = EvidenceCreate(
            title="Test Evidence",
            learning_outcome_codes=["MA2-RN-01"],
        )
        assert ec.title == "Test Evidence"
        assert len(ec.learning_outcome_codes) == 1


class TestSubscriptionModel:

    def test_subscription_tiers(self):
        """SubscriptionTier should define free and basic."""
        from app.models.schemas.subscription import SubscriptionTier
        assert SubscriptionTier.FREE.value == "free"
        assert SubscriptionTier.BASIC.value == "basic"

    def test_tier_limits_structure(self):
        """TIER_LIMITS should contain expected keys."""
        from app.models.schemas.subscription import TIER_LIMITS, SubscriptionTier
        for tier in SubscriptionTier:
            limits = TIER_LIMITS[tier]
            assert "max_students" in limits
            assert "max_evidence" in limits
            assert "can_generate_reports" in limits


class TestPasswordUtils:

    def test_hash_and_verify(self):
        """Password hashing and verification should work correctly."""
        from app.utils.password_utils import get_password_hash, verify_password
        password = "securepassword123"
        hashed = get_password_hash(password)
        assert hashed != password
        assert verify_password(password, hashed)
        assert not verify_password("wrongpassword", hashed)

    def test_hash_different_each_time(self):
        """Same password should produce different hashes (bcrypt salt)."""
        from app.utils.password_utils import get_password_hash
        h1 = get_password_hash("same")
        h2 = get_password_hash("same")
        assert h1 != h2
