from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from ..services.learning_outcome_service import LearningOutcomeService
from ..services.file_storage_service import file_storage_service
from ..utils.database_utils import Database
from ..models.schemas.learning_outcome import LearningOutcome
from ..utils.auth_utils import get_current_user, get_current_user_with_org
from typing import List, Optional
from ..models.schemas.user import UserInDB
from datetime import datetime
import os

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

@router.get("/learning-outcomes/{student_id}/{learning_outcome_id}/evidence")
async def get_evidence(
    student_id: str,
    learning_outcome_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"Fetching evidence for student {student_id} and outcome {learning_outcome_id}")
        evidence = await LearningOutcomeService.get_evidence(student_id, learning_outcome_id)
        logger.info(f"Found {len(evidence)} evidence records")
        return evidence
    except Exception as e:
        logger.error(f"Error fetching evidence: {str(e)}")
        # Return empty list instead of raising error to allow upload placeholder
        return []

@router.post("/learning-outcomes/{student_id}/{learning_outcome_id}/evidence")
async def upload_evidence(
    student_id: str,
    learning_outcome_id: str,
    file: UploadFile = File(...),
    current_user: UserInDB = Depends(get_current_user)
):
    import logging
    logging.basicConfig(level=logging.ERROR)
    logger = logging.getLogger(__name__)

    try:
        # Log the file object and its file attribute
        logger.error(f"Received file object: {file}")
        logger.error(f"Received file.file: {file.file}")

        # Check if file.file is None
        if file.file is None:
            logger.error("file.file is None")
            raise Exception("file.file is None")

        # Log the type of file.file
        logger.error(f"Type of file.file: {type(file.file)}")

        # Log the seekable status of file.file
        logger.error(f"Is file.file seekable? {file.file.seekable()}")

        # Log the current position of the file.file object
        logger.error(f"Current position of file.file before seek: {file.file.tell()}")

        # Check if file.file is seekable and seek to the beginning if it is
        if file.file.seekable():
            file.file.seek(0)
            logger.error(f"Seeked file.file to position: {file.file.tell()}")

        # Generate unique file path
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        file_extension = os.path.splitext(file.filename)[1]
        file_path = f"evidence/{student_id}/{learning_outcome_id}/{timestamp}{file_extension}"
        
        # Log the file path
        logger.error(f"Generated file path: {file_path}")

        # Log the file content type
        logger.error(f"File content type: {file.content_type}")

        # Log the file size
        logger.error(f"File size: {file.size}")

        # Upload to Backblaze B2
        file_url = await file_storage_service.upload_file(file, file_path)
        
        # Log the current position of the file.file object after upload
        logger.error(f"Current position of file.file after upload: {file.file.tell()}")

        # Log the file URL
        logger.error(f"File URL: {file_url}")

        # Store file reference in database
        db = Database.get_db()
        evidence_doc = {
            "student_id": ObjectId(student_id),
            "learning_outcome_id": ObjectId(learning_outcome_id),
            "file_url": file_url,
            "file_name": file.filename,
            "uploaded_at": datetime.now(),
            "uploaded_by": ObjectId(current_user.id)
        }
        await db.student_evidence.insert_one(evidence_doc)
        
        return {"message": "File uploaded successfully", "file_url": file_url}
    except Exception as e:
        logger.error(f"Error uploading evidence: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
