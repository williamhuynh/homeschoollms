from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response
from bson import ObjectId
from ..services.learning_outcome_service import LearningOutcomeService
from ..services.file_storage_service import file_storage_service
from ..utils.database_utils import Database
from ..models.schemas.learning_outcome import LearningOutcome
from ..utils.auth_utils import get_current_user, get_current_user_with_org
from typing import List, Optional, Dict, Any # Added List
from ..models.schemas.user import UserInDB
from datetime import datetime
import os
import uuid # Added for unique filenames
import logging # Added for better logging control
import re # Added for outcome code lookup

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

# Configure logger
logger = logging.getLogger(__name__)
# Set level to INFO or DEBUG for more detailed logs if needed
# logging.basicConfig(level=logging.INFO) 

@router.post("/learning-outcomes/{student_id}/{learning_outcome_id}/evidence")
async def upload_evidence(
    student_id: str,
    learning_outcome_id: str,
    files: List[UploadFile] = File(...), # Changed to accept a list of files
    title: str = Form(...), # Make title mandatory on backend too for consistency
    description: str = Form(""),
    location: Optional[str] = Form(None), # New optional field
    learning_area_code: Optional[str] = Form(None), # New optional field
    learning_outcome_code: Optional[str] = Form(None), # New optional field
    current_user: UserInDB = Depends(get_current_user)
):
    logger.info(f"Received {len(files)} file(s) for student {student_id}, path outcome {learning_outcome_id}")
    logger.info(f"Form data - Title: '{title}', Desc: '{description}', Loc: '{location}', Area: '{learning_area_code}', Outcome: '{learning_outcome_code}'")

    uploaded_files_info = []
    db = Database.get_db()
    outcome_obj_id = None
    outcome_code_to_use = learning_outcome_code or learning_outcome_id # Prioritize form input

    # --- Find or Create Learning Outcome (only needs to be done once) ---
    logger.info(f"Attempting to find/create learning outcome using code: {outcome_code_to_use}")
    try:
        # Try converting first, might be an ObjectId passed in path
        outcome_obj_id = ObjectId(outcome_code_to_use)
        logger.info(f"Successfully converted outcome code/id to ObjectId: {outcome_obj_id}")
        # Verify it exists
        if not await db.learning_outcomes.find_one({"_id": outcome_obj_id}):
             logger.warning(f"ObjectId {outcome_obj_id} provided but not found in DB. Will proceed to lookup by code.")
             outcome_obj_id = None # Reset to trigger code lookup
    except Exception:
        logger.info(f"'{outcome_code_to_use}' is not an ObjectId. Looking up by code.")
        outcome_obj_id = None # Ensure it's None before code lookup

    if not outcome_obj_id:
        # Look up by code (case-insensitive)
        code_pattern = re.compile(f"^{re.escape(outcome_code_to_use)}$", re.IGNORECASE)
        outcome = await db.learning_outcomes.find_one({"code": {"$regex": code_pattern}})
        
        if not outcome:
            logger.warning(f"No learning outcome found with code: '{outcome_code_to_use}'. Cannot auto-create without more context.")
            # We won't auto-create here anymore, rely on the dropdowns providing valid codes
            raise HTTPException(status_code=404, detail=f"Learning outcome '{outcome_code_to_use}' not found.")
        else:
            outcome_obj_id = outcome["_id"]
            logger.info(f"Found existing learning outcome with ID: {outcome_obj_id} for code {outcome_code_to_use}")

    if not outcome_obj_id:
         # This case should ideally not be reached if the above logic is correct
         raise HTTPException(status_code=404, detail=f"Learning outcome '{outcome_code_to_use}' could not be resolved.")
    # --- End Find or Create Learning Outcome ---

    # --- Process each uploaded file ---
    for file in files:
        try:
            logger.info(f"Processing file: {file.filename} ({file.content_type}, Size: {file.size})")

            # Basic validation
            if not file.filename:
                 logger.warning("Skipping file with no filename.")
                 continue
            if file.size == 0:
                 logger.warning(f"Skipping empty file: {file.filename}")
                 continue

            # Ensure file pointer is at the beginning
            await file.seek(0) 

            # Generate unique file path using UUID
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            unique_id = uuid.uuid4()
            # Get the file extension without the dot
            file_extension = os.path.splitext(file.filename)[1].lower()
            # Remove any existing extension from the unique_id
            unique_id_str = str(unique_id)
            if '.' in unique_id_str:
                unique_id_str = unique_id_str.split('.')[0]
            # Example path: evidence/student_id/outcome_id/20250410202100-uuid-guid.jpg
            file_path = f"evidence/{student_id}/{learning_outcome_id}/{timestamp}-{unique_id_str}{file_extension}"
            
            logger.info(f"Generated file path: {file_path}")

            # Upload to Backblaze B2 with thumbnail generation
            upload_result = await file_storage_service.upload_file(
                file,
                file_path,
                generate_thumbnail=True,
                thumbnail_size=(200, 200)  # Default thumbnail size
            )
            file_url = upload_result["original_url"] # Use the correct key for the main file URL
            thumbnail_url = upload_result.get("thumbnail_small_url") # Use one of the available thumbnail URLs
            
            logger.info(f"File uploaded successfully to: {file_url}")
            if thumbnail_url:
                logger.info(f"Thumbnail generated at: {thumbnail_url}")
            else:
                logger.warning(f"No thumbnail was generated for {file.filename}")

            # Store file reference in database
            evidence_doc = {
                "student_id": ObjectId(student_id),
                "learning_outcome_id": outcome_obj_id, # The resolved ObjectId
                "learning_area_code": learning_area_code, # New field
                "learning_outcome_code": outcome_code_to_use, # Store the code used
                "location": location, # New field
                "file_url": file_url,
                "thumbnail_url": thumbnail_url,  # New field for thumbnail URL
                "file_name": file.filename,
                "title": title, # Title is now mandatory
                "description": description,
                "uploaded_at": datetime.now(),
                "uploaded_by": ObjectId(current_user.id)
            }
            insert_result = await db.student_evidence.insert_one(evidence_doc)
            logger.info(f"Evidence record created with ID: {insert_result.inserted_id} for file {file.filename}")
            
            uploaded_files_info.append({
                "filename": file.filename,
                "file_url": file_url,
                "thumbnail_url": thumbnail_url,
                "evidence_id": str(insert_result.inserted_id)
            })

        except Exception as e:
            logger.error(f"Error processing file {file.filename}: {str(e)}")
            # Decide whether to continue with other files or raise immediately
            # For now, let's raise immediately to signal a partial failure
            raise HTTPException(status_code=500, detail=f"Error processing file {file.filename}: {str(e)}")
        finally:
            # Ensure file is closed even if errors occur
             await file.close()
             logger.debug(f"Closed file: {file.filename}")
    # --- End file processing loop ---

    if not uploaded_files_info:
         raise HTTPException(status_code=400, detail="No valid files were processed.")

    return {
        "message": f"{len(uploaded_files_info)} file(s) uploaded successfully", 
        "uploaded_files": uploaded_files_info
    }

@router.delete("/learning-outcomes/{student_id}/{learning_outcome_id}/evidence/{evidence_id}")
async def delete_evidence(
    student_id: str,
    learning_outcome_id: str,
    evidence_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Mark evidence as deleted without removing it from storage.
    """
    try:
        result = await LearningOutcomeService.mark_evidence_as_deleted(
            student_id, 
            learning_outcome_id, 
            evidence_id
        )
        return {"message": "Evidence marked as deleted", "success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/learning-outcomes/{student_id}/{learning_outcome_id}/evidence/{evidence_id}/download")
async def download_evidence(
    student_id: str,
    learning_outcome_id: str,
    evidence_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Generate a download URL for the evidence file.
    """
    try:
        download_url = await LearningOutcomeService.generate_evidence_download_url(
            student_id, 
            learning_outcome_id, 
            evidence_id
        )
        return {"download_url": download_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/learning-outcomes/{student_id}/{learning_outcome_id}/evidence/{evidence_id}/share")
async def share_evidence(
    student_id: str,
    learning_outcome_id: str,
    evidence_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Generate a shareable URL for the evidence file.
    """
    try:
        share_url = await LearningOutcomeService.generate_evidence_share_url(
            student_id, 
            learning_outcome_id, 
            evidence_id
        )
        return {"share_url": share_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
