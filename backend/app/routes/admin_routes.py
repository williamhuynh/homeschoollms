"""
Admin Routes - Super Admin API endpoints for platform management.

All routes in this file require super_admin role.
These endpoints provide full platform access for the platform owner.
"""

from fastapi import APIRouter, Depends, Query
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, EmailStr

from ..services.admin_service import AdminService
from ..models.schemas.user import UserInDB
from ..utils.auth_utils import get_super_admin_user

router = APIRouter(prefix="/admin", tags=["Admin"])


# ============================================================
# Request/Response Models
# ============================================================

class UserProfileUpdate(BaseModel):
    """Model for updating user profile"""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    profile_image: Optional[str] = None


class SubscriptionUpdate(BaseModel):
    """Model for updating user subscription"""
    subscription_tier: Optional[str] = None  # "free" or "basic"
    is_grandfathered: Optional[bool] = None
    subscription_status: Optional[str] = None  # "active", "canceled", etc.


class DeleteUserRequest(BaseModel):
    """Model for user deletion request"""
    permanent: bool = False  # If True, permanently delete. If False, soft delete.


class ImpersonateRequest(BaseModel):
    """Model for impersonation request"""
    user_id: str


# ============================================================
# User Management Endpoints
# ============================================================

@router.get("/users", response_model=Dict[str, Any])
async def list_users(
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Max records to return"),
    search: Optional[str] = Query(None, description="Search by email or name"),
    role: Optional[str] = Query(None, description="Filter by role"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    subscription_tier: Optional[str] = Query(None, description="Filter by tier"),
    admin_user: UserInDB = Depends(get_super_admin_user)
):
    """
    List all users with optional filtering and pagination.
    Super admin only.
    """
    return await AdminService.list_users(
        skip=skip,
        limit=limit,
        search=search,
        role=role,
        is_active=is_active,
        subscription_tier=subscription_tier
    )


@router.get("/users/{user_id}", response_model=Dict[str, Any])
async def get_user(
    user_id: str,
    admin_user: UserInDB = Depends(get_super_admin_user)
):
    """
    Get a user's full profile by ID.
    Super admin only.
    """
    return await AdminService.get_user_by_id(user_id)


@router.get("/users/by-email/{email}", response_model=Dict[str, Any])
async def get_user_by_email(
    email: str,
    admin_user: UserInDB = Depends(get_super_admin_user)
):
    """
    Get a user's full profile by email.
    Super admin only.
    """
    return await AdminService.get_user_by_email(email)


@router.put("/users/{user_id}/profile", response_model=Dict[str, Any])
async def update_user_profile(
    user_id: str,
    updates: UserProfileUpdate,
    admin_user: UserInDB = Depends(get_super_admin_user)
):
    """
    Update a user's profile information.
    Super admin only.
    """
    return await AdminService.update_user_profile(user_id, updates.dict(exclude_none=True))


@router.put("/users/{user_id}/subscription", response_model=Dict[str, Any])
async def update_user_subscription(
    user_id: str,
    updates: SubscriptionUpdate,
    admin_user: UserInDB = Depends(get_super_admin_user)
):
    """
    Update a user's subscription settings directly (bypass Stripe).
    Super admin only.
    """
    return await AdminService.update_user_subscription(
        user_id=user_id,
        subscription_tier=updates.subscription_tier,
        is_grandfathered=updates.is_grandfathered,
        subscription_status=updates.subscription_status
    )


@router.post("/users/{user_id}/deactivate", response_model=Dict[str, Any])
async def deactivate_user(
    user_id: str,
    admin_user: UserInDB = Depends(get_super_admin_user)
):
    """
    Deactivate a user account.
    Super admin only.
    """
    return await AdminService.deactivate_user(user_id)


@router.post("/users/{user_id}/reactivate", response_model=Dict[str, Any])
async def reactivate_user(
    user_id: str,
    admin_user: UserInDB = Depends(get_super_admin_user)
):
    """
    Reactivate a user account.
    Super admin only.
    """
    return await AdminService.reactivate_user(user_id)


@router.delete("/users/{user_id}", response_model=Dict[str, str])
async def delete_user(
    user_id: str,
    request: DeleteUserRequest,
    admin_user: UserInDB = Depends(get_super_admin_user)
):
    """
    Delete a user account.
    By default, soft deletes (deactivates). Set permanent=True to permanently delete.
    Super admin only.
    
    WARNING: Permanent deletion cannot be undone.
    """
    return await AdminService.delete_user(user_id, soft_delete=not request.permanent)


# ============================================================
# Student Management Endpoints (Super Admin Bypass)
# ============================================================

@router.get("/students", response_model=Dict[str, Any])
async def list_all_students(
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Max records to return"),
    search: Optional[str] = Query(None, description="Search by student name"),
    admin_user: UserInDB = Depends(get_super_admin_user)
):
    """
    List all students in the system (bypasses parent access checks).
    Super admin only.
    """
    return await AdminService.list_all_students(skip=skip, limit=limit, search=search)


@router.get("/students/{student_id}", response_model=Dict[str, Any])
async def get_student_admin(
    student_id: str,
    admin_user: UserInDB = Depends(get_super_admin_user)
):
    """
    Get any student by ID (bypasses parent access checks).
    Super admin only.
    """
    return await AdminService.get_student_by_id_admin(student_id)


# ============================================================
# Impersonation Endpoints
# ============================================================

@router.post("/impersonate", response_model=Dict[str, Any])
async def start_impersonation(
    request: ImpersonateRequest,
    admin_user: UserInDB = Depends(get_super_admin_user)
):
    """
    Start impersonating another user.
    Returns a temporary token that acts as the target user.
    The token expires in 1 hour for security.
    Super admin only.
    """
    return await AdminService.create_impersonation_token(
        admin_user_id=str(admin_user.id),
        target_user_id=request.user_id
    )


# ============================================================
# Platform Statistics
# ============================================================

@router.get("/stats", response_model=Dict[str, Any])
async def get_platform_stats(
    admin_user: UserInDB = Depends(get_super_admin_user)
):
    """
    Get platform-wide statistics.
    Super admin only.
    """
    return await AdminService.get_platform_stats()
