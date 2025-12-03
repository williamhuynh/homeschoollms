import stripe
import logging
from typing import Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
from fastapi import HTTPException

from ..utils.database_utils import Database
from ..config.settings import settings
from ..models.schemas.subscription import (
    SubscriptionTier,
    SubscriptionStatus,
    SubscriptionUsage,
    TIER_LIMITS,
)

# Configure Stripe
if settings.stripe_secret_key:
    stripe.api_key = settings.stripe_secret_key

logger = logging.getLogger(__name__)


class SubscriptionService:
    """Service for managing user subscriptions and Stripe integration"""
    
    @staticmethod
    def get_tier_limits(tier: str) -> Dict[str, Any]:
        """Get the limits for a subscription tier"""
        try:
            tier_enum = SubscriptionTier(tier)
            return TIER_LIMITS.get(tier_enum, TIER_LIMITS[SubscriptionTier.FREE])
        except ValueError:
            return TIER_LIMITS[SubscriptionTier.FREE]
    
    @staticmethod
    async def get_user_subscription(user_id: str) -> Dict[str, Any]:
        """Get subscription info for a user"""
        db = Database.get_db()
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        tier = user.get("subscription_tier", "free")
        is_grandfathered = user.get("is_grandfathered", False)
        
        # Grandfathered users get basic tier
        effective_tier = "basic" if is_grandfathered else tier
        
        return {
            "tier": tier,
            "effective_tier": effective_tier,
            "status": user.get("subscription_status", "active"),
            "stripe_customer_id": user.get("stripe_customer_id"),
            "stripe_subscription_id": user.get("stripe_subscription_id"),
            "current_period_end": user.get("current_period_end"),
            "is_grandfathered": is_grandfathered,
        }
    
    @staticmethod
    async def get_student_count(user_id: str) -> int:
        """Get the number of students a user has created"""
        db = Database.get_db()
        
        # Count students where user is in parent_ids or parent_access with admin role
        count = await db.students.count_documents({
            "$or": [
                {"parent_ids": ObjectId(user_id)},
                {"parent_access.parent_id": ObjectId(user_id)}
            ]
        })
        
        return count
    
    @staticmethod
    async def get_evidence_count(user_id: str) -> int:
        """Get the total evidence count for all students owned by user"""
        db = Database.get_db()
        
        # Get all students for this user
        students = await db.students.find({
            "$or": [
                {"parent_ids": ObjectId(user_id)},
                {"parent_access.parent_id": ObjectId(user_id)}
            ]
        }).to_list(None)
        
        if not students:
            return 0
        
        student_ids = [str(s["_id"]) for s in students]
        
        # Count evidence across all learning outcomes for these students
        total_evidence = 0
        
        async for lo in db.learning_outcomes.find({"student_id": {"$in": student_ids}}):
            evidence_list = lo.get("evidence", [])
            total_evidence += len(evidence_list)
        
        return total_evidence
    
    @staticmethod
    async def get_usage(user_id: str) -> SubscriptionUsage:
        """Get current usage and limits for a user"""
        subscription = await SubscriptionService.get_user_subscription(user_id)
        effective_tier = subscription["effective_tier"]
        limits = SubscriptionService.get_tier_limits(effective_tier)
        
        student_count = await SubscriptionService.get_student_count(user_id)
        evidence_count = await SubscriptionService.get_evidence_count(user_id)
        
        max_students = limits["max_students"]
        max_evidence = limits["max_evidence"]
        
        return SubscriptionUsage(
            student_count=student_count,
            evidence_count=evidence_count,
            max_students=max_students,
            max_evidence=max_evidence,
            can_generate_reports=limits["can_generate_reports"],
            students_remaining=max(0, max_students - student_count),
            evidence_remaining=max(0, max_evidence - evidence_count),
            is_at_student_limit=student_count >= max_students,
            is_at_evidence_limit=evidence_count >= max_evidence,
        )
    
    @staticmethod
    async def can_add_student(user_id: str) -> tuple[bool, str]:
        """Check if user can add another student"""
        usage = await SubscriptionService.get_usage(user_id)
        
        if usage.is_at_student_limit:
            return False, f"You've reached your limit of {usage.max_students} student(s). Upgrade to Basic to add more students."
        
        return True, ""
    
    @staticmethod
    async def can_add_evidence(user_id: str) -> tuple[bool, str]:
        """Check if user can add more evidence"""
        usage = await SubscriptionService.get_usage(user_id)
        
        if usage.is_at_evidence_limit:
            return False, f"You've reached your limit of {usage.max_evidence} evidence uploads. Upgrade to Basic for more uploads."
        
        return True, ""
    
    @staticmethod
    async def can_generate_reports(user_id: str) -> tuple[bool, str]:
        """Check if user can generate reports"""
        subscription = await SubscriptionService.get_user_subscription(user_id)
        effective_tier = subscription["effective_tier"]
        limits = SubscriptionService.get_tier_limits(effective_tier)
        
        if not limits["can_generate_reports"]:
            return False, "Report generation is a premium feature. Upgrade to Basic to generate reports."
        
        return True, ""
    
    @staticmethod
    async def get_or_create_stripe_customer(user_id: str, email: str) -> str:
        """Get existing or create new Stripe customer"""
        db = Database.get_db()
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Return existing customer ID if present
        if user.get("stripe_customer_id"):
            return user["stripe_customer_id"]
        
        # Create new Stripe customer
        try:
            customer = stripe.Customer.create(
                email=email,
                metadata={"user_id": user_id}
            )
            
            # Save customer ID to database
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"stripe_customer_id": customer.id}}
            )
            
            return customer.id
        except stripe.error.StripeError as e:
            logger.error(f"Failed to create Stripe customer: {e}")
            raise HTTPException(status_code=500, detail="Failed to create payment customer")
    
    @staticmethod
    async def create_checkout_session(
        user_id: str,
        email: str,
        price_id: str,
        success_url: str,
        cancel_url: str
    ) -> Dict[str, str]:
        """Create a Stripe Checkout session for subscription"""
        customer_id = await SubscriptionService.get_or_create_stripe_customer(user_id, email)
        
        try:
            session = stripe.checkout.Session.create(
                customer=customer_id,
                mode="subscription",
                line_items=[{"price": price_id, "quantity": 1}],
                success_url=success_url,
                cancel_url=cancel_url,
                metadata={"user_id": user_id},
                subscription_data={
                    "metadata": {"user_id": user_id}
                },
                allow_promotion_codes=True,
            )
            
            return {
                "checkout_url": session.url,
                "session_id": session.id
            }
        except stripe.error.StripeError as e:
            logger.error(f"Failed to create checkout session: {e}")
            raise HTTPException(status_code=500, detail="Failed to create checkout session")
    
    @staticmethod
    async def create_portal_session(user_id: str, return_url: str) -> Dict[str, str]:
        """Create a Stripe Customer Portal session"""
        db = Database.get_db()
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        customer_id = user.get("stripe_customer_id")
        if not customer_id:
            raise HTTPException(status_code=400, detail="No subscription found. Please subscribe first.")
        
        try:
            session = stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url=return_url
            )
            
            return {"portal_url": session.url}
        except stripe.error.StripeError as e:
            logger.error(f"Failed to create portal session: {e}")
            raise HTTPException(status_code=500, detail="Failed to create portal session")
    
    @staticmethod
    async def handle_subscription_updated(subscription: Dict[str, Any]):
        """Handle subscription created/updated webhook"""
        db = Database.get_db()
        
        user_id = subscription.get("metadata", {}).get("user_id")
        if not user_id:
            logger.warning("Subscription webhook missing user_id in metadata")
            return
        
        status = subscription.get("status")
        current_period_end = subscription.get("current_period_end")
        
        # Map Stripe status to our status
        status_map = {
            "active": SubscriptionStatus.ACTIVE.value,
            "canceled": SubscriptionStatus.CANCELED.value,
            "past_due": SubscriptionStatus.PAST_DUE.value,
            "incomplete": SubscriptionStatus.INCOMPLETE.value,
            "trialing": SubscriptionStatus.TRIALING.value,
        }
        
        mapped_status = status_map.get(status, SubscriptionStatus.ACTIVE.value)
        
        # Determine tier based on subscription status
        tier = SubscriptionTier.BASIC.value if status in ["active", "trialing"] else SubscriptionTier.FREE.value
        
        update_data = {
            "subscription_tier": tier,
            "subscription_status": mapped_status,
            "stripe_subscription_id": subscription.get("id"),
            "current_period_end": datetime.fromtimestamp(current_period_end) if current_period_end else None,
        }
        
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )
        
        logger.info(f"Updated subscription for user {user_id}: tier={tier}, status={mapped_status}")
    
    @staticmethod
    async def handle_subscription_deleted(subscription: Dict[str, Any]):
        """Handle subscription canceled/deleted webhook"""
        db = Database.get_db()
        
        user_id = subscription.get("metadata", {}).get("user_id")
        if not user_id:
            logger.warning("Subscription deletion webhook missing user_id")
            return
        
        # Reset to free tier
        update_data = {
            "subscription_tier": SubscriptionTier.FREE.value,
            "subscription_status": SubscriptionStatus.CANCELED.value,
            "stripe_subscription_id": None,
            "current_period_end": None,
        }
        
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )
        
        logger.info(f"Subscription canceled for user {user_id}, reverted to free tier")
    
    @staticmethod
    async def grandfather_existing_users():
        """Mark all existing users as grandfathered (one-time migration)"""
        db = Database.get_db()
        
        result = await db.users.update_many(
            {"is_grandfathered": {"$ne": True}},
            {
                "$set": {
                    "is_grandfathered": True,
                    "subscription_tier": "free",  # Keep as free but they get basic limits
                    "subscription_status": "active"
                }
            }
        )
        
        logger.info(f"Grandfathered {result.modified_count} existing users")
        return result.modified_count
    
    @staticmethod
    def get_pricing_info() -> Dict[str, Any]:
        """Get subscription pricing information for frontend"""
        return {
            "monthly_price_id": settings.stripe_monthly_price_id,
            "annual_price_id": settings.stripe_annual_price_id,
            "monthly_amount": 1000,  # $10.00 in cents
            "annual_amount": 10800,  # $108.00 in cents
            "currency": "usd",
            "tiers": {
                "free": {
                    "name": "Free",
                    "price": 0,
                    "features": [
                        "1 student profile",
                        "15 evidence uploads",
                        "Progress tracking",
                        "Curriculum alignment",
                    ],
                    "limitations": [
                        "No report generation"
                    ]
                },
                "basic": {
                    "name": "Basic",
                    "monthly_price": 10,
                    "annual_price": 108,
                    "annual_savings": 12,
                    "features": [
                        "Up to 3 student profiles",
                        "1,000 evidence uploads",
                        "Full report generation",
                        "Progress tracking",
                        "Curriculum alignment",
                        "Priority support",
                    ],
                    "limitations": []
                }
            }
        }
