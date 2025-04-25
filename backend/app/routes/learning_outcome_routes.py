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
    db = Database.get_db()
    resolved_student_id = await resolve_student_id(student_id, db)
    return await LearningOutcomeService.get_student_learning_outcome(resolved_student_id, learning_outcome_id)

@router.get("/learning-outcomes/{student_id}/{learning_outcome_id}/evidence")
async def get_evidence(
    student_id: str,
    learning_outcome_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    import logging
    logger = logging.getLogger(__name__)
    db = Database.get_db()
    resolved_student_id = await resolve_student_id(student_id, db)
    try:
        logger.info(f"Fetching evidence for student {resolved_student_id} and outcome {learning_outcome_id}")
        evidence = await LearningOutcomeService.get_evidence(resolved_student_id, learning_outcome_id)
        logger.info(f"Found {len(evidence)} evidence records")
        if evidence and len(evidence) > 0:
            logger.info(f"First evidence item: {evidence[0].get('title', 'No title')} - {evidence[0].get('fileUrl', 'No URL')}")
        return evidence
    except Exception as e:
        logger.error(f"Error fetching evidence: {str(e)}")
        return []

@router.get("/evidence/batch/student/{student_id}")
async def get_batch_evidence(
    student_id: str,
    outcomes: str,
    current_user: UserInDB = Depends(get_current_user)
):
    import logging
    logger = logging.getLogger(__name__)
    db = Database.get_db()
    resolved_student_id = await resolve_student_id(student_id, db)
    try:
        outcome_codes = [code.strip() for code in outcomes.split(',') if code.strip()]
        logger.info(f"Fetching batch evidence for student {resolved_student_id} and outcomes: {outcome_codes}")
        if not outcome_codes:
            return {}
        evidence_map = await LearningOutcomeService.get_batch_evidence(resolved_student_id, outcome_codes)
        logger.info(f"Found evidence for {len(evidence_map)} outcomes")
        return evidence_map
    except Exception as e:
        logger.error(f"Error fetching batch evidence: {str(e)}")
        return {}

# Configure logger
logger = logging.getLogger(__name__)
# Set level to INFO or DEBUG for more detailed logs if needed
# logging.basicConfig(level=logging.INFO) 

# Utility function to resolve student_id as ObjectId or slug
async def resolve_student_id(student_id_or_slug, db):
    try:
        # Try to interpret as ObjectId
        obj_id = ObjectId(student_id_or_slug)
        student = await db.students.find_one({"_id": obj_id})
        if student:
            return str(student["_id"])
    except Exception:
        pass
    # Try as slug
    student = await db.students.find_one({"slug": student_id_or_slug})
    if student:
        return str(student["_id"])
    raise HTTPException(status_code=404, detail=f"Student not found for id or slug: {student_id_or_slug}")

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
    student_grade: Optional[str] = Form(None), # Added student grade
    learning_outcome_description: Optional[str] = Form(None), # Added learning outcome description
    current_user: UserInDB = Depends(get_current_user)
):
    logger.info(f"Received {len(files)} file(s) for student {student_id}, path outcome {learning_outcome_id}")
    logger.info(f"Form data - Title: '{title}', Desc: '{description}', Loc: '{location}', Area: '{learning_area_code}', Outcome: '{learning_outcome_code}'")
    logger.info(f"Additional context - Grade: '{student_grade}', Outcome Desc: '{learning_outcome_description}'")

    uploaded_files_info = []
    db = Database.get_db()
    # --- Resolve student_id as ObjectId or slug ---
    resolved_student_id = await resolve_student_id(student_id, db)
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
            logger.warning(f"No learning outcome found with code: '{outcome_code_to_use}'. Attempting to auto-create.")
            
            # Auto-create the learning outcome with available context
            try:
                # Prepare learning outcome document
                new_outcome = {
                    "code": outcome_code_to_use,
                    "name": f"Auto-created: {outcome_code_to_use}",
                    "description": learning_outcome_description or "Automatically created learning outcome for evidence upload",
                    "subject_id": None,  # We don't have subject_id here
                    "grade_level": student_grade,  # Use provided grade level
                    "is_standard": True,
                    "created_at": datetime.now()
                }
                
                # Determine stage from grade if available
                if student_grade:
                    # Logic to map grade to stage
                    stage_mapping = {
                        "Kindergarten": "Early Stage 1",
                        "Year 1": "Stage 1", 
                        "Year 2": "Stage 1",
                        "Year 3": "Stage 2", 
                        "Year 4": "Stage 2",
                        "Year 5": "Stage 3", 
                        "Year 6": "Stage 3",
                        # Add more mappings as needed
                    }
                    stage = stage_mapping.get(student_grade)
                    if stage:
                        new_outcome["stage"] = stage
                        logger.info(f"Mapped grade '{student_grade}' to stage '{stage}'")
                
                # If learning_area_code is provided, add it to context
                if learning_area_code:
                    new_outcome["learning_area_code"] = learning_area_code
                
                # Insert the new learning outcome
                insert_result = await db.learning_outcomes.insert_one(new_outcome)
                outcome_obj_id = insert_result.inserted_id
                logger.info(f"Auto-created learning outcome with ID: {outcome_obj_id} for code {outcome_code_to_use}")
                
                # Add a log entry to track auto-creations for admin review
                try:
                    await db.system_logs.insert_one({
                        "type": "learning_outcome_auto_created",
                        "outcome_code": outcome_code_to_use,
                        "outcome_id": outcome_obj_id,
                        "created_at": datetime.now(),
                        "created_by": ObjectId(current_user.id) if current_user else None,
                        "context": {
                            "student_id": resolved_student_id,
                            "learning_area_code": learning_area_code,
                            "title": title,
                            "student_grade": student_grade,
                            "stage": new_outcome.get("stage"),
                            "from_evidence_upload": True
                        }
                    })
                except Exception as log_err:
                    # Don't fail the main operation if logging fails
                    logger.warning(f"Failed to create auto-creation log: {str(log_err)}")
            except Exception as e:
                logger.error(f"Failed to auto-create learning outcome: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Failed to auto-create learning outcome: {str(e)}")
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
            # Get the file extension without the dot and ensure it's lowercase
            file_extension = os.path.splitext(file.filename)[1].lower()
            # Remove any existing extension from the unique_id and clean it
            unique_id_str = str(unique_id).replace('-', '')  # Remove hyphens
            if '.' in unique_id_str:
                unique_id_str = unique_id_str.split('.')[0]  # Remove any extension
            # Example path: evidence/student_id/outcome_id/20250410202100-uuid-guid.jpg
            file_path = f"evidence/{resolved_student_id}/{learning_outcome_id}/{timestamp}-{unique_id_str}{file_extension}"
            
            # Log the generated file path for debugging
            logger.info(f"Generated file path: {file_path}")
            logger.info(f"Original filename: {file.filename}")
            logger.info(f"Extracted extension: {file_extension}")

            # Upload to Backblaze B2 with thumbnail generation
            upload_result = await file_storage_service.upload_file(
                file=file,
                file_path=file_path,
                generate_thumbnail=True
            )
            
            # Extract URLs from the result
            original_url = upload_result.get("original_url")
            thumbnail_url = upload_result.get("thumbnail_small_url")
            
            # Log the URLs
            logger.info(f"File uploaded successfully to: {original_url}")
            logger.info(f"Thumbnail generated at: {thumbnail_url}")
            
            # Store file reference in database
            collection = db["student_evidence"]
            
            # Create document for insertion
            evidence_doc = {
                "student_id": ObjectId(resolved_student_id),
                "learning_outcome_id": learning_outcome_id,
                "learning_outcome_code": outcome_code_to_use, # Store the code used
                "outcome_obj_id": outcome_obj_id, # Also store the ObjectId for future queries
                "location": location, # New field
                "file_path": file_path,
                "file_type": file.content_type,
                "file_size": file.size,
                "original_filename": file.filename,
                "thumbnail_path": file_path,
                "file_url": original_url,  # Add the file_url field for consistency
                "thumbnail_url": thumbnail_url,  # Add the thumbnail_url field for consistency
                "title": title, # Title is now mandatory
                "description": description,
                "uploaded_at": datetime.now(),
                "uploaded_by": ObjectId(current_user.id)
            }
            
            # Insert the document
            insert_result = await collection.insert_one(evidence_doc)
            logger.info(f"Evidence record created with ID: {insert_result.inserted_id} for file {file.filename}")
            
            # Build response with file info
            uploaded_files_info.append({
                "id": str(insert_result.inserted_id),
                "filename": file.filename,
                "file_path": file_path,
                "file_type": file.content_type,
                "file_size": file.size,
                "title": title,
                "description": description,
                "fileUrl": original_url,  # Add the fileUrl field for frontend
                "thumbnailUrl": thumbnail_url  # Add the thumbnailUrl field for frontend
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
    logger = logging.getLogger(__name__)
    db = Database.get_db()
    resolved_student_id = await resolve_student_id(student_id, db)
    logger.info(f"Deleting evidence: {evidence_id} for student: {resolved_student_id}, outcome: {learning_outcome_id}")
    
    try:
        result = await LearningOutcomeService.mark_evidence_as_deleted(
            resolved_student_id, 
            learning_outcome_id, 
            evidence_id
        )
        logger.info(f"Successfully deleted evidence: {evidence_id}")
        return {"message": "Evidence marked as deleted", "success": True}
    except HTTPException as he:
        # Pass through HTTP exceptions with their original status codes
        logger.error(f"HTTP error when deleting evidence: {he.status_code} - {he.detail}")
        raise he
    except Exception as e:
        logger.error(f"Unexpected error when deleting evidence: {str(e)}", exc_info=True)
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
    logger = logging.getLogger(__name__)
    db = Database.get_db()
    resolved_student_id = await resolve_student_id(student_id, db)
    logger.info(f"Generating download URL for evidence: {evidence_id} for student: {resolved_student_id}, outcome: {learning_outcome_id}")
    
    try:
        download_url = await LearningOutcomeService.generate_evidence_download_url(
            resolved_student_id, 
            learning_outcome_id, 
            evidence_id
        )
        return {"download_url": download_url}
    except HTTPException as he:
        # Pass through HTTP exceptions with their original status codes
        logger.error(f"HTTP error when generating download URL: {he.status_code} - {he.detail}")
        raise he
    except Exception as e:
        logger.error(f"Unexpected error when generating download URL: {str(e)}", exc_info=True)
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
    logger = logging.getLogger(__name__)
    db = Database.get_db()
    resolved_student_id = await resolve_student_id(student_id, db)
    logger.info(f"Generating share URL for evidence: {evidence_id} for student: {resolved_student_id}, outcome: {learning_outcome_id}")
    
    try:
        share_url = await LearningOutcomeService.generate_evidence_share_url(
            resolved_student_id, 
            learning_outcome_id, 
            evidence_id
        )
        return {"share_url": share_url}
    except HTTPException as he:
        # Pass through HTTP exceptions with their original status codes
        logger.error(f"HTTP error when generating share URL: {he.status_code} - {he.detail}")
        raise he
    except Exception as e:
        logger.error(f"Unexpected error when generating share URL: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
