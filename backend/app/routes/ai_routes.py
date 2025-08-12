import sys
import traceback
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Request
from typing import List, Dict, Union # Added List, Dict, Union
from ..services import ai_service
from ..utils.auth_utils import get_current_user # Using the available authentication function
from ..models.schemas.user import User # For dependency injection type hint
import logging # Added logging
import json

# Configure logger
logger = logging.getLogger(__name__)
# logging.basicConfig(level=logging.INFO) # Uncomment for more detailed logs

router = APIRouter(
    # dependencies=[Depends(get_current_user)] # Uncomment to protect endpoint
)

@router.post("/generate-description", response_model=dict)
async def generate_ai_description(
    request: Request,
    files: List[UploadFile] = File(...), # Changed to accept a list of files
    context_description: str = Form(...),
    # current_user: User = Depends(get_current_user) # Uncomment if endpoint is protected
):
    """
    Receives one or more image files and context description text, 
    generates a description using AI based on all images.
    """
    logger.info(f"Received request to generate AI description for {len(files)} file(s).")
    logger.info(f"Context description: '{context_description[:100]}...'")

    image_data_list: List[Dict[str, Union[bytes, str]]] = []

    # Validate context description
    if not context_description or len(context_description.strip()) == 0:
        logger.error("Validation failed: Empty context description provided.")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Context description cannot be empty."
        )
        
    if not files:
        logger.error("Validation failed: No files provided.")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No files provided for description generation."
        )

    # Process each file
    for file in files:
        try:
            logger.info(f"Processing file: {file.filename} ({file.content_type}, Size: {file.size})")
            
            # Validate file type
            if not file.content_type:
                logger.warning(f"Missing content type for file {file.filename}. Skipping.")
                # Or raise error if content type is mandatory
                # raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Missing content type for {file.filename}.")
                continue # Skip this file

            if not file.content_type.startswith("image/"):
                logger.warning(f"Invalid content type '{file.content_type}' for file {file.filename}. Skipping.")
                # Or raise error
                # raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Invalid file type for {file.filename}: {file.content_type}. Only images are allowed.")
                continue # Skip this file

            # Read file content
            image_bytes = await file.read()
            if len(image_bytes) == 0:
                 logger.warning(f"Empty file uploaded: {file.filename}. Skipping.")
                 continue # Skip empty file
                 
            logger.debug(f"Successfully read {len(image_bytes)} bytes from {file.filename}")
            
            image_data_list.append({
                "bytes": image_bytes,
                "mime_type": file.content_type
            })

        except Exception as read_error:
            logger.error(f"Error reading file {file.filename}: {read_error}", exc_info=True)
            # Decide if one bad file should stop the whole process
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Failed to read uploaded file: {file.filename} ({str(read_error)})"
            )
        finally:
            # Ensure file is closed
            try:
                await file.close()
                logger.debug(f"Closed file: {file.filename}")
            except Exception as close_error:
                logger.warning(f"Error closing file {file.filename}: {close_error}")

    # Check if any valid images were processed
    if not image_data_list:
        logger.error("No valid image files were processed after validation.")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No valid image files provided for description generation."
        )

    # Call AI service with the list of image data
    try:
        logger.info(f"Calling AI service with {len(image_data_list)} image(s).")
        generated_text = await ai_service.generate_description_from_images( # Note: function name changed
            images=image_data_list,
            context_description=context_description
        )
        
        logger.info(f"Successfully generated description (length: {len(generated_text)}).")
        return {"description": generated_text}

    except HTTPException as http_exc:
        # Re-raise HTTPExceptions (e.g., from AI service validation)
        logger.error(f"HTTP Exception during AI service call: {http_exc.detail}", exc_info=True)
        raise http_exc
    except Exception as e:
        # Catch any other unexpected errors from the AI service or here
        logger.error(f"Unexpected error during AI description generation: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, # Use 500 for unexpected server errors
            detail=f"Failed to generate description due to an internal error."
        )

@router.post("/analyze-image", response_model=dict)
async def analyze_image_for_questions(
    request: Request,
    files: List[UploadFile] = File(...),
    # current_user: User = Depends(get_current_user) # Uncomment if endpoint is protected
):
    """
    Analyzes uploaded images and generates contextual questions to better understand the learning activity.
    """
    logger.info(f"Received request to analyze {len(files)} image(s) for question generation.")

    image_data_list: List[Dict[str, Union[bytes, str]]] = []
        
    if not files:
        logger.error("Validation failed: No files provided.")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No files provided for analysis."
        )

    # Process each file
    for file in files:
        try:
            logger.info(f"Processing file: {file.filename} ({file.content_type}, Size: {file.size})")
            
            # Validate file type
            if not file.content_type or not file.content_type.startswith("image/"):
                logger.warning(f"Invalid content type '{file.content_type}' for file {file.filename}. Skipping.")
                continue

            # Read file content
            image_bytes = await file.read()
            if len(image_bytes) == 0:
                 logger.warning(f"Empty file uploaded: {file.filename}. Skipping.")
                 continue
                 
            logger.debug(f"Successfully read {len(image_bytes)} bytes from {file.filename}")
            
            image_data_list.append({
                "bytes": image_bytes,
                "mime_type": file.content_type
            })

        except Exception as read_error:
            logger.error(f"Error reading file {file.filename}: {read_error}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Failed to read uploaded file: {file.filename} ({str(read_error)})"
            )
        finally:
            try:
                await file.close()
                logger.debug(f"Closed file: {file.filename}")
            except Exception as close_error:
                logger.warning(f"Error closing file {file.filename}: {close_error}")

    # Check if any valid images were processed
    if not image_data_list:
        logger.error("No valid image files were processed after validation.")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No valid image files provided for analysis."
        )

    # Call AI service to generate questions
    try:
        logger.info(f"Calling AI service to analyze {len(image_data_list)} image(s) for questions.")
        questions = await ai_service.analyze_image_for_questions(images=image_data_list)
        
        logger.info(f"Successfully generated {len(questions)} questions.")
        return {"questions": questions}

    except HTTPException as http_exc:
        logger.error(f"HTTP Exception during AI service call: {http_exc.detail}", exc_info=True)
        raise http_exc
    except Exception as e:
        logger.error(f"Unexpected error during AI question generation: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate questions due to an internal error."
        )

@router.post("/suggest-outcomes", response_model=dict)
async def suggest_learning_outcomes(
    request: Request,
    files: List[UploadFile] = File(...),
    question_answers: str = Form(...),  # JSON string of answers
    curriculum_data: str = Form(...),   # JSON string of curriculum
    student_grade: str = Form(...),
    # current_user: User = Depends(get_current_user) # Uncomment if endpoint is protected
):
    """
    Analyzes images and context answers to suggest appropriate learning outcomes with confidence scores.
    """
    logger.info(f"Received request to suggest learning outcomes for {len(files)} image(s), grade: {student_grade}")

    image_data_list: List[Dict[str, Union[bytes, str]]] = []
        
    if not files:
        logger.error("Validation failed: No files provided.")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No files provided for analysis."
        )

    # Parse JSON strings
    try:
        answers_dict = json.loads(question_answers)
        curriculum_dict = json.loads(curriculum_data)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON data: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid JSON format in request data."
        )

    # Process each file
    for file in files:
        try:
            logger.info(f"Processing file: {file.filename} ({file.content_type}, Size: {file.size})")
            
            # Validate file type
            if not file.content_type or not file.content_type.startswith("image/"):
                logger.warning(f"Invalid content type '{file.content_type}' for file {file.filename}. Skipping.")
                continue

            # Read file content
            image_bytes = await file.read()
            if len(image_bytes) == 0:
                 logger.warning(f"Empty file uploaded: {file.filename}. Skipping.")
                 continue
                 
            logger.debug(f"Successfully read {len(image_bytes)} bytes from {file.filename}")
            
            image_data_list.append({
                "bytes": image_bytes,
                "mime_type": file.content_type
            })

        except Exception as read_error:
            logger.error(f"Error reading file {file.filename}: {read_error}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Failed to read uploaded file: {file.filename} ({str(read_error)})"
            )
        finally:
            try:
                await file.close()
                logger.debug(f"Closed file: {file.filename}")
            except Exception as close_error:
                logger.warning(f"Error closing file {file.filename}: {close_error}")

    # Check if any valid images were processed
    if not image_data_list:
        logger.error("No valid image files were processed after validation.")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No valid image files provided for analysis."
        )

    # Call AI service to suggest learning outcomes
    try:
        logger.info(f"Calling AI service to suggest outcomes for {len(image_data_list)} image(s).")
        outcomes = await ai_service.suggest_learning_outcomes(
            images=image_data_list,
            question_answers=answers_dict,
            curriculum_data=curriculum_dict,
            student_grade=student_grade
        )
        
        logger.info(f"Successfully generated {len(outcomes)} outcome suggestions.")
        return {"outcomes": outcomes}

    except HTTPException as http_exc:
        logger.error(f"HTTP Exception during AI service call: {http_exc.detail}", exc_info=True)
        raise http_exc
    except Exception as e:
        logger.error(f"Unexpected error during AI outcome suggestion: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to suggest learning outcomes due to an internal error."
        )

@router.post("/chat", response_model=dict)
async def ai_chat(request: Request):
    """Simple AI chat endpoint. Expects JSON with { student_id?: str, student_slug?: str, messages: [{role, content}] }.
    Injects student name and grade level into a system context for the assistant.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    messages = body.get("messages", [])
    student_id = body.get("student_id")
    student_slug = body.get("student_slug")

    if not isinstance(messages, list) or len(messages) == 0:
        raise HTTPException(status_code=422, detail="messages must be a non-empty array")

    # Lazy import to avoid circular
    from ..services.student_service import StudentService

    student = None
    if student_id:
        try:
            student = await StudentService.get_student_by_id(student_id)
        except HTTPException as e:
            if e.status_code != 404:
                raise
    if not student and student_slug:
        student = await StudentService.get_student_by_slug(student_slug)

    if not student:
        raise HTTPException(status_code=404, detail="Student not found for provided identifier")

    # Prepare system context
    student_full_name = f"{student.first_name} {student.last_name}".strip()
    grade_level = student.grade_level

    system_context = (
        f"Student Name: {student_full_name}\n"
        f"Current Grade: {grade_level}\n\n"
        "Guidance:\n"
        "- Be concise, practical, and supportive.\n"
        "- Provide actionable advice for parents.\n"
        "- If unsure, ask a clarifying question.\n"
        "- Keep responses suitable for a homeschooling context in Australia.\n"
    )

    reply = await ai_service.chat_with_ai(messages=messages, system_context=system_context)
    return {"reply": reply}
