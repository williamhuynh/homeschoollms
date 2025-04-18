from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from typing import Optional, List
from ..utils.auth_utils import get_current_user
from ..models.schemas.user import UserInDB
import logging
import os
import urllib.parse

# Configure logger
logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/files/signed-url", summary="Generate a signed URL")
async def get_signed_url(
    request: Request,
    file_path: str,
    width: Optional[int] = Query(None, description="Optional width for image resize"),
    height: Optional[int] = Query(None, description="Optional height for image resize"),
    quality: Optional[int] = Query(80, description="Image quality (1-100), default is 80"),
    expiration: Optional[int] = Query(3600, description="URL expiration time in seconds (default: 1 hour)"),
    content_disposition: Optional[str] = Query('inline', description="How file should be presented - 'inline' (default) or 'attachment'"),
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Generate a Cloudinary URL for accessing a file with optional transformations.
    """
    try:
        # Get the file storage service from the app
        file_storage_service = request.app.file_storage_service
        
        # Generate URL using the file storage service
        image_url = file_storage_service.generate_presigned_url(
            file_path=file_path,
            expiration=expiration,
            content_disposition=content_disposition,
            width=width,
            height=height,
            quality=quality
        )
        
        logger.info(f"Successfully generated Cloudinary URL for file: {file_path}")
        return {
            "signed_url": image_url,
            "expiration": expiration
        }
    except Exception as e:
        logger.error(f"Error generating URL: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Error generating URL: {str(e)}"
        )

@router.get("/files/check-existence", summary="Check if file exists")
async def check_file_existence(
    request: Request,
    file_path: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Check if a file exists in the storage bucket.
    
    ## Parameters:
    - **file_path**: Path to the file in storage (required)
    
    ## Returns:
    A JSON object with 'exists' boolean indicating if the file exists
    
    ## Notes:
    - This endpoint is useful for validating file paths before attempting to use them
    - Authentication is required
    """
    try:
        logger.info(f"Checking existence for file: {file_path}")
        logger.info(f"Requested by user: {current_user.email}")
        
        if not file_path:
            logger.error("Missing file path parameter")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File path is required"
            )
            
        # Get the file storage service from the app
        file_storage_service = request.app.file_storage_service
            
        # Check if the file exists in the bucket
        exists = file_storage_service.check_file_exists(file_path)
        logger.info(f"File existence check result for {file_path}: {exists}")
        
        return {"exists": exists, "file_path": file_path}
        
    except Exception as e:
        logger.error(f"Error checking file existence: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check file existence: {str(e)}"
        ) 