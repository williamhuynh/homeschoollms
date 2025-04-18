from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict  # Updated imports
from pydantic import BaseModel  # Add this import
from ..services.user_service import UserService
from ..models.schemas.user import UserCreate, UserInDB
from ..utils.auth_utils import get_current_user, get_admin_user  # Add get_admin_user

router = APIRouter()

# Add these new models
class UserUpdate(BaseModel):
    role: str = None
    first_name: str = None
    last_name: str = None
    is_active: bool = None
    is_verified: bool = None

class UserRoleUpdate(BaseModel):
    role: str

@router.post("/users/", response_model=UserInDB)
async def create_user(user: UserCreate):
    return await UserService.create_user(user)

@router.get("/users/me", response_model=UserInDB)
async def get_current_user_profile(current_user: UserInDB = Depends(get_current_user)):
    return current_user

@router.get("/users/family/{family_id}", response_model=List[UserInDB])
async def get_family_members(
    family_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    return await UserService.get_family_members(family_id)

# Add these new endpoints
@router.put("/users/{user_id}", response_model=UserInDB)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    admin_user: UserInDB = Depends(get_admin_user)  # Only admins can update users
):
    """Update a user's attributes. Admin only."""
    # Filter out None values to only update provided fields
    update_data = {k: v for k, v in user_update.dict().items() if v is not None}
    return await UserService.update_user(user_id, update_data)

@router.put("/users/{user_id}/role", response_model=UserInDB)
async def update_user_role(
    user_id: str,
    role_update: UserRoleUpdate,
    admin_user: UserInDB = Depends(get_admin_user)  # Only admins can update roles
):
    """Update a user's role. Admin only."""
    return await UserService.update_user(user_id, {"role": role_update.role})

@router.put("/users/email/{email}/set-admin", response_model=Dict[str, str])
async def set_user_as_admin(
    email: str,
    admin_user: UserInDB = Depends(get_admin_user)  # Only admins can create other admins
):
    """Set a user as admin by email. Admin only."""
    db_user = await UserService.get_user_by_email(email)
    if not db_user:
        raise HTTPException(status_code=404, detail=f"User with email {email} not found")
    
    await UserService.update_user(str(db_user.id), {"role": "admin"})
    return {"message": f"User {email} has been set as admin"}