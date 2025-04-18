import os
import boto3
import io
from PIL import Image
from botocore.client import Config
from fastapi import UploadFile
import cloudinary
import cloudinary.uploader
import cloudinary.api
from ..config import settings

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key=os.getenv('CLOUDINARY_API_KEY'),
    api_secret=os.getenv('CLOUDINARY_API_SECRET')
)

class FileStorageService:
    def __init__(self):
        import logging
        logging.basicConfig(level=logging.INFO)
        logger = logging.getLogger(__name__)
        
        # Log the environment variables
        logger.info(f"BACKBLAZE_ENDPOINT: {os.getenv('BACKBLAZE_ENDPOINT')}")
        logger.info(f"BACKBLAZE_KEY_ID: {os.getenv('BACKBLAZE_KEY_ID')}")
        logger.info(f"BACKBLAZE_APPLICATION_KEY: {'*****' if os.getenv('BACKBLAZE_APPLICATION_KEY') else None}")
        logger.info(f"BACKBLAZE_BUCKET_NAME: {os.getenv('BACKBLAZE_BUCKET_NAME')}")
        
        self.s3 = boto3.client(
            's3',
            endpoint_url=os.getenv('BACKBLAZE_ENDPOINT'),
            aws_access_key_id=os.getenv('BACKBLAZE_KEY_ID'),
            aws_secret_access_key=os.getenv('BACKBLAZE_APPLICATION_KEY'),
            config=Config(signature_version='s3v4')
        )
        self.bucket_name = os.getenv('BACKBLAZE_BUCKET_NAME')

    async def upload_file(self, file: UploadFile, file_path: str, generate_thumbnail=False, thumbnail_size=(200, 200)):
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            # Read the file content
            file_data = await file.read()
            
            # Remove the extension from the file_path for Cloudinary upload
            # Cloudinary will add the extension automatically
            file_path_without_ext = os.path.splitext(file_path)[0]
            
            # Upload to Cloudinary
            upload_result = cloudinary.uploader.upload(
                file_data,
                public_id=file_path_without_ext,
                resource_type="auto"
            )
            
            # Generate thumbnail if requested
            thumbnail_url = None
            if generate_thumbnail:
                try:
                    # Generate thumbnail using Cloudinary
                    thumbnail_result = cloudinary.uploader.upload(
                        file_data,
                        public_id=f"{file_path_without_ext}_thumb",
                        width=thumbnail_size[0],
                        height=thumbnail_size[1],
                        crop="fill",
                        resource_type="auto"
                    )
                    thumbnail_url = thumbnail_result['secure_url']
                except Exception as e:
                    logger.error(f"Error generating thumbnail: {str(e)}")
            
            # Return URLs in the format expected by the frontend
            return {
                "original_url": upload_result['secure_url'],
                "thumbnail_small_url": f"{upload_result['secure_url']}?width=150&height=150&quality=80",
                "thumbnail_medium_url": f"{upload_result['secure_url']}?width=400&height=300&quality=80",
                "thumbnail_large_url": f"{upload_result['secure_url']}?width=600&height=450&quality=80"
            }
        except Exception as e:
            logger.error(f"Error uploading file: {str(e)}")
            raise Exception(f"Failed to upload file: {str(e)}")

    def generate_presigned_url(self, file_path: str, expiration=3600, content_disposition='inline'):
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            # Generate Cloudinary URL with transformations
            url = cloudinary.utils.cloudinary_url(
                file_path,
                secure=True,
                sign_url=True
            )[0]
            
            return url
        except Exception as e:
            logger.error(f"Error generating presigned URL: {str(e)}")
            raise Exception(f"Failed to generate presigned URL: {str(e)}")

    async def generate_and_upload_thumbnail(self, file: UploadFile, original_path: str, size=(200, 200)):
        """Generate a thumbnail using Cloudinary."""
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            # Read the file
            contents = await file.read()
            
            # Generate thumbnail using Cloudinary
            result = cloudinary.uploader.upload(
                contents,
                public_id=f"{original_path}_thumb",
                width=size[0],
                height=size[1],
                crop="fill",
                resource_type="auto"
            )
            
            return {
                "original_url": result['secure_url'],
                "thumbnail_small_url": f"{result['secure_url']}?width=150&height=150&quality=80",
                "thumbnail_medium_url": f"{result['secure_url']}?width=400&height=300&quality=80",
                "thumbnail_large_url": f"{result['secure_url']}?width=600&height=450&quality=80"
            }
        except Exception as e:
            logger.error(f"Error generating thumbnail: {str(e)}")
            raise Exception(f"Failed to generate thumbnail: {str(e)}")

    def check_file_exists(self, file_path: str) -> bool:
        """
        Check if a file exists in the Backblaze B2 bucket.
        
        Args:
            file_path: The path to the file in the bucket
            
        Returns:
            bool: True if the file exists, False otherwise
        """
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            logger.info(f"Checking if file exists: {file_path}")
            
            # Use head_object to check if the file exists without downloading it
            self.s3.head_object(Bucket=self.bucket_name, Key=file_path)
            logger.info(f"File exists: {file_path}")
            return True
        except Exception as e:
            # If we get an error (like 404), the file doesn't exist
            logger.info(f"File does not exist or error: {file_path} - {str(e)}")
            return False

file_storage_service = FileStorageService()
