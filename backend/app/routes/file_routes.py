from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from typing import Optional, List
from ..utils.auth_utils import get_current_user, is_admin_user, get_super_admin_user
from ..models.schemas.user import UserInDB
from ..models.schemas.content import SignedUrlRequest
import logging
import os
import urllib.parse
from ..services.file_storage_service import FileStorageService
from ..services.user_service import UserService
from ..services.auth_service import AuthService
import cloudinary.api
from datetime import datetime, timedelta, timezone

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
            detail="Error generating URL"
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
            detail="Failed to check file existence"
        )

@router.post("/signed-url")
async def get_signed_url(
    request: SignedUrlRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """Generate a signed URL for accessing files"""
    try:
        file_storage_service = FileStorageService()
        
        # Use user-specific signed URL generation
        signed_url = await file_storage_service.generate_user_signed_url(
            file_path=request.file_path,
            user_id=str(current_user.id),
            expiration=request.expiration or 3600,
            width=request.width,
            height=request.height,
            quality=request.quality or 80
        )
        
        return {
            "signed_url": signed_url,
            "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=request.expiration or 3600)).isoformat()
        }
    except Exception as e:
        logger.error(f"Error generating signed URL: {str(e)}")
        raise HTTPException(status_code=500, detail="An internal error occurred")

# Migration API endpoints
@router.get("/migration/status")
async def get_migration_status(current_user: UserInDB = Depends(get_current_user)):
    """Get current migration status and configuration"""
    try:
        # Check if user is admin
        if not is_admin_user(current_user):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        migration_mode = os.getenv('CLOUDINARY_MIGRATION_MODE', 'public')
        
        # Get counts of different image types
        public_count = 0
        private_count = 0
        
        try:
            # Count public images
            public_result = cloudinary.api.resources(type="upload", max_results=500)
            public_count = len(public_result.get('resources', []))
            
            # Count private/authenticated images
            auth_result = cloudinary.api.resources(type="authenticated", max_results=500)
            private_count = len(auth_result.get('resources', []))
        except Exception as e:
            logger.warning(f"Error counting images: {str(e)}")
        
        return {
            "migration_mode": migration_mode,
            "public_images": public_count,
            "private_images": private_count,
            "cloudinary_configured": bool(os.getenv('CLOUDINARY_CLOUD_NAME')),
            "migration_available": True
        }
    except Exception as e:
        logger.error(f"Error getting migration status: {str(e)}")
        raise HTTPException(status_code=500, detail="An internal error occurred")

@router.get("/migration/images")
async def list_migration_images(
    image_type: str = "public", 
    limit: int = 50,
    current_user: UserInDB = Depends(get_current_user)
):
    """List images for migration (public -> private)"""
    try:
        # Check if user is admin
        if not is_admin_user(current_user):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        resource_type = "upload" if image_type == "public" else "authenticated"
        
        result = cloudinary.api.resources(
            type=resource_type,
            max_results=min(limit, 100)  # Cap at 100 for performance
        )
        
        images = []
        for resource in result.get('resources', []):
            images.append({
                "public_id": resource.get('public_id'),
                "url": resource.get('secure_url'),
                "created_at": resource.get('created_at'),
                "bytes": resource.get('bytes'),
                "type": resource.get('type')
            })
        
        return {
            "images": images,
            "total": len(images),
            "type": image_type
        }
    except Exception as e:
        logger.error(f"Error listing images: {str(e)}")
        raise HTTPException(status_code=500, detail="An internal error occurred")

@router.post("/migration/migrate-image")
async def migrate_single_image(
    request: dict,
    current_user: UserInDB = Depends(get_current_user)
):
    """Migrate a single image from public to private"""
    try:
        # Check if user is admin
        if not is_admin_user(current_user):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        public_id = request.get('public_id')
        if not public_id:
            raise HTTPException(status_code=400, detail="public_id is required")
        
        # Get the original resource
        resource = cloudinary.api.resource(public_id, type="upload")
        
        # Create authenticated version
        auth_result = cloudinary.uploader.upload(
            resource['secure_url'],
            public_id=public_id,
            type="authenticated",
            overwrite=True
        )
        
        # Optionally delete the public version (be careful!)
        # cloudinary.uploader.destroy(public_id, type="upload")
        
        return {
            "success": True,
            "public_id": public_id,
            "new_url": auth_result.get('secure_url'),
            "message": f"Image {public_id} migrated to private"
        }
    except Exception as e:
        logger.error(f"Error migrating image: {str(e)}")
        raise HTTPException(status_code=500, detail="An internal error occurred")

@router.post("/migration/bulk-migrate")
async def bulk_migrate_images(
    request: dict,
    current_user: UserInDB = Depends(get_current_user)
):
    """Migrate multiple images from public to private"""
    try:
        # Check if user is admin
        if not is_admin_user(current_user):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        public_ids = request.get('public_ids', [])
        if not public_ids:
            raise HTTPException(status_code=400, detail="public_ids array is required")
        
        results = []
        for public_id in public_ids[:10]:  # Limit to 10 at a time
            try:
                # Get the original resource
                resource = cloudinary.api.resource(public_id, type="upload")
                
                # Create authenticated version
                auth_result = cloudinary.uploader.upload(
                    resource['secure_url'],
                    public_id=public_id,
                    type="authenticated",
                    overwrite=True
                )
                
                results.append({
                    "public_id": public_id,
                    "success": True,
                    "new_url": auth_result.get('secure_url')
                })
            except Exception as e:
                results.append({
                    "public_id": public_id,
                    "success": False,
                    "error": str(e)
                })
        
        return {
            "results": results,
            "total_processed": len(results),
            "successful": len([r for r in results if r['success']]),
            "failed": len([r for r in results if not r['success']])
        }
    except Exception as e:
        logger.error(f"Error in bulk migration: {str(e)}")
        raise HTTPException(status_code=500, detail="An internal error occurred")

@router.post("/migration/set-mode")
async def set_migration_mode(
    request: dict,
    current_user: UserInDB = Depends(get_current_user)
):
    """Set the migration mode (public/hybrid/private)"""
    try:
        # Check if user is admin
        if not is_admin_user(current_user):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        mode = request.get('mode')
        if mode not in ['public', 'hybrid', 'private']:
            raise HTTPException(status_code=400, detail="Mode must be: public, hybrid, or private")
        
        # Note: This endpoint returns the instruction to set the environment variable
        # In a production deployment, you'd set this in your deployment environment
        return {
            "message": f"To set migration mode to {mode}, set environment variable:",
            "env_var": "CLOUDINARY_MIGRATION_MODE",
            "value": mode,
            "instruction": f"Set CLOUDINARY_MIGRATION_MODE={mode} in your deployment environment (Render)",
            "current_mode": os.getenv('CLOUDINARY_MIGRATION_MODE', 'public')
        }
    except Exception as e:
        logger.error(f"Error setting migration mode: {str(e)}")
        raise HTTPException(status_code=500, detail="An internal error occurred")

@router.post("/migration/cleanup/delete-all-public")
async def delete_all_public_images(
    request: dict,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """DELETE ALL PUBLIC IMAGES - Restricted to super_admin only."""
    try:
        
        # Safety check - require confirmation
        confirm = request.get('confirm_delete_all')
        if confirm != 'YES_DELETE_ALL_PUBLIC_IMAGES':
            raise HTTPException(
                status_code=400, 
                detail="Must provide confirm_delete_all='YES_DELETE_ALL_PUBLIC_IMAGES' to proceed"
            )
        
        # Get all public images
        result = cloudinary.api.resources(type="upload", max_results=500)
        resources = result.get('resources', [])
        
        deleted = []
        failed = []
        
        for resource in resources:
            try:
                public_id = resource.get('public_id')
                cloudinary.uploader.destroy(public_id, type="upload")
                deleted.append(public_id)
                logger.info(f"Deleted public image: {public_id}")
            except Exception as e:
                failed.append({
                    "public_id": resource.get('public_id'),
                    "error": str(e)
                })
                logger.error(f"Failed to delete {resource.get('public_id')}: {str(e)}")
        
        return {
            "success": True,
            "message": f"Deleted {len(deleted)} public images",
            "deleted_count": len(deleted),
            "failed_count": len(failed),
            "deleted_images": deleted,
            "failed_images": failed
        }
    except Exception as e:
        logger.error(f"Error deleting public images: {str(e)}")
        raise HTTPException(status_code=500, detail="An internal error occurred")

@router.post("/migration/cleanup/delete-all-private")
async def delete_all_private_images(
    request: dict,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """DELETE ALL PRIVATE/AUTHENTICATED IMAGES - Restricted to super_admin only."""
    try:
        
        # Safety check - require confirmation
        confirm = request.get('confirm_delete_all')
        if confirm != 'YES_DELETE_ALL_PRIVATE_IMAGES':
            raise HTTPException(
                status_code=400, 
                detail="Must provide confirm_delete_all='YES_DELETE_ALL_PRIVATE_IMAGES' to proceed"
            )
        
        # Get all private images
        result = cloudinary.api.resources(type="authenticated", max_results=500)
        resources = result.get('resources', [])
        
        deleted = []
        failed = []
        
        for resource in resources:
            try:
                public_id = resource.get('public_id')
                cloudinary.uploader.destroy(public_id, type="authenticated")
                deleted.append(public_id)
                logger.info(f"Deleted private image: {public_id}")
            except Exception as e:
                failed.append({
                    "public_id": resource.get('public_id'),
                    "error": str(e)
                })
                logger.error(f"Failed to delete {resource.get('public_id')}: {str(e)}")
        
        return {
            "success": True,
            "message": f"Deleted {len(deleted)} private images",
            "deleted_count": len(deleted),
            "failed_count": len(failed),
            "deleted_images": deleted,
            "failed_images": failed
        }
    except Exception as e:
        logger.error(f"Error deleting private images: {str(e)}")
        raise HTTPException(status_code=500, detail="An internal error occurred")

@router.post("/migration/cleanup/delete-all-cloudinary")
async def delete_all_cloudinary_images(
    request: dict,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """DELETE ALL IMAGES FROM CLOUDINARY (both public and private) - Restricted to super_admin only."""
    try:
        
        # Safety check - require confirmation
        confirm = request.get('confirm_delete_all')
        if confirm != 'YES_DELETE_EVERYTHING_FROM_CLOUDINARY':
            raise HTTPException(
                status_code=400, 
                detail="Must provide confirm_delete_all='YES_DELETE_EVERYTHING_FROM_CLOUDINARY' to proceed"
            )
        
        total_deleted = []
        total_failed = []
        
        # Delete all public images
        try:
            public_result = cloudinary.api.resources(type="upload", max_results=500)
            for resource in public_result.get('resources', []):
                try:
                    public_id = resource.get('public_id')
                    cloudinary.uploader.destroy(public_id, type="upload")
                    total_deleted.append(f"public:{public_id}")
                except Exception as e:
                    total_failed.append(f"public:{resource.get('public_id')} - {str(e)}")
        except Exception as e:
            logger.error(f"Error accessing public images: {str(e)}")
        
        # Delete all private images
        try:
            private_result = cloudinary.api.resources(type="authenticated", max_results=500)
            for resource in private_result.get('resources', []):
                try:
                    public_id = resource.get('public_id')
                    cloudinary.uploader.destroy(public_id, type="authenticated")
                    total_deleted.append(f"private:{public_id}")
                except Exception as e:
                    total_failed.append(f"private:{resource.get('public_id')} - {str(e)}")
        except Exception as e:
            logger.error(f"Error accessing private images: {str(e)}")
        
        return {
            "success": True,
            "message": f"Nuclear cleanup complete! Deleted {len(total_deleted)} images total",
            "deleted_count": len(total_deleted),
            "failed_count": len(total_failed),
            "deleted_images": total_deleted,
            "failed_images": total_failed,
            "warning": "All images deleted from Cloudinary. Database references may still exist."
        }
    except Exception as e:
        logger.error(f"Error in nuclear cleanup: {str(e)}")
        raise HTTPException(status_code=500, detail="An internal error occurred") 