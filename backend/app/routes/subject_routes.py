from fastapi import APIRouter, Depends, HTTPException
from ..services.subject_service import SubjectService
from ..models.schemas.subject import Subject
from ..utils.auth_utils import get_current_user, get_current_user_with_org
from typing import List, Optional

router = APIRouter()

@router.post("/subjects/", response_model=Subject)
async def create_subject(
    subject: Subject,
    current_user: UserInDB = Depends(get_current_user_with_org)
):
    return await SubjectService.create_subject(subject, str(current_user.organization_id))

@router.get("/subjects/", response_model=List[Subject])
async def get_subjects(
    grade_level: Optional[str] = None,
    current_user: UserInDB = Depends(get_current_user)
):
    org_id = str(current_user.organization_id) if current_user.organization_id else None
    return await SubjectService.get_subjects(org_id, grade_level)

@router.get("/subjects/{subject_id}/hierarchy", response_model=List[Subject])
async def get_subject_hierarchy(
    subject_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    return await SubjectService.get_subject_hierarchy(subject_id)