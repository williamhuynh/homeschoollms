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
    Generate a signed URL for accessing a file in storage.
    
    ## Parameters:
    - **file_path**: Path to the file in storage (required)
    - **width**: Optional width for image resize
    - **height**: Optional height for image resize
    - **quality**: Image quality (1-100), default is 80
    - **expiration**: URL expiration time in seconds (default: 1 hour)
    - **content_disposition**: How the file should be presented (inline or attachment)
    
    ## Returns:
    A signed URL that can be used to access the file directly, and optionally 
    a Vercel-optimized image URL if width/height parameters are provided.
    
    ## Notes:
    - For images, you can optionally specify width, height, and quality parameters
    - The system will automatically determine the appropriate content type based on file extension
    - Authentication is required to generate signed URLs
    """
    try:
        logger.info(f"Generating signed URL for file: {file_path}")
        logger.info(f"Requested by user: {current_user.email}")
        logger.info(f"Parameters - Width: {width}, Height: {height}, Quality: {quality}, Expiration: {expiration}s")
        
        if not file_path:
            logger.error("Missing file path parameter")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File path is required"
            )
        
        # Generate the signed URL using the file storage service
        signed_url = file_storage_service.generate_presigned_url(
            file_path=file_path,
            expiration=expiration,
            content_disposition=content_disposition
        )
        
        if not signed_url:
            logger.error(f"Failed to generate signed URL for file: {file_path}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate signed URL"
            )
        
        # Prepare the response
        response = {
            "signed_url": signed_url, 
            "expiration": expiration
        }
        
        # If width or height parameters are provided and VERCEL_URL is set, generate an image optimization URL
        # Use a hardcoded production URL instead of relying on environment variable
        vercel_url = "https://homeschool-lms.vercel.app"
        if (width or height) and file_path.lower().split('.')[-1] in ['jpg', 'jpeg', 'png', 'webp', 'gif']:
            edge_function_path = os.getenv('EDGE_FUNCTION_PATH', '/api/images')
            bucket_name = os.getenv('BACKBLAZE_BUCKET_NAME', '')
            
            # Construct the Vercel image optimization URL
            base_url = vercel_url.rstrip('/')
            path = edge_function_path.lstrip('/')
            
            # Ensure the signed URL is properly URL encoded for Vercel's image optimizer
            encoded_url = urllib.parse.quote(signed_url, safe='')
            
            # Format: https://your-site.vercel.app/_vercel/image?url=<encoded-url>&w=<width>&h=<height>&q=<quality>
            vercel_image_url = f"{base_url}/_vercel/image?url={encoded_url}"
            
            if width:
                vercel_image_url += f"&w={width}"
            if height:
                vercel_image_url += f"&h={height}"
            if quality:
                vercel_image_url += f"&q={quality}"
                
            response["optimized_url"] = vercel_image_url
            logger.info(f"Generated optimized image URL for dimensions: {width}x{height}")
        
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