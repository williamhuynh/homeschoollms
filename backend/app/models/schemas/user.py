from pydantic import EmailStr, Field
from typing import Optional, List
from datetime import datetime
from .base import MongoBaseModel, PyObjectId

class UserBase(MongoBaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    role: str = "parent"  # parent, teacher, admin
    is_active: bool = True
    is_verified: bool = False
    last_login: Optional[datetime] = None
    profile_image: Optional[str] = None
    organization_id: Optional[PyObjectId] = None  # For school/institution
    family_id: Optional[PyObjectId] = None  # For family grouping

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

class User(UserBase):
    id: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True