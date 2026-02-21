"""
Tests for Stripe/subscription routes (/api/stripe/*).

Covers:
- Pricing info retrieval (public)
- Subscription status and usage (authenticated)
- Checkout session creation (authenticated, rate-limited)
- Customer portal session creation (authenticated)
- Stripe webhook handling (signature verification)
- Capability checks (can-add-student, can-add-evidence, can-generate-reports)
- Grandfather users migration (super_admin only)
- Authorization: unauthenticated requests return 401
- Error handling: missing Stripe config, rate limiting, invalid webhooks
"""

import json
import pytest
import pytest_asyncio
from unittest.mock import patch, MagicMock, AsyncMock
from bson import ObjectId

from httpx import AsyncClient, ASGITransport


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture()
async def super_admin_client(seeded_db, super_admin_user):
    """
    An authenticated HTTPX AsyncClient with super_admin privileges.

    Overrides get_current_user to return a user with role=super_admin,
    which satisfies the get_super_admin_user dependency used by the
    grandfather-users endpoint.
    """
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


# ============================================================
# Pricing Endpoint
# ============================================================

class TestGetPricing:
    """GET /api/stripe/subscription/pricing - returns pricing info."""

    @patch("app.routes.stripe_routes.SubscriptionService.get_pricing_info")
    async def test_get_pricing_success(self, mock_pricing, client):
        """Should return pricing information with tier details."""
        mock_pricing.return_value = {
            "monthly_price_id": "price_monthly_test",
            "annual_price_id": "price_annual_test",
            "monthly_amount": 1000,
            "annual_amount": 10800,
            "currency": "usd",
            "tiers": {
                "free": {"name": "Free", "price": 0},
                "basic": {"name": "Basic", "price": 1000},
            },
        }

        resp = await client.get("/api/stripe/subscription/pricing")
        assert resp.status_code == 200
        body = resp.json()
        assert body["monthly_price_id"] == "price_monthly_test"
        assert body["annual_price_id"] == "price_annual_test"
        assert body["monthly_amount"] == 1000
        assert body["annual_amount"] == 10800
        assert body["currency"] == "usd"
        assert "tiers" in body
        mock_pricing.assert_called_once()

    @patch("app.routes.stripe_routes.SubscriptionService.get_pricing_info")
    async def test_get_pricing_returns_both_price_ids(self, mock_pricing, client):
        """Should include both monthly and annual price IDs."""
        mock_pricing.return_value = {
            "monthly_price_id": "price_1M",
            "annual_price_id": "price_1A",
            "monthly_amount": 999,
            "annual_amount": 9999,
            "currency": "usd",
        }

        resp = await client.get("/api/stripe/subscription/pricing")
        assert resp.status_code == 200
        body = resp.json()
        assert "monthly_price_id" in body
        assert "annual_price_id" in body


# ============================================================
# Subscription Status Endpoint
# ============================================================

class TestGetSubscriptionStatus:
    """GET /api/stripe/subscription/status - returns user subscription status."""

    @patch(
        "app.routes.stripe_routes.SubscriptionService.get_user_subscription",
        new_callable=AsyncMock,
    )
    async def test_get_status_free_tier(self, mock_sub, client):
        """Free tier user should see tier=free and active status."""
        mock_sub.return_value = {
            "tier": "free",
            "effective_tier": "free",
            "status": "active",
            "is_grandfathered": False,
            "stripe_customer_id": None,
            "stripe_subscription_id": None,
            "current_period_end": None,
        }

        resp = await client.get("/api/stripe/subscription/status")
        assert resp.status_code == 200
        body = resp.json()
        assert body["tier"] == "free"
        assert body["effective_tier"] == "free"
        assert body["status"] == "active"
        assert body["is_grandfathered"] is False

    @patch(
        "app.routes.stripe_routes.SubscriptionService.get_user_subscription",
        new_callable=AsyncMock,
    )
    async def test_get_status_basic_tier(self, mock_sub, client):
        """Basic tier user should see tier=basic."""
        mock_sub.return_value = {
            "tier": "basic",
            "effective_tier": "basic",
            "status": "active",
            "is_grandfathered": False,
            "stripe_customer_id": "cus_test123",
            "stripe_subscription_id": "sub_test123",
            "current_period_end": "2026-03-01T00:00:00Z",
        }

        resp = await client.get("/api/stripe/subscription/status")
        assert resp.status_code == 200
        body = resp.json()
        assert body["tier"] == "basic"
        assert body["stripe_customer_id"] == "cus_test123"

    @patch(
        "app.routes.stripe_routes.SubscriptionService.get_user_subscription",
        new_callable=AsyncMock,
    )
    async def test_get_status_grandfathered_user(self, mock_sub, client):
        """Grandfathered user should have effective_tier=basic while tier=free."""
        mock_sub.return_value = {
            "tier": "free",
            "effective_tier": "basic",
            "status": "active",
            "is_grandfathered": True,
        }

        resp = await client.get("/api/stripe/subscription/status")
        assert resp.status_code == 200
        body = resp.json()
        assert body["tier"] == "free"
        assert body["effective_tier"] == "basic"
        assert body["is_grandfathered"] is True

    async def test_get_status_unauthenticated(self, unauthenticated_client):
        """Unauthenticated request should return 401."""
        resp = await unauthenticated_client.get("/api/stripe/subscription/status")
        assert resp.status_code == 401


# ============================================================
# Subscription Usage Endpoint
# ============================================================

class TestGetSubscriptionUsage:
    """GET /api/stripe/subscription/usage - returns usage and limits."""

    @patch(
        "app.routes.stripe_routes.SubscriptionService.get_usage",
        new_callable=AsyncMock,
    )
    async def test_get_usage_free_tier(self, mock_usage, client):
        """Free tier user should see correct limits and counts."""
        from app.models.schemas.subscription import SubscriptionUsage

        mock_usage.return_value = SubscriptionUsage(
            student_count=1,
            evidence_count=5,
            max_students=1,
            max_evidence=15,
            can_generate_reports=False,
            students_remaining=0,
            evidence_remaining=10,
            is_at_student_limit=True,
            is_at_evidence_limit=False,
        )

        resp = await client.get("/api/stripe/subscription/usage")
        assert resp.status_code == 200
        body = resp.json()
        assert body["student_count"] == 1
        assert body["evidence_count"] == 5
        assert body["max_students"] == 1
        assert body["max_evidence"] == 15
        assert body["can_generate_reports"] is False
        assert body["students_remaining"] == 0
        assert body["evidence_remaining"] == 10
        assert body["is_at_student_limit"] is True
        assert body["is_at_evidence_limit"] is False

    @patch(
        "app.routes.stripe_routes.SubscriptionService.get_usage",
        new_callable=AsyncMock,
    )
    async def test_get_usage_basic_tier(self, mock_usage, client):
        """Basic tier user should see expanded limits."""
        from app.models.schemas.subscription import SubscriptionUsage

        mock_usage.return_value = SubscriptionUsage(
            student_count=2,
            evidence_count=100,
            max_students=3,
            max_evidence=1000,
            can_generate_reports=True,
            students_remaining=1,
            evidence_remaining=900,
            is_at_student_limit=False,
            is_at_evidence_limit=False,
        )

        resp = await client.get("/api/stripe/subscription/usage")
        assert resp.status_code == 200
        body = resp.json()
        assert body["max_students"] == 3
        assert body["max_evidence"] == 1000
        assert body["can_generate_reports"] is True
        assert body["is_at_student_limit"] is False

    async def test_get_usage_unauthenticated(self, unauthenticated_client):
        """Unauthenticated request should return 401."""
        resp = await unauthenticated_client.get("/api/stripe/subscription/usage")
        assert resp.status_code == 401


# ============================================================
# Checkout Session Endpoint
# ============================================================

class TestCreateCheckoutSession:
    """POST /api/stripe/checkout/session - creates a Stripe checkout session."""

    @patch(
        "app.routes.stripe_routes.SubscriptionService.create_checkout_session",
        new_callable=AsyncMock,
    )
    @patch("app.routes.stripe_routes.settings")
    @patch("app.routes.stripe_routes.get_rate_limiter")
    async def test_create_checkout_success(
        self, mock_rl, mock_settings, mock_create, client
    ):
        """Should create a checkout session and return URL + session ID."""
        mock_settings.stripe_secret_key = "sk_test_fake"
        mock_rl.return_value.check_rate_limit = MagicMock(return_value=(True, 4, 3600))
        mock_create.return_value = {
            "checkout_url": "https://checkout.stripe.com/c/pay_test123",
            "session_id": "cs_test_abc123",
        }

        resp = await client.post(
            "/api/stripe/checkout/session",
            json={
                "price_id": "price_monthly_test",
                "success_url": "http://localhost:5173/subscription/success",
                "cancel_url": "http://localhost:5173/subscription/cancel",
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["checkout_url"] == "https://checkout.stripe.com/c/pay_test123"
        assert body["session_id"] == "cs_test_abc123"

    @patch("app.routes.stripe_routes.settings")
    async def test_create_checkout_stripe_not_configured(self, mock_settings, client):
        """Should return 503 when Stripe is not configured."""
        mock_settings.stripe_secret_key = ""

        resp = await client.post(
            "/api/stripe/checkout/session",
            json={
                "price_id": "price_monthly_test",
                "success_url": "http://localhost:5173/success",
                "cancel_url": "http://localhost:5173/cancel",
            },
        )
        assert resp.status_code == 503
        assert "not configured" in resp.json()["detail"].lower()

    @patch("app.routes.stripe_routes.settings")
    @patch("app.routes.stripe_routes.get_rate_limiter")
    async def test_create_checkout_rate_limited(
        self, mock_rl, mock_settings, client
    ):
        """Should return 429 when rate limit is exceeded."""
        mock_settings.stripe_secret_key = "sk_test_fake"
        mock_rl.return_value.check_rate_limit = MagicMock(
            return_value=(False, 0, 1800)
        )

        resp = await client.post(
            "/api/stripe/checkout/session",
            json={
                "price_id": "price_monthly_test",
                "success_url": "http://localhost:5173/success",
                "cancel_url": "http://localhost:5173/cancel",
            },
        )
        assert resp.status_code == 429
        assert "too many" in resp.json()["detail"].lower()

    async def test_create_checkout_missing_fields(self, client):
        """Should return 422 when required fields are missing."""
        resp = await client.post(
            "/api/stripe/checkout/session",
            json={"price_id": "price_monthly_test"},
        )
        assert resp.status_code == 422

    async def test_create_checkout_empty_body(self, client):
        """Should return 422 for an empty request body."""
        resp = await client.post("/api/stripe/checkout/session", json={})
        assert resp.status_code == 422

    async def test_create_checkout_unauthenticated(self, unauthenticated_client):
        """Unauthenticated request should return 401."""
        resp = await unauthenticated_client.post(
            "/api/stripe/checkout/session",
            json={
                "price_id": "price_monthly_test",
                "success_url": "http://localhost:5173/success",
                "cancel_url": "http://localhost:5173/cancel",
            },
        )
        assert resp.status_code == 401

    @patch(
        "app.routes.stripe_routes.SubscriptionService.create_checkout_session",
        new_callable=AsyncMock,
    )
    @patch("app.routes.stripe_routes.settings")
    @patch("app.routes.stripe_routes.get_rate_limiter")
    async def test_create_checkout_service_error(
        self, mock_rl, mock_settings, mock_create, client
    ):
        """Should propagate service errors (e.g. Stripe API failure)."""
        from fastapi import HTTPException

        mock_settings.stripe_secret_key = "sk_test_fake"
        mock_rl.return_value.check_rate_limit = MagicMock(return_value=(True, 4, 3600))
        mock_create.side_effect = HTTPException(
            status_code=400, detail="Invalid price ID"
        )

        resp = await client.post(
            "/api/stripe/checkout/session",
            json={
                "price_id": "price_invalid",
                "success_url": "http://localhost:5173/success",
                "cancel_url": "http://localhost:5173/cancel",
            },
        )
        assert resp.status_code == 400


# ============================================================
# Portal Session Endpoint
# ============================================================

class TestCreatePortalSession:
    """POST /api/stripe/portal/session - creates a Stripe Customer Portal session."""

    @patch(
        "app.routes.stripe_routes.SubscriptionService.create_portal_session",
        new_callable=AsyncMock,
    )
    @patch("app.routes.stripe_routes.settings")
    async def test_create_portal_success(self, mock_settings, mock_create, client):
        """Should create a portal session and return the URL."""
        mock_settings.stripe_secret_key = "sk_test_fake"
        mock_create.return_value = {
            "portal_url": "https://billing.stripe.com/p/session/test_abc123",
        }

        resp = await client.post(
            "/api/stripe/portal/session",
            json={"return_url": "http://localhost:5173/settings"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["portal_url"] == "https://billing.stripe.com/p/session/test_abc123"

    @patch("app.routes.stripe_routes.settings")
    async def test_create_portal_stripe_not_configured(self, mock_settings, client):
        """Should return 503 when Stripe is not configured."""
        mock_settings.stripe_secret_key = ""

        resp = await client.post(
            "/api/stripe/portal/session",
            json={"return_url": "http://localhost:5173/settings"},
        )
        assert resp.status_code == 503
        assert "not configured" in resp.json()["detail"].lower()

    async def test_create_portal_missing_return_url(self, client):
        """Should return 422 when return_url is missing."""
        resp = await client.post("/api/stripe/portal/session", json={})
        assert resp.status_code == 422

    async def test_create_portal_unauthenticated(self, unauthenticated_client):
        """Unauthenticated request should return 401."""
        resp = await unauthenticated_client.post(
            "/api/stripe/portal/session",
            json={"return_url": "http://localhost:5173/settings"},
        )
        assert resp.status_code == 401

    @patch(
        "app.routes.stripe_routes.SubscriptionService.create_portal_session",
        new_callable=AsyncMock,
    )
    @patch("app.routes.stripe_routes.settings")
    async def test_create_portal_no_customer_id(
        self, mock_settings, mock_create, client
    ):
        """Should propagate error when user has no Stripe customer ID."""
        from fastapi import HTTPException

        mock_settings.stripe_secret_key = "sk_test_fake"
        mock_create.side_effect = HTTPException(
            status_code=400, detail="No Stripe customer found"
        )

        resp = await client.post(
            "/api/stripe/portal/session",
            json={"return_url": "http://localhost:5173/settings"},
        )
        assert resp.status_code == 400
        assert "customer" in resp.json()["detail"].lower()


# ============================================================
# Webhook Endpoint
# ============================================================

class TestStripeWebhook:
    """POST /api/stripe/webhook - handles Stripe webhook events."""

    @patch(
        "app.routes.stripe_routes.SubscriptionService.log_webhook_event",
        new_callable=AsyncMock,
    )
    @patch(
        "app.routes.stripe_routes.SubscriptionService.handle_subscription_updated",
        new_callable=AsyncMock,
    )
    @patch("app.routes.stripe_routes.stripe.Webhook.construct_event")
    @patch("app.routes.stripe_routes.settings")
    async def test_webhook_subscription_created(
        self, mock_settings, mock_construct, mock_handler, mock_log, client
    ):
        """Should process customer.subscription.created events."""
        mock_settings.stripe_webhook_secret = "whsec_test123"
        mock_construct.return_value = {
            "id": "evt_test_sub_created",
            "type": "customer.subscription.created",
            "data": {
                "object": {
                    "id": "sub_test123",
                    "customer": "cus_test123",
                    "status": "active",
                    "metadata": {"user_id": str(ObjectId())},
                },
            },
        }

        resp = await client.post(
            "/api/stripe/webhook",
            content=b'{"test": "payload"}',
            headers={
                "stripe-signature": "t=123,v1=fake_sig",
                "content-type": "application/json",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "received"
        mock_handler.assert_called_once()
        mock_log.assert_called_once()

    @patch(
        "app.routes.stripe_routes.SubscriptionService.log_webhook_event",
        new_callable=AsyncMock,
    )
    @patch(
        "app.routes.stripe_routes.SubscriptionService.handle_subscription_updated",
        new_callable=AsyncMock,
    )
    @patch("app.routes.stripe_routes.stripe.Webhook.construct_event")
    @patch("app.routes.stripe_routes.settings")
    async def test_webhook_subscription_updated(
        self, mock_settings, mock_construct, mock_handler, mock_log, client
    ):
        """Should process customer.subscription.updated events."""
        mock_settings.stripe_webhook_secret = "whsec_test123"
        mock_construct.return_value = {
            "id": "evt_test_sub_updated",
            "type": "customer.subscription.updated",
            "data": {
                "object": {
                    "id": "sub_test123",
                    "status": "active",
                    "metadata": {"user_id": str(ObjectId())},
                },
            },
        }

        resp = await client.post(
            "/api/stripe/webhook",
            content=b'{"test": "payload"}',
            headers={
                "stripe-signature": "t=123,v1=fake_sig",
                "content-type": "application/json",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "received"
        mock_handler.assert_called_once()

    @patch(
        "app.routes.stripe_routes.SubscriptionService.log_webhook_event",
        new_callable=AsyncMock,
    )
    @patch(
        "app.routes.stripe_routes.SubscriptionService.handle_subscription_deleted",
        new_callable=AsyncMock,
    )
    @patch("app.routes.stripe_routes.stripe.Webhook.construct_event")
    @patch("app.routes.stripe_routes.settings")
    async def test_webhook_subscription_deleted(
        self, mock_settings, mock_construct, mock_handler, mock_log, client
    ):
        """Should process customer.subscription.deleted events."""
        mock_settings.stripe_webhook_secret = "whsec_test123"
        mock_construct.return_value = {
            "id": "evt_test_sub_deleted",
            "type": "customer.subscription.deleted",
            "data": {
                "object": {
                    "id": "sub_test123",
                    "status": "canceled",
                    "metadata": {"user_id": str(ObjectId())},
                },
            },
        }

        resp = await client.post(
            "/api/stripe/webhook",
            content=b'{"test": "payload"}',
            headers={
                "stripe-signature": "t=123,v1=fake_sig",
                "content-type": "application/json",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "received"
        mock_handler.assert_called_once()

    @patch(
        "app.routes.stripe_routes.SubscriptionService.log_webhook_event",
        new_callable=AsyncMock,
    )
    @patch("app.routes.stripe_routes.stripe.Webhook.construct_event")
    @patch("app.routes.stripe_routes.settings")
    async def test_webhook_checkout_session_completed(
        self, mock_settings, mock_construct, mock_log, client
    ):
        """Should process checkout.session.completed events (logged only)."""
        mock_settings.stripe_webhook_secret = "whsec_test123"
        mock_construct.return_value = {
            "id": "evt_test_checkout",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test123",
                    "customer": "cus_test123",
                },
            },
        }

        resp = await client.post(
            "/api/stripe/webhook",
            content=b'{"test": "payload"}',
            headers={
                "stripe-signature": "t=123,v1=fake_sig",
                "content-type": "application/json",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "received"
        mock_log.assert_called_once()

    @patch(
        "app.routes.stripe_routes.SubscriptionService.log_webhook_event",
        new_callable=AsyncMock,
    )
    @patch("app.routes.stripe_routes.stripe.Webhook.construct_event")
    @patch("app.routes.stripe_routes.settings")
    async def test_webhook_invoice_payment_succeeded(
        self, mock_settings, mock_construct, mock_log, client
    ):
        """Should process invoice.payment_succeeded events (logged only)."""
        mock_settings.stripe_webhook_secret = "whsec_test123"
        mock_construct.return_value = {
            "id": "evt_test_invoice_ok",
            "type": "invoice.payment_succeeded",
            "data": {
                "object": {
                    "id": "in_test123",
                    "subscription": "sub_test123",
                },
            },
        }

        resp = await client.post(
            "/api/stripe/webhook",
            content=b'{"test": "payload"}',
            headers={
                "stripe-signature": "t=123,v1=fake_sig",
                "content-type": "application/json",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "received"

    @patch("app.routes.stripe_routes.settings")
    async def test_webhook_secret_not_configured(self, mock_settings, client):
        """Should return 503 when webhook secret is not configured."""
        mock_settings.stripe_webhook_secret = ""

        resp = await client.post(
            "/api/stripe/webhook",
            content=b'{"test": "payload"}',
            headers={
                "stripe-signature": "t=123,v1=fake_sig",
                "content-type": "application/json",
            },
        )
        assert resp.status_code == 503
        assert "not configured" in resp.json()["detail"].lower()

    @patch("app.routes.stripe_routes.stripe.Webhook.construct_event")
    @patch("app.routes.stripe_routes.settings")
    async def test_webhook_invalid_payload(
        self, mock_settings, mock_construct, client
    ):
        """Should return 400 for invalid payload."""
        mock_settings.stripe_webhook_secret = "whsec_test123"
        mock_construct.side_effect = ValueError("Invalid payload")

        resp = await client.post(
            "/api/stripe/webhook",
            content=b"not json",
            headers={
                "stripe-signature": "t=123,v1=fake_sig",
                "content-type": "application/json",
            },
        )
        assert resp.status_code == 400
        assert "invalid payload" in resp.json()["detail"].lower()

    @patch("app.routes.stripe_routes.stripe.Webhook.construct_event")
    @patch("app.routes.stripe_routes.settings")
    async def test_webhook_invalid_signature(
        self, mock_settings, mock_construct, client
    ):
        """Should return 400 for invalid Stripe signature."""
        import stripe as stripe_module

        mock_settings.stripe_webhook_secret = "whsec_test123"
        mock_construct.side_effect = stripe_module.error.SignatureVerificationError(
            "Signature verification failed", "sig_header"
        )

        resp = await client.post(
            "/api/stripe/webhook",
            content=b'{"test": "payload"}',
            headers={
                "stripe-signature": "t=123,v1=bad_sig",
                "content-type": "application/json",
            },
        )
        assert resp.status_code == 400
        assert "invalid signature" in resp.json()["detail"].lower()

    @patch(
        "app.routes.stripe_routes.SubscriptionService.log_webhook_event",
        new_callable=AsyncMock,
    )
    @patch("app.routes.stripe_routes.stripe.Webhook.construct_event")
    @patch("app.routes.stripe_routes.settings")
    async def test_webhook_idempotency_skip_duplicate(
        self, mock_settings, mock_construct, mock_log, client, seeded_db
    ):
        """Should skip already-processed events (idempotency check)."""
        event_id = "evt_already_processed"
        mock_settings.stripe_webhook_secret = "whsec_test123"
        mock_construct.return_value = {
            "id": event_id,
            "type": "customer.subscription.updated",
            "data": {
                "object": {"id": "sub_test123", "status": "active"},
            },
        }

        # Insert a record indicating this event was already processed
        seeded_db._db["webhook_events"].insert_one(
            {"event_id": event_id, "success": True}
        )

        resp = await client.post(
            "/api/stripe/webhook",
            content=b'{"test": "payload"}',
            headers={
                "stripe-signature": "t=123,v1=fake_sig",
                "content-type": "application/json",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "already_processed"
        # log_webhook_event should NOT be called for duplicate events
        mock_log.assert_not_called()

    @patch(
        "app.routes.stripe_routes.SubscriptionService.log_webhook_event",
        new_callable=AsyncMock,
    )
    @patch(
        "app.routes.stripe_routes.SubscriptionService.handle_subscription_updated",
        new_callable=AsyncMock,
    )
    @patch("app.routes.stripe_routes.stripe.Webhook.construct_event")
    @patch("app.routes.stripe_routes.settings")
    async def test_webhook_handler_failure_returns_500(
        self, mock_settings, mock_construct, mock_handler, mock_log, client
    ):
        """Should return 500 when handler raises, so Stripe retries."""
        mock_settings.stripe_webhook_secret = "whsec_test123"
        mock_construct.return_value = {
            "id": "evt_test_failure",
            "type": "customer.subscription.created",
            "data": {
                "object": {"id": "sub_test123", "status": "active"},
            },
        }
        mock_handler.side_effect = Exception("Database connection lost")

        resp = await client.post(
            "/api/stripe/webhook",
            content=b'{"test": "payload"}',
            headers={
                "stripe-signature": "t=123,v1=fake_sig",
                "content-type": "application/json",
            },
        )
        assert resp.status_code == 500
        # The event should still be logged (with success=False)
        mock_log.assert_called_once()
        log_args = mock_log.call_args
        assert log_args[0][3] is False  # success=False
        assert "Database connection lost" in log_args[0][4]  # error message


# ============================================================
# Capability Check Endpoints
# ============================================================

class TestCanAddStudent:
    """GET /api/stripe/can-add-student - checks student limit."""

    @patch(
        "app.routes.stripe_routes.SubscriptionService.can_add_student",
        new_callable=AsyncMock,
    )
    async def test_can_add_student_allowed(self, mock_can_add, client):
        """Should return allowed=True when under the limit."""
        mock_can_add.return_value = (True, "")

        resp = await client.get("/api/stripe/can-add-student")
        assert resp.status_code == 200
        body = resp.json()
        assert body["allowed"] is True
        assert body["message"] == ""

    @patch(
        "app.routes.stripe_routes.SubscriptionService.can_add_student",
        new_callable=AsyncMock,
    )
    async def test_can_add_student_at_limit(self, mock_can_add, client):
        """Should return allowed=False with message when at the limit."""
        mock_can_add.return_value = (
            False,
            "You've reached your limit of 1 student(s). Upgrade to Basic to add more students.",
        )

        resp = await client.get("/api/stripe/can-add-student")
        assert resp.status_code == 200
        body = resp.json()
        assert body["allowed"] is False
        assert "limit" in body["message"].lower()
        assert "upgrade" in body["message"].lower()

    async def test_can_add_student_unauthenticated(self, unauthenticated_client):
        """Unauthenticated request should return 401."""
        resp = await unauthenticated_client.get("/api/stripe/can-add-student")
        assert resp.status_code == 401


class TestCanAddEvidence:
    """GET /api/stripe/can-add-evidence - checks evidence limit."""

    @patch(
        "app.routes.stripe_routes.SubscriptionService.can_add_evidence",
        new_callable=AsyncMock,
    )
    async def test_can_add_evidence_allowed(self, mock_can_add, client):
        """Should return allowed=True when under the limit."""
        mock_can_add.return_value = (True, "")

        resp = await client.get("/api/stripe/can-add-evidence")
        assert resp.status_code == 200
        body = resp.json()
        assert body["allowed"] is True
        assert body["message"] == ""

    @patch(
        "app.routes.stripe_routes.SubscriptionService.can_add_evidence",
        new_callable=AsyncMock,
    )
    async def test_can_add_evidence_at_limit(self, mock_can_add, client):
        """Should return allowed=False with message when at the limit."""
        mock_can_add.return_value = (
            False,
            "You've reached your limit of 15 evidence uploads. Upgrade to Basic for more uploads.",
        )

        resp = await client.get("/api/stripe/can-add-evidence")
        assert resp.status_code == 200
        body = resp.json()
        assert body["allowed"] is False
        assert "limit" in body["message"].lower()

    async def test_can_add_evidence_unauthenticated(self, unauthenticated_client):
        """Unauthenticated request should return 401."""
        resp = await unauthenticated_client.get("/api/stripe/can-add-evidence")
        assert resp.status_code == 401


class TestCanGenerateReports:
    """GET /api/stripe/can-generate-reports - checks report generation capability."""

    @patch(
        "app.routes.stripe_routes.SubscriptionService.can_generate_reports",
        new_callable=AsyncMock,
    )
    async def test_can_generate_reports_allowed(self, mock_can_gen, client):
        """Basic tier user should be allowed to generate reports."""
        mock_can_gen.return_value = (True, "")

        resp = await client.get("/api/stripe/can-generate-reports")
        assert resp.status_code == 200
        body = resp.json()
        assert body["allowed"] is True
        assert body["message"] == ""

    @patch(
        "app.routes.stripe_routes.SubscriptionService.can_generate_reports",
        new_callable=AsyncMock,
    )
    async def test_can_generate_reports_denied_free_tier(self, mock_can_gen, client):
        """Free tier user should be denied report generation."""
        mock_can_gen.return_value = (
            False,
            "Report generation requires a Basic subscription. Upgrade to unlock this feature.",
        )

        resp = await client.get("/api/stripe/can-generate-reports")
        assert resp.status_code == 200
        body = resp.json()
        assert body["allowed"] is False
        assert "upgrade" in body["message"].lower()

    async def test_can_generate_reports_unauthenticated(self, unauthenticated_client):
        """Unauthenticated request should return 401."""
        resp = await unauthenticated_client.get("/api/stripe/can-generate-reports")
        assert resp.status_code == 401


# ============================================================
# Grandfather Users Endpoint (Super Admin Only)
# ============================================================

class TestGrandfatherUsers:
    """POST /api/stripe/grandfather-users - one-time migration (super_admin only)."""

    @patch(
        "app.routes.stripe_routes.SubscriptionService.grandfather_existing_users",
        new_callable=AsyncMock,
    )
    async def test_grandfather_users_success(self, mock_grandfather, super_admin_client):
        """Super admin should be able to grandfather existing users."""
        mock_grandfather.return_value = 42

        resp = await super_admin_client.post("/api/stripe/grandfather-users")
        assert resp.status_code == 200
        body = resp.json()
        assert "42" in body["message"]
        assert "grandfathered" in body["message"].lower()
        mock_grandfather.assert_called_once()

    @patch(
        "app.routes.stripe_routes.SubscriptionService.grandfather_existing_users",
        new_callable=AsyncMock,
    )
    async def test_grandfather_users_zero_affected(
        self, mock_grandfather, super_admin_client
    ):
        """Should handle the case where no users need grandfathering."""
        mock_grandfather.return_value = 0

        resp = await super_admin_client.post("/api/stripe/grandfather-users")
        assert resp.status_code == 200
        body = resp.json()
        assert "0" in body["message"]

    async def test_grandfather_users_forbidden_for_parent(self, client):
        """Regular parent user should receive 403."""
        resp = await client.post("/api/stripe/grandfather-users")
        assert resp.status_code == 403

    async def test_grandfather_users_unauthenticated(self, unauthenticated_client):
        """Unauthenticated request should return 401."""
        resp = await unauthenticated_client.post("/api/stripe/grandfather-users")
        assert resp.status_code == 401

    async def test_grandfather_users_forbidden_for_admin(self, admin_client):
        """Admin (non-super) user should receive 403."""
        resp = await admin_client.post("/api/stripe/grandfather-users")
        assert resp.status_code == 403


# ============================================================
# Cross-Cutting: Response Shape Consistency
# ============================================================

class TestResponseShapes:
    """Verify that all endpoints return consistent response structures."""

    @patch(
        "app.routes.stripe_routes.SubscriptionService.can_add_student",
        new_callable=AsyncMock,
    )
    async def test_capability_response_has_allowed_and_message(
        self, mock_can_add, client
    ):
        """All capability endpoints should return {allowed: bool, message: str}."""
        mock_can_add.return_value = (True, "")

        resp = await client.get("/api/stripe/can-add-student")
        body = resp.json()
        assert "allowed" in body
        assert "message" in body
        assert isinstance(body["allowed"], bool)
        assert isinstance(body["message"], str)

    @patch(
        "app.routes.stripe_routes.SubscriptionService.can_add_evidence",
        new_callable=AsyncMock,
    )
    async def test_evidence_capability_response_shape(self, mock_can_add, client):
        """can-add-evidence should return {allowed: bool, message: str}."""
        mock_can_add.return_value = (False, "Limit reached")

        resp = await client.get("/api/stripe/can-add-evidence")
        body = resp.json()
        assert "allowed" in body
        assert "message" in body
        assert body["allowed"] is False
        assert body["message"] == "Limit reached"

    @patch(
        "app.routes.stripe_routes.SubscriptionService.can_generate_reports",
        new_callable=AsyncMock,
    )
    async def test_reports_capability_response_shape(self, mock_can_gen, client):
        """can-generate-reports should return {allowed: bool, message: str}."""
        mock_can_gen.return_value = (True, "")

        resp = await client.get("/api/stripe/can-generate-reports")
        body = resp.json()
        assert "allowed" in body
        assert "message" in body
        assert body["allowed"] is True
        assert body["message"] == ""

    @patch(
        "app.routes.stripe_routes.SubscriptionService.can_add_student",
        new_callable=AsyncMock,
    )
    async def test_capability_denied_message_not_empty(self, mock_can_add, client):
        """When allowed=False, the message should not be empty."""
        mock_can_add.return_value = (False, "Upgrade required")

        resp = await client.get("/api/stripe/can-add-student")
        body = resp.json()
        assert body["allowed"] is False
        assert len(body["message"]) > 0

    @patch(
        "app.routes.stripe_routes.SubscriptionService.can_add_student",
        new_callable=AsyncMock,
    )
    async def test_capability_allowed_message_is_empty(self, mock_can_add, client):
        """When allowed=True, the message should be empty string."""
        mock_can_add.return_value = (True, "")

        resp = await client.get("/api/stripe/can-add-student")
        body = resp.json()
        assert body["allowed"] is True
        assert body["message"] == ""
