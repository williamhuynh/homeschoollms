import sys
import traceback
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Request
from ..services import ai_service
from ..utils.auth_utils import get_current_user # Using the available authentication function
from ..models.schemas.user import User # For dependency injection type hint

router = APIRouter(
    # dependencies=[Depends(get_current_user)] # Uncomment to protect endpoint
)

@router.post("/generate-description", response_model=dict)
async def generate_ai_description(
    request: Request,
    file: UploadFile = File(...),
    learning_outcome: str = Form(...),
    # current_user: User = Depends(get_current_user) # Uncomment if endpoint is protected
):
    """
    Receives an image file and learning outcome text, generates a description using AI.
    """
    # Log request details for debugging
    print(f"Request headers: {request.headers}", file=sys.stderr)
    print(f"Content-Type: {file.content_type}", file=sys.stderr)
    print(f"Filename: {file.filename}", file=sys.stderr)
    print(f"Learning outcome length: {len(learning_outcome)}", file=sys.stderr)
    
    # Validate file type
    if not file.content_type:
        print(f"ERROR: Missing content type for file {file.filename}", file=sys.stderr)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Missing content type. File must be an image."
        )
        
    if not file.content_type.startswith("image/"):
        print(f"ERROR: Invalid content type: {file.content_type}", file=sys.stderr)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid file type: {file.content_type}. Only images are allowed."
        )

    # Validate learning outcome
    if not learning_outcome or len(learning_outcome.strip()) == 0:
        print("ERROR: Empty learning outcome", file=sys.stderr)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Learning outcome cannot be empty."
        )

    try:
        # Read file content
        try:
            image_bytes = await file.read()
            print(f"Successfully read {len(image_bytes)} bytes from file", file=sys.stderr)
            
            if len(image_bytes) == 0:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Empty file uploaded. Please upload a valid image."
                )
                
        except Exception as read_error:
            print(f"ERROR reading file: {read_error}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Failed to read uploaded file: {str(read_error)}"
            )
            
        image_mime_type = file.content_type

        # Call AI service
        print("Calling AI service to generate description", file=sys.stderr)
        generated_text = await ai_service.generate_description_from_image(
            image_bytes=image_bytes,
            image_mime_type=image_mime_type,
            learning_outcome=learning_outcome
        )
        
        print(f"Successfully generated description: {generated_text[:50]}...", file=sys.stderr)
        return {"description": generated_text}

    except HTTPException as http_exc:
        # Re-raise HTTPExceptions from the service layer
        print(f"HTTP Exception in route: {http_exc.detail}", file=sys.stderr)
        raise http_exc
    except Exception as e:
        # Catch any other unexpected errors
        print(f"Unexpected error in /generate-description route: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to generate description: {str(e)}"
        )
    finally:
        try:
            await file.close() # Ensure the file is closed
            print("File closed successfully", file=sys.stderr)
        except Exception as close_error:
            print(f"Error closing file: {close_error}", file=sys.stderr)
