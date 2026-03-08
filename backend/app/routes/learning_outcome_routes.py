from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response
from bson import ObjectId
from ..services.learning_outcome_service import LearningOutcomeService
from ..services.file_storage_service import file_storage_service
from ..services.subscription_service import SubscriptionService
from ..utils.database_utils import Database
from ..models.schemas.learning_outcome import LearningOutcome
from ..utils.auth_utils import get_current_user, get_current_user_with_org, is_admin_user
from typing import List, Optional, Dict, Any # Added List
from ..models.schemas.user import UserInDB
from datetime import datetime, timezone
import os
import uuid # Added for unique filenames
import logging # Added for better logging control
import re # Added for outcome code lookup
import json
from ..models.schemas.evidence import EvidenceUpdate

router = APIRouter()

# Configure logger
logger = logging.getLogger(__name__)

# File upload validation constants
ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "application/pdf",
}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf"}
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

# Magic bytes for file type verification
MAGIC_BYTES = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG": "image/png",
    b"RIFF": "image/webp",  # WebP starts with RIFF....WEBP
    b"GIF8": "image/gif",
    b"%PDF": "application/pdf",
}


async def validate_upload_file(file: UploadFile) -> None:
    """Validate file type (extension, content-type, magic bytes) and size."""
    # Check file extension
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' is not allowed. Accepted: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # Check declared content type
    if file.content_type and file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Content type '{file.content_type}' is not allowed."
        )

    # Check file size
    if file.size is not None and file.size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds the {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB limit."
        )

    # Read first bytes for magic byte validation, then reset
    header = await file.read(8)
    await file.seek(0)

    if not header:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    # Verify magic bytes match an allowed type
    matched = False
    for magic, _ in MAGIC_BYTES.items():
        if header[:len(magic)] == magic:
            matched = True
            break
    if not matched:
        raise HTTPException(
            status_code=400,
            detail="File content does not match any allowed file type."
        )

async def verify_student_access(student_id: str, current_user: UserInDB, required_access: str = "view") -> bool:
    """
    Verify if the current user has the required access level to a student's data.
    
    Args:
        student_id: The ID of the student
        current_user: The current authenticated user
        required_access: Required access level ("view", "content", "admin")
    
    Returns:
        bool: True if user has access, False otherwise
    """
    # Admins and super admins can access everything
    if is_admin_user(current_user):
        return True
    
    # Get the student data
    db = Database.get_db()
    try:
        # Handle both ObjectId and slug
        if ObjectId.is_valid(student_id):
            student = await db.students.find_one({"_id": ObjectId(student_id)})
        else:
            student = await db.students.find_one({"slug": student_id})
        
        if not student:
            return False
        
        user_obj_id = ObjectId(current_user.id)
        
        # Check parent_access entries
        # Compare as strings to handle both ObjectId and str storage
        # (Pydantic .dict() serializes PyObjectId to str, so parent_id may be stored as either)
        for access in student.get("parent_access", []):
            if str(access.get("parent_id")) == str(user_obj_id):
                access_level = access.get("access_level", "view")
                
                # Check if user has required access level
                access_hierarchy = {"view": 1, "content": 2, "admin": 3}
                user_level = access_hierarchy.get(access_level, 0)
                required_level = access_hierarchy.get(required_access, 1)
                
                return user_level >= required_level
        
        # For backward compatibility: check parent_ids
        if user_obj_id in student.get("parent_ids", []):
            # If no parent_access entry exists, assume admin level (backward compatibility)
            if not student.get("parent_access"):
                return True
        
        return False
        
    except Exception as e:
        logger.error(f"Error verifying student access: {str(e)}")
        return False

async def ensure_student_access(student_id: str, current_user: UserInDB, required_access: str = "view"):
    """
    Ensure the current user has access to the student, raise HTTPException if not.
    """
    has_access = await verify_student_access(student_id, current_user, required_access)
    if not has_access:
        raise HTTPException(
            status_code=403, 
            detail=f"You do not have {required_access} access to this student's data"
        )

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
    student_grade: Optional[str] = None,
    current_user: UserInDB = Depends(get_current_user)
):
    # Verify user has access to this student's evidence
    await ensure_student_access(student_id, current_user, "view")

    db = Database.get_db()
    resolved_student_id = await resolve_student_id(student_id, db)
    try:
        logger.info(f"Fetching evidence for student {resolved_student_id} and outcome {learning_outcome_id} (grade filter: {student_grade})")
        evidence = await LearningOutcomeService.get_evidence(resolved_student_id, learning_outcome_id, student_grade=student_grade)
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
    student_grade: Optional[str] = None,
    current_user: UserInDB = Depends(get_current_user)
):
    # Verify user has access to this student's evidence
    await ensure_student_access(student_id, current_user, "view")

    db = Database.get_db()
    resolved_student_id = await resolve_student_id(student_id, db)
    try:
        outcome_codes = [code.strip() for code in outcomes.split(',') if code.strip()]
        logger.info(f"Fetching batch evidence for student {resolved_student_id} and outcomes: {outcome_codes} (grade filter: {student_grade})")
        if not outcome_codes:
            return {}
        evidence_map = await LearningOutcomeService.get_batch_evidence(resolved_student_id, outcome_codes, student_grade=student_grade)
        logger.info(f"Found evidence for {len(evidence_map)} outcomes")
        return evidence_map
    except Exception as e:
        logger.error(f"Error fetching batch evidence: {str(e)}")
        return {}

@router.post("/evidence/{student_id}")
async def upload_evidence_multi_outcome(
    student_id: str,
    files: List[UploadFile] = File(...),
    title: str = Form(...),
    description: str = Form(""),
    learning_outcome_codes: str = Form(...),  # Comma-separated codes
    learning_area_codes: Optional[str] = Form(None),  # Comma-separated codes
    location: Optional[str] = Form(None),
    student_grade: Optional[str] = Form(None),
    learning_resources: Optional[str] = Form(None),
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Upload evidence linked to multiple learning outcomes.
    """
    # Verify user has content access to this student
    await ensure_student_access(student_id, current_user, "content")
    
    # Check subscription limits for evidence uploads
    can_add, message = await SubscriptionService.can_add_evidence(str(current_user.id))
    if not can_add:
        raise HTTPException(status_code=403, detail=message)
    
    db = Database.get_db()
    resolved_student_id = await resolve_student_id(student_id, db)
    
    logger.info(f"Multi-outcome evidence upload - Student: {resolved_student_id}, Outcomes: {learning_outcome_codes}")
    
    # Parse comma-separated codes into arrays
    outcome_codes = [code.strip() for code in learning_outcome_codes.split(',') if code.strip()]
    area_codes = [code.strip() for code in learning_area_codes.split(',') if learning_area_codes] if learning_area_codes else []
    
    if not outcome_codes:
        raise HTTPException(status_code=400, detail="At least one learning outcome code is required")
    
    logger.info(f"Parsed outcome codes: {outcome_codes}")
    logger.info(f"Parsed area codes: {area_codes}")
    
    # Validate all outcome codes exist and get their ObjectIds
    validated_obj_ids = []
    for outcome_code in outcome_codes:
        import re
        code_pattern = re.compile(f"^{re.escape(outcome_code)}$", re.IGNORECASE)
        outcome = await db.learning_outcomes.find_one({"code": {"$regex": code_pattern}})
        
        if not outcome:
            logger.warning(f"Learning outcome not found: {outcome_code}. Creating auto-outcome.")
            # Auto-create the learning outcome
            try:
                new_outcome = {
                    "code": outcome_code,
                    "name": f"Auto-created: {outcome_code}",
                    "description": "Automatically created learning outcome for multi-outcome evidence upload",
                    "subject_id": None,
                    "grade_level": student_grade,
                    "is_standard": True,
                    "created_at": datetime.now(timezone.utc)
                }
                
                # Determine stage from grade if available
                if student_grade:
                    stage_mapping = {
                        "Kindergarten": "Early Stage 1", "K": "Early Stage 1",
                        "Year 1": "Stage 1", "Year 2": "Stage 1",
                        "Year 3": "Stage 2", "Year 4": "Stage 2",
                        "Year 5": "Stage 3", "Year 6": "Stage 3",
                    }
                    stage = stage_mapping.get(student_grade)
                    if stage:
                        new_outcome["stage"] = stage
                
                # Add learning area code if available
                if area_codes:
                    new_outcome["learning_area_code"] = area_codes[0]  # Use first area code
                
                insert_result = await db.learning_outcomes.insert_one(new_outcome)
                validated_obj_ids.append(insert_result.inserted_id)
                logger.info(f"Auto-created learning outcome: {outcome_code}")
                
            except Exception as e:
                logger.error(f"Failed to auto-create learning outcome {outcome_code}: {str(e)}")
                raise HTTPException(status_code=400, detail=f"Learning outcome code '{outcome_code}' not found and could not be created")
        else:
            validated_obj_ids.append(outcome["_id"])
            logger.info(f"Found existing learning outcome: {outcome_code}")
    
    # Parse learning resources JSON
    parsed_resources = []
    if learning_resources:
        try:
            raw = json.loads(learning_resources)
            if isinstance(raw, list):
                for r in raw:
                    if isinstance(r, dict) and r.get("name"):
                        parsed_resources.append({
                            "name": r["name"].strip(),
                            "type": r.get("type", "").strip() if r.get("type") else None,
                            "details": r.get("details", "").strip() if r.get("details") else None
                        })
        except (json.JSONDecodeError, TypeError) as e:
            logger.warning(f"Failed to parse learning_resources JSON: {e}")

    # Validate all uploaded files before processing
    for file in files:
        await validate_upload_file(file)

    # Upload files and create evidence documents
    uploaded_files = []

    for file in files:
        try:
            logger.info(f"Processing file: {file.filename}")

            # Generate unique filename
            file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
            unique_filename = f"{uuid.uuid4()}.{file_extension}"
            
            # Create file path for storage
            file_path = f"students/{resolved_student_id}/evidence/{unique_filename}"
            
            # Upload file to storage
            upload_result = await file_storage_service.upload_file(
                file, 
                file_path,
                generate_thumbnail=True
            )
            
            # Get URLs from upload result
            original_url = upload_result.get("original_url", upload_result.get("file_url"))
            thumbnail_url = upload_result.get("thumbnail_small_url")
            
            logger.info(f"File uploaded successfully to: {original_url}")
            logger.info(f"Thumbnail generated at: {thumbnail_url}")
            
            # Create evidence document with new array-based schema
            evidence_doc = {
                "student_id": ObjectId(resolved_student_id),
                "learning_outcome_codes": outcome_codes,  # Array of codes
                "outcome_obj_ids": validated_obj_ids,     # Array of ObjectIds
                "learning_area_codes": area_codes,        # Array of area codes
                "student_grade": student_grade,           # Grade at time of upload
                "location": location,
                "file_path": file_path,
                "file_type": file.content_type,
                "file_size": file.size,
                "original_filename": file.filename,
                "thumbnail_path": file_path,
                "file_url": original_url,
                "thumbnail_url": thumbnail_url,
                "title": title,
                "description": description,
                "learning_resources": parsed_resources if parsed_resources else [],
                "uploaded_at": datetime.now(timezone.utc),
                "uploaded_by": ObjectId(current_user.id),
                "deleted": False
            }

            # Insert the evidence document
            collection = db["student_evidence"]
            insert_result = await collection.insert_one(evidence_doc)
            logger.info(f"Evidence record created with ID: {insert_result.inserted_id} for file {file.filename}")

            # Prepare response data
            uploaded_files.append({
                "id": str(insert_result.inserted_id),
                "original_filename": file.filename,
                "file_url": original_url,
                "thumbnail_url": thumbnail_url,
                "file_path": file_path,
                "learning_outcome_codes": outcome_codes,
                "learning_area_codes": area_codes
            })
            
        except Exception as e:
            logger.error(f"Error uploading file {file.filename}: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to upload file")
    
    logger.info(f"Successfully uploaded {len(uploaded_files)} files with multi-outcome evidence")
    
    return {
        "message": f"{len(uploaded_files)} file(s) uploaded successfully to {len(outcome_codes)} learning outcomes",
        "uploaded_files": uploaded_files,
        "learning_outcome_codes": outcome_codes,
        "total_outcomes": len(outcome_codes)
    }

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
    # Verify user has content access to this student (required for uploading evidence)
    await ensure_student_access(student_id, current_user, "content")
    
    # Check subscription limits for evidence uploads
    can_add, message = await SubscriptionService.can_add_evidence(str(current_user.id))
    if not can_add:
        raise HTTPException(status_code=403, detail=message)
    
    # Validate all uploaded files before processing
    for file in files:
        await validate_upload_file(file)

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
                    "created_at": datetime.now(timezone.utc)
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
                        "created_at": datetime.now(timezone.utc),
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
                raise HTTPException(status_code=500, detail="Failed to auto-create learning outcome")
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
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
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
            
            # Create document for insertion using new array-based schema
            evidence_doc = {
                "student_id": ObjectId(resolved_student_id),
                "learning_outcome_codes": [outcome_code_to_use], # Array format
                "outcome_obj_ids": [outcome_obj_id],             # Array format
                "learning_area_codes": [learning_area_code] if learning_area_code else [], # Array format
                "student_grade": student_grade,                  # Grade at time of upload
                "location": location,
                "file_path": file_path,
                "file_type": file.content_type,
                "file_size": file.size,
                "original_filename": file.filename,
                "thumbnail_path": file_path,
                "file_url": original_url,
                "thumbnail_url": thumbnail_url,
                "title": title,
                "description": description,
                "uploaded_at": datetime.now(timezone.utc),
                "uploaded_by": ObjectId(current_user.id),
                "deleted": False
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
            raise HTTPException(status_code=500, detail="Error processing file")
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
    # Verify user has admin access to this student (required for deleting evidence)
    await ensure_student_access(student_id, current_user, "admin")
    
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
        raise HTTPException(status_code=500, detail="An internal error occurred")

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
    # Verify user has view access to this student (required for downloading evidence)
    await ensure_student_access(student_id, current_user, "view")
    
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
        raise HTTPException(status_code=500, detail="An internal error occurred")

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
    # Verify user has content access to this student (required for sharing evidence)
    await ensure_student_access(student_id, current_user, "content")
    
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
        raise HTTPException(status_code=500, detail="An internal error occurred")

@router.patch("/learning-outcomes/{student_id}/{learning_outcome_id}/evidence/{evidence_id}")
async def update_evidence(
    student_id: str,
    learning_outcome_id: str,
    evidence_id: str,
    update: EvidenceUpdate,
    current_user: UserInDB = Depends(get_current_user)
):
    # Verify user has content access to this student (required for updating evidence)
    await ensure_student_access(student_id, current_user, "content")
    
    db = Database.get_db()
    resolved_student_id = await resolve_student_id(student_id, db)
    updated = await LearningOutcomeService.update_evidence(
        resolved_student_id, learning_outcome_id, evidence_id, update.dict(exclude_unset=True)
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Evidence not found or not updated")
    return updated
