from pydantic import EmailStr, Field
from typing import Optional, List
from datetime import datetime
from .base import MongoBaseModel, PyObjectId
from bson import ObjectId

class UserBase(MongoBaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    role: str = "parent"
    is_active: bool = True
    is_verified: bool = False
    last_login: Optional[datetime] = None
    profile_image: Optional[str] = None
    organization_id: Optional[PyObjectId] = None
    family_id: Optional[PyObjectId] = None
    
    # Subscription fields
    subscription_tier: str = "free"
    subscription_status: str = "active"
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    current_period_end: Optional[datetime] = None
    is_grandfathered: bool = False

class Organization(MongoBaseModel):
    name: str
    type: str  # school, homeschool_group, family
    admin_ids: List[PyObjectId]
    subscription_status: str = "active"
    subscription_end_date: Optional[datetime] = None

class UserCreate(UserBase):
    email: EmailStr
    password: str

class UserInDB(UserBase):
    hashed_password: str
    refresh_token: Optional[str] = None

    model_config = {
        "json_encoders": {ObjectId: str},
        "arbitrary_types_allowed": True
    }

class User(UserBase):
    id: str
    is_active: bool
    created_at: datetime

    model_config = {
        "from_attributes": True
    }
