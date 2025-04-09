from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from ..services import ai_service
from ..utils.auth_utils import get_current_user # Using the available authentication function
from ..models.schemas.user import User # For dependency injection type hint

router = APIRouter(
    # dependencies=[Depends(get_current_user)] # Uncomment to protect endpoint
)

@router.post("/generate-description", response_model=dict)
async def generate_ai_description(
    *,
    file: UploadFile = File(...),
    learning_outcome: str = Form(...),
    # current_user: User = Depends(get_current_user) # Uncomment if endpoint is protected
):
    """
    Receives an image file and learning outcome text, generates a description using AI.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only images are allowed."
        )

    try:
        image_bytes = await file.read()
        image_mime_type = file.content_type

        generated_text = await ai_service.generate_description_from_image(
            image_bytes=image_bytes,
            image_mime_type=image_mime_type,
            learning_outcome=learning_outcome
        )
        
        return {"description": generated_text}

    except HTTPException as http_exc:
        # Re-raise HTTPExceptions from the service layer
        raise http_exc
    except Exception as e:
        # Catch any other unexpected errors
        print(f"Unexpected error in /generate-description route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}"
        )
    finally:
        await file.close() # Ensure the file is closed
