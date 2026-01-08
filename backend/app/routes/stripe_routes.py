import stripe
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from typing import Optional

from ..config.settings import settings
from ..models.schemas.user import UserInDB
from ..models.schemas.subscription import (
    CreateCheckoutSessionRequest,
    CreateCheckoutSessionResponse,
    CreatePortalSessionRequest,
    CreatePortalSessionResponse,
    SubscriptionUsage,
)
from ..services.subscription_service import SubscriptionService
from ..utils.auth_utils import get_current_user, get_admin_user
from ..utils.rate_limiter import get_rate_limiter

# Configure Stripe
if settings.stripe_secret_key:
    stripe.api_key = settings.stripe_secret_key

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/subscription/pricing")
async def get_pricing():
    """Get subscription pricing information"""
    return SubscriptionService.get_pricing_info()


@router.get("/subscription/status")
async def get_subscription_status(
    current_user: UserInDB = Depends(get_current_user)
):
    """Get current user's subscription status"""
    subscription = await SubscriptionService.get_user_subscription(str(current_user.id))
    return subscription


@router.get("/subscription/usage", response_model=SubscriptionUsage)
async def get_subscription_usage(
    current_user: UserInDB = Depends(get_current_user)
):
    """Get current user's subscription usage and limits"""
    usage = await SubscriptionService.get_usage(str(current_user.id))
    return usage


@router.post("/checkout/session", response_model=CreateCheckoutSessionResponse)
async def create_checkout_session(
    request: CreateCheckoutSessionRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """Create a Stripe Checkout session for subscription with rate limiting"""
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Payment system not configured")

    # Rate limit: 5 checkout sessions per hour per user
    rate_limiter = get_rate_limiter()
    allowed, remaining, reset_in = rate_limiter.check_rate_limit(
        key=f"checkout:{current_user.id}",
        max_requests=5,
        window_seconds=3600
    )

    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Too many checkout requests. Please try again in {reset_in} seconds."
        )

    result = await SubscriptionService.create_checkout_session(
        user_id=str(current_user.id),
        email=current_user.email,
        price_id=request.price_id,
        success_url=request.success_url,
        cancel_url=request.cancel_url
    )

    logger.info(f"Checkout session created for user {current_user.id}. Rate limit remaining: {remaining}")

    return CreateCheckoutSessionResponse(**result)


@router.post("/portal/session", response_model=CreatePortalSessionResponse)
async def create_portal_session(
    request: CreatePortalSessionRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """Create a Stripe Customer Portal session for subscription management"""
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Payment system not configured")
    
    result = await SubscriptionService.create_portal_session(
        user_id=str(current_user.id),
        return_url=request.return_url
    )
    
    return CreatePortalSessionResponse(**result)


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None, alias="stripe-signature")
):
    """Handle Stripe webhook events with logging and retry support"""
    if not settings.stripe_webhook_secret:
        logger.warning("Stripe webhook secret not configured")
        raise HTTPException(status_code=503, detail="Webhook not configured")

    payload = await request.body()

    try:
        event = stripe.Webhook.construct_event(
            payload,
            stripe_signature,
            settings.stripe_webhook_secret
        )
    except ValueError as e:
        logger.error(f"Invalid webhook payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Invalid webhook signature: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event["type"]
    event_id = event["id"]
    data = event["data"]["object"]

    logger.info(f"Received Stripe webhook: {event_type} (ID: {event_id})")

    # Process webhook event with error handling
    success = True
    error_message = None

    try:
        # Handle subscription events
        if event_type in [
            "customer.subscription.created",
            "customer.subscription.updated",
        ]:
            await SubscriptionService.handle_subscription_updated(data)

        elif event_type == "customer.subscription.deleted":
            await SubscriptionService.handle_subscription_deleted(data)

        elif event_type == "checkout.session.completed":
            # Session completed - subscription should already be handled
            logger.info(f"Checkout session completed: {data.get('id')}")

        elif event_type == "invoice.payment_succeeded":
            logger.info(f"Payment succeeded for invoice: {data.get('id')}")

        elif event_type == "invoice.payment_failed":
            logger.warning(f"Payment failed for invoice: {data.get('id')}")
            # Extract user from subscription or customer
            subscription_id = data.get("subscription")
            if subscription_id:
                try:
                    subscription = stripe.Subscription.retrieve(subscription_id)
                    user_id = subscription.get("metadata", {}).get("user_id")
                    if user_id:
                        await SubscriptionService.notify_payment_failure(user_id, data.get('id'))
                except Exception as e:
                    logger.error(f"Failed to notify user of payment failure: {e}")

    except Exception as e:
        success = False
        error_message = str(e)
        logger.error(f"Failed to process webhook {event_type} (ID: {event_id}): {e}", exc_info=True)

    # Log webhook event for debugging and potential retry
    await SubscriptionService.log_webhook_event(event_type, event_id, data, success, error_message)

    if not success:
        # Return 500 so Stripe will retry
        raise HTTPException(status_code=500, detail="Webhook processing failed")

    return {"status": "received"}


@router.post("/grandfather-users")
async def grandfather_existing_users(
    admin_user: UserInDB = Depends(get_admin_user)
):
    """
    One-time migration: Mark all existing users as grandfathered.
    They will get Basic tier features for free forever.
    Admin only.
    """
    count = await SubscriptionService.grandfather_existing_users()
    return {"message": f"Successfully grandfathered {count} existing users"}


@router.get("/can-add-student")
async def can_add_student(
    current_user: UserInDB = Depends(get_current_user)
):
    """Check if current user can add another student"""
    can_add, message = await SubscriptionService.can_add_student(str(current_user.id))
    return {"allowed": can_add, "message": message if not can_add else ""}


@router.get("/can-add-evidence")
async def can_add_evidence(
    current_user: UserInDB = Depends(get_current_user)
):
    """Check if current user can add more evidence"""
    can_add, message = await SubscriptionService.can_add_evidence(str(current_user.id))
    return {"allowed": can_add, "message": message if not can_add else ""}


@router.get("/can-generate-reports")
async def can_generate_reports(
    current_user: UserInDB = Depends(get_current_user)
):
    """Check if current user can generate reports"""
    can_generate, message = await SubscriptionService.can_generate_reports(str(current_user.id))
    return {"allowed": can_generate, "message": message if not can_generate else ""}
