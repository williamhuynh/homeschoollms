"""
Tests for subscription service logic.

Covers tier limits, usage calculations, and enforcement checks.
These are unit-level tests that exercise SubscriptionService methods
directly against the mock database.
"""

import pytest
from bson import ObjectId
from datetime import datetime, timezone
from unittest.mock import patch

from app.models.schemas.subscription import SubscriptionTier, TIER_LIMITS


class TestTierLimits:

    def test_free_tier_limits(self):
        """Free tier should allow 1 student and 15 evidence items."""
        limits = TIER_LIMITS[SubscriptionTier.FREE]
        assert limits["max_students"] == 1
        assert limits["max_evidence"] == 15
        assert limits["can_generate_reports"] is False

    def test_basic_tier_limits(self):
        """Basic tier should allow 3 students and 1000 evidence items."""
        limits = TIER_LIMITS[SubscriptionTier.BASIC]
        assert limits["max_students"] == 3
        assert limits["max_evidence"] == 1000
        assert limits["can_generate_reports"] is True


class TestSubscriptionService:

    async def test_get_tier_limits_free(self):
        """get_tier_limits('free') should return free tier limits."""
        from app.services.subscription_service import SubscriptionService
        limits = SubscriptionService.get_tier_limits("free")
        assert limits["max_students"] == 1

    async def test_get_tier_limits_basic(self):
        """get_tier_limits('basic') should return basic tier limits."""
        from app.services.subscription_service import SubscriptionService
        limits = SubscriptionService.get_tier_limits("basic")
        assert limits["max_students"] == 3

    async def test_get_tier_limits_unknown(self):
        """Unknown tier should fall back to free limits."""
        from app.services.subscription_service import SubscriptionService
        limits = SubscriptionService.get_tier_limits("platinum")
        assert limits["max_students"] == 1

    async def test_get_user_subscription(self, seeded_db, test_user_id):
        """Should return subscription info for a seeded user."""
        from app.utils.database_utils import Database
        Database.db = seeded_db
        Database.client = seeded_db.client

        from app.services.subscription_service import SubscriptionService
        sub = await SubscriptionService.get_user_subscription(str(test_user_id))
        assert sub["tier"] == "free"
        assert sub["effective_tier"] == "free"
        assert sub["is_grandfathered"] is False

    async def test_get_user_subscription_grandfathered(self, seeded_db, test_user_id):
        """Grandfathered user should have effective_tier = basic."""
        from app.utils.database_utils import Database
        Database.db = seeded_db
        Database.client = seeded_db.client

        # Update user to be grandfathered
        seeded_db._db["users"].update_one(
            {"_id": test_user_id},
            {"$set": {"is_grandfathered": True}},
        )

        from app.services.subscription_service import SubscriptionService
        sub = await SubscriptionService.get_user_subscription(str(test_user_id))
        assert sub["tier"] == "free"
        assert sub["effective_tier"] == "basic"
        assert sub["is_grandfathered"] is True

    async def test_get_student_count(self, seeded_db, test_user_id):
        """Should count the students associated with the test user."""
        from app.utils.database_utils import Database
        Database.db = seeded_db
        Database.client = seeded_db.client

        from app.services.subscription_service import SubscriptionService
        count = await SubscriptionService.get_student_count(str(test_user_id))
        assert count == 1

    async def test_can_add_student_free_tier(self, seeded_db, test_user_id):
        """Free tier user with 1 student should not be able to add more."""
        from app.utils.database_utils import Database
        Database.db = seeded_db
        Database.client = seeded_db.client

        from app.services.subscription_service import SubscriptionService
        can_add, message = await SubscriptionService.can_add_student(str(test_user_id))
        # Free tier allows 1 student, already have 1
        assert can_add is False

    async def test_can_add_student_basic_tier(self, seeded_db, test_user_id):
        """Basic tier user with 1 student should be able to add more."""
        from app.utils.database_utils import Database
        Database.db = seeded_db
        Database.client = seeded_db.client

        # Upgrade user to basic
        seeded_db._db["users"].update_one(
            {"_id": test_user_id},
            {"$set": {"subscription_tier": "basic"}},
        )

        from app.services.subscription_service import SubscriptionService
        can_add, message = await SubscriptionService.can_add_student(str(test_user_id))
        assert can_add is True


class TestRateLimiter:

    def test_rate_limiter_allows_within_limit(self):
        """Requests within the limit should be allowed."""
        from app.utils.rate_limiter import RateLimiter
        rl = RateLimiter()
        allowed, remaining, _ = rl.check_rate_limit("test:key", max_requests=5, window_seconds=60)
        assert allowed is True
        assert remaining == 4

    def test_rate_limiter_blocks_over_limit(self):
        """Requests beyond the limit should be blocked."""
        from app.utils.rate_limiter import RateLimiter
        rl = RateLimiter()
        for _ in range(5):
            rl.check_rate_limit("test:key2", max_requests=5, window_seconds=60)
        allowed, remaining, _ = rl.check_rate_limit("test:key2", max_requests=5, window_seconds=60)
        assert allowed is False
        assert remaining == 0

    def test_rate_limiter_separate_keys(self):
        """Different keys should have independent rate limits."""
        from app.utils.rate_limiter import RateLimiter
        rl = RateLimiter()
        for _ in range(5):
            rl.check_rate_limit("key:a", max_requests=5, window_seconds=60)
        # Key A should be exhausted
        allowed_a, _, _ = rl.check_rate_limit("key:a", max_requests=5, window_seconds=60)
        assert allowed_a is False
        # Key B should still be available
        allowed_b, _, _ = rl.check_rate_limit("key:b", max_requests=5, window_seconds=60)
        assert allowed_b is True
