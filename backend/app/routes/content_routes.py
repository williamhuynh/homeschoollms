from fastapi import APIRouter, Depends, HTTPException
from ..services.content_service import ContentService
from ..models.schemas.content import ContentBase
from ..utils.auth_utils import get_current_user
from typing import List
from ..models.schemas.user import UserInDB

router = APIRouter()

@router.post("/content/", response_model=ContentBase)
async def create_content(
    content: ContentBase,
    current_user: UserInDB = Depends(get_current_user)
):
    return await ContentService.create_content(content, str(current_user.id))

@router.get("/content/subject/{subject_id}", response_model=List[ContentBase])
async def get_subject_content(
    subject_id: str,
    grade_level: str = None,
    current_user: UserInDB = Depends(get_current_user)
):
    return await ContentService.get_subject_content(subject_id, grade_level)