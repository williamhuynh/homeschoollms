from fastapi import APIRouter, Depends, HTTPException
from ..services.progress_service import ProgressService
from ..models.schemas.progress import Progress
from ..utils.auth_utils import get_current_user
from typing import List

router = APIRouter()

@router.post("/progress/{student_id}/{content_id}", response_model=Progress)
async def update_student_progress(
    student_id: str,
    content_id: str,
    status: str,
    score: float = None,
    current_user: UserInDB = Depends(get_current_user)
):
    return await ProgressService.update_progress(student_id, content_id, status, score)

@router.get("/progress/{student_id}", response_model=List[Progress])
async def get_student_progress(
    student_id: str,
    subject_id: str = None,
    current_user: UserInDB = Depends(get_current_user)
):
    return await ProgressService.get_student_progress(student_id, subject_id)