import sys
import traceback
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Request
from typing import List, Dict, Union # Added List, Dict, Union
from ..services import ai_service
from ..utils.auth_utils import get_current_user # Using the available authentication function
from ..models.schemas.user import User # For dependency injection type hint
import logging # Added logging

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
    learning_outcome: str = Form(...),
    # current_user: User = Depends(get_current_user) # Uncomment if endpoint is protected
):
    """
    Receives one or more image files and learning outcome text, 
    generates a description using AI based on all images.
    """
    logger.info(f"Received request to generate AI description for {len(files)} file(s).")
    logger.info(f"Learning outcome: '{learning_outcome[:100]}...'")

    image_data_list: List[Dict[str, Union[bytes, str]]] = []

    # Validate learning outcome
    if not learning_outcome or len(learning_outcome.strip()) == 0:
        logger.error("Validation failed: Empty learning outcome provided.")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Learning outcome cannot be empty."
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
            learning_outcome=learning_outcome
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
