from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
from enum import Enum


class SubscriptionTier(str, Enum):
    FREE = "free"
    BASIC = "basic"


class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    CANCELED = "canceled"
    PAST_DUE = "past_due"
    INCOMPLETE = "incomplete"
    TRIALING = "trialing"


# Tier limits configuration
TIER_LIMITS = {
    SubscriptionTier.FREE: {
        "max_students": 1,
        "max_evidence": 15,
        "can_generate_reports": False,
    },
    SubscriptionTier.BASIC: {
        "max_students": 3,
        "max_evidence": 1000,
        "can_generate_reports": True,
    },
}


class SubscriptionInfo(BaseModel):
    """Subscription information attached to a user"""
    tier: SubscriptionTier = SubscriptionTier.FREE
    status: SubscriptionStatus = SubscriptionStatus.ACTIVE
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    current_period_end: Optional[datetime] = None
    is_grandfathered: bool = False
    
    model_config = {
        "use_enum_values": True
    }


class SubscriptionUsage(BaseModel):
    """Current usage statistics for a user"""
    student_count: int = 0
    evidence_count: int = 0
    
    # Limits based on tier
    max_students: int
    max_evidence: int
    can_generate_reports: bool
    
    # Computed fields
    students_remaining: int
    evidence_remaining: int
    is_at_student_limit: bool
    is_at_evidence_limit: bool


class CreateCheckoutSessionRequest(BaseModel):
    """Request body for creating a checkout session"""
    price_id: str
    success_url: str
    cancel_url: str


class CreateCheckoutSessionResponse(BaseModel):
    """Response for checkout session creation"""
    checkout_url: str
    session_id: str


class CreatePortalSessionRequest(BaseModel):
    """Request body for creating a customer portal session"""
    return_url: str


class CreatePortalSessionResponse(BaseModel):
    """Response for portal session creation"""
    portal_url: str


class SubscriptionPricing(BaseModel):
    """Pricing information for display"""
    monthly_price_id: str
    annual_price_id: str
    monthly_amount: int  # in cents
    annual_amount: int   # in cents
    currency: str = "usd"
