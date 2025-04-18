from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List
from ..utils.auth_utils import get_current_user
from ..models.schemas.user import UserInDB
from ..services.file_storage_service import file_storage_service
import logging
import os
import urllib.parse

# Configure logger
logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/files/signed-url", summary="Generate a signed URL")
async def get_signed_url(
    file_path: str,
    width: Optional[int] = Query(None, description="Optional width for image resize"),
    height: Optional[int] = Query(None, description="Optional height for image resize"),
    quality: Optional[int] = Query(80, description="Image quality (1-100), default is 80"),
    expiration: Optional[int] = Query(3600, description="URL expiration time in seconds (default: 1 hour)"),
    content_disposition: Optional[str] = Query('inline', description="How file should be presented - 'inline' (default) or 'attachment'"),
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Generate a signed URL for accessing a file in Backblaze B2 storage.
    For images, also generates an optimized URL using Vercel's image optimization service.
    """
    try:
        # Generate signed URL with longer expiration
        signed_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': bucket_name,
                'Key': file_path,
                'ResponseContentDisposition': content_disposition
            },
            ExpiresIn=expiration
        )
        
        response = {
            "signed_url": signed_url,
            "expiration": expiration
        }

        # If image optimization is requested
        if (width or height) and file_path.lower().split('.')[-1] in ['jpg', 'jpeg', 'png', 'webp', 'gif']:
            vercel_url = "https://homeschool-lms.vercel.app"
            encoded_signed_url = urllib.parse.quote(signed_url, safe='')
            
            # Direct Vercel image optimization URL
            optimized_url = f"{vercel_url}/_vercel/image?url={encoded_signed_url}"
            
            if width:
                optimized_url += f"&w={width}"
            if height:
                optimized_url += f"&h={height}"
            if quality:
                optimized_url += f"&q={quality}"
                
            response["optimized_url"] = optimized_url
            logger.info(f"Generated optimized image URL: {width}x{height}")

        logger.info(f"Successfully generated signed URL for file: {file_path}")
        return response
        
    except Exception as e:
        logger.error(f"Error generating signed URL: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate signed URL: {str(e)}"
        )

@router.get("/files/check-existence", summary="Check if file exists")
async def check_file_existence(
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