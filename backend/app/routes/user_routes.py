from fastapi import APIRouter, Depends, HTTPException
from ..services.user_service import UserService
from ..models.schemas.user import UserCreate, UserInDB
from ..utils.auth_utils import get_current_user

router = APIRouter()

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