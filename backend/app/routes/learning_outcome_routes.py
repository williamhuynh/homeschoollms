from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from bson import ObjectId
from ..services.learning_outcome_service import LearningOutcomeService
from ..services.file_storage_service import file_storage_service
from ..utils.database_utils import Database
from ..models.schemas.learning_outcome import LearningOutcome
from ..utils.auth_utils import get_current_user, get_current_user_with_org
from typing import List, Optional
from ..models.schemas.user import UserInDB
from datetime import datetime
import os
import requests

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

@router.get("/evidence-proxy")
async def proxy_evidence_image(url: str):
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Log the requested URL
        logger.info(f"Proxying image request for URL: {url}")
        
        # Make a request to the Backblaze URL
        response = requests.get(url, stream=True)
        
        # Check if the request was successful
        if response.status_code != 200:
            logger.error(f"Error fetching image: {response.status_code}")
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch image")
        
        # Get the content type from the response
        content_type = response.headers.get('Content-Type', 'image/png')
        
        # Return the image with the appropriate content type
        return Response(
            content=response.content,
            media_type=content_type,
            headers={
                "Cache-Control": "public, max-age=86400",  # Cache for 24 hours
                "Access-Control-Allow-Origin": "*"  # Allow requests from any origin
            }
        )
    except Exception as e:
        logger.error(f"Error proxying image: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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
        
        # Try to convert learning outcome ID to ObjectId
        try:
            outcome_obj_id = ObjectId(learning_outcome_id)
            logger.error(f"Successfully converted learning_outcome_id to ObjectId: {outcome_obj_id}")
        except Exception as e:
            logger.error(f"Failed to convert learning_outcome_id to ObjectId: {str(e)}")
            # If conversion fails, look up by code (case-insensitive)
            import re
            
            # Log the learning outcome ID we're searching for
            logger.error(f"Looking up learning outcome by code: '{learning_outcome_id}'")
            
            # Check if any learning outcomes exist in the collection
            count = await db.learning_outcomes.count_documents({})
            logger.error(f"Total learning outcomes in database: {count}")
            
            # Get a sample of learning outcomes to see what's in the database
            sample = await db.learning_outcomes.find().limit(5).to_list(None)
            logger.error(f"Sample learning outcomes: {[lo.get('code', 'No code') for lo in sample]}")
            
            # Try exact match first (case-insensitive)
            code_pattern = re.compile(f"^{re.escape(learning_outcome_id)}$", re.IGNORECASE)
            logger.error(f"Regex pattern: {code_pattern.pattern}")
            
            outcome = await db.learning_outcomes.find_one({"code": {"$regex": code_pattern}})
            
            if not outcome:
                logger.error(f"No learning outcome found with exact code match: '{learning_outcome_id}'")
                
                # Try partial match as fallback
                partial_pattern = re.compile(f"{re.escape(learning_outcome_id)}", re.IGNORECASE)
                logger.error(f"Trying partial match with pattern: {partial_pattern.pattern}")
                outcome = await db.learning_outcomes.find_one({"code": {"$regex": partial_pattern}})
            
            if not outcome:
                logger.error(f"No learning outcome found with partial code match either")
                
                # Instead of failing, create the learning outcome in the database
                logger.error(f"Creating new learning outcome with code: {learning_outcome_id}")
                
                # Extract subject code from learning outcome code (e.g., "ENE" from "ENE-OLC-01")
                subject_code = learning_outcome_id.split('-')[0][:3] if len(learning_outcome_id) >= 3 else None
                logger.error(f"Extracted subject code: {subject_code}")
                
                # Find the subject ID
                subject = None
                if subject_code:
                    subject = await db.subjects.find_one({"code": subject_code})
                    logger.error(f"Found subject: {subject}")
                
                # Create a new learning outcome
                new_outcome = {
                    "code": learning_outcome_id,
                    "name": f"Auto-created: {learning_outcome_id}",
                    "description": f"Automatically created learning outcome for evidence upload",
                    "subject_id": subject["_id"] if subject else None,
                    "grade_level": None,
                    "is_standard": True,
                    "created_at": datetime.now()
                }
                
                # Insert the new learning outcome
                result = await db.learning_outcomes.insert_one(new_outcome)
                logger.error(f"Created new learning outcome with ID: {result.inserted_id}")
                
                # Get the newly created learning outcome
                outcome = await db.learning_outcomes.find_one({"_id": result.inserted_id})
                logger.error(f"Retrieved new learning outcome: {outcome}")
            elif outcome:
                logger.error(f"Found learning outcome with partial match: {outcome.get('code')}")
                
            outcome_obj_id = outcome["_id"]
            logger.error(f"Using learning outcome with ID: {outcome_obj_id}")
        
        evidence_doc = {
            "student_id": ObjectId(student_id),
            "learning_outcome_id": outcome_obj_id,
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
