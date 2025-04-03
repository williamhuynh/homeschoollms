from fastapi import APIRouter, Depends, HTTPException
from ..services.learning_outcome_service import LearningOutcomeService
from ..models.schemas.learning_outcome import LearningOutcome
from ..utils.auth_utils import get_current_user, get_current_user_with_org
from typing import List, Optional
from ..models.schemas.user import UserInDB

router = APIRouter()

@router.post("/learning-outcomes/", response_model=LearningOutcome)
async def create_learning_outcome(
    outcome: LearningOutcome,
    current_user: UserInDB = Depends(get_current_user_with_org)
):
    org_id = str(current_user.organization_id) if current_user.organization_id else None
    return await LearningOutcomeService.create_learning_outcome(outcome, org_id)

@router.get("/learning-outcomes/subject/{subject_id}", response_model=List[LearningOutcome])
async def get_subject_outcomes(
    subject_id: str,
    grade_level: Optional[str] = None,
    current_user: UserInDB = Depends(get_current_user)
):
    org_id = str(current_user.organization_id) if current_user.organization_id else None
    return await LearningOutcomeService.get_subject_outcomes(subject_id, grade_level, org_id)

@router.get("/learning-outcomes/{outcome_id}/prerequisites", response_model=List[LearningOutcome])
async def get_prerequisite_tree(
    outcome_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    return await LearningOutcomeService.get_prerequisite_tree(outcome_id)

@router.post("/learning-outcomes/{outcome_id}/mastery/{student_id}")
async def update_outcome_mastery(
    outcome_id: str,
    student_id: str,
    is_mastered: bool,
    current_user: UserInDB = Depends(get_current_user)
):
    return await LearningOutcomeService.update_mastery_status(student_id, outcome_id, is_mastered)

@router.get("/learning-outcomes/{student_id}/{learning_outcome_id}")
async def get_student_learning_outcome(
    student_id: str,
    learning_outcome_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    return await LearningOutcomeService.get_student_learning_outcome(student_id, learning_outcome_id)
