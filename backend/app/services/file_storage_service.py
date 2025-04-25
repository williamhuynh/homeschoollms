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
            
            # Upload to Backblaze B2 for backup/storage (not used for serving)
            try:
                self.s3.put_object(
                    Bucket=self.bucket_name,
                    Key=file_path,
                    Body=file_data,
                    ContentType=file.content_type
                )
                logger.info(f"File uploaded to Backblaze B2 (backup storage): {file_path}")
            except Exception as e:
                logger.error(f"Error uploading to Backblaze B2: {str(e)}")
                # Continue even if Backblaze upload fails - we'll still use Cloudinary
            
            # Upload to Cloudinary for delivery/serving
            upload_result = cloudinary.uploader.upload(
                file_data,
                public_id=file_path_without_ext,
                resource_type="auto"
            )
            logger.info(f"File uploaded to Cloudinary (primary serving): {upload_result['secure_url']}")
            
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
                "thumbnail_medium_url": f"{upload_result['secure_url']}?width=600&height=450&quality=85",
                "thumbnail_large_url": f"{upload_result['secure_url']}?width=800&height=600&quality=85"
            }
        except Exception as e:
            logger.error(f"Error uploading file: {str(e)}")
            raise Exception(f"Failed to upload file: {str(e)}")

    def generate_presigned_url(self, file_path: str, expiration=3600, content_disposition='inline', width=None, height=None, quality=80):
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            # Get Cloudinary cloud name
            cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME')
            if not cloud_name:
                logger.error("Cloudinary cloud name not configured")
                raise Exception("Cloudinary cloud name not configured")
            
            logger.info(f"Generating Cloudinary URL for path: {file_path}")
            
            # Clean and prepare the file path
            # Remove any leading/trailing slashes and spaces
            clean_path = file_path.strip().strip('/')
            
            # Remove file extension (if any) since Cloudinary will add the correct one
            file_name, file_ext = os.path.splitext(clean_path)
            logger.info(f"File name: {file_name}, extension: {file_ext}")
            
            # Base Cloudinary URL
            cloudinary_url = f"https://res.cloudinary.com/{cloud_name}/image/upload"
            
            # Add transformations if specified
            transformations = []
            if width and height:
                transformations.append("c_fill")
                transformations.append("g_auto")  # Smart crop focus
            if width:
                transformations.append(f"w_{width}")
            if height:
                transformations.append(f"h_{height}")
            if quality != 80:
                transformations.append(f"q_{quality}")
            
            if transformations:
                cloudinary_url += "/" + ",".join(transformations)
            
            # Add the public ID (with the version Cloudinary added during upload)
            # Try to look up the file in Cloudinary to get the version
            try:
                # Search for the asset in Cloudinary
                result = cloudinary.api.resources(
                    type="upload",
                    prefix=file_name,
                    max_results=1
                )
                
                if result and 'resources' in result and len(result['resources']) > 0:
                    # Get the resource with version
                    resource = result['resources'][0]
                    version = resource.get('version')
                    public_id = resource.get('public_id')
                    
                    if version and public_id:
                        # Use the version and public_id directly
                        cloudinary_url += f"/v{version}/{public_id}"
                        logger.info(f"Found resource in Cloudinary. Using versioned URL: {cloudinary_url}")
                        return cloudinary_url
            except Exception as lookup_err:
                logger.warning(f"Failed to look up resource in Cloudinary: {str(lookup_err)}")
            
            # Fallback to using the path without version if lookup failed
            cloudinary_url += f"/{file_name}"
            
            logger.info(f"Generated Cloudinary URL: {cloudinary_url}")
            return cloudinary_url
        except Exception as e:
            logger.error(f"Error generating URL: {str(e)}")
            raise Exception(f"Failed to generate URL: {str(e)}")

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
                "thumbnail_medium_url": f"{result['secure_url']}?width=600&height=450&quality=85",
                "thumbnail_large_url": f"{result['secure_url']}?width=800&height=600&quality=85"
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
            try:
                self.s3.head_object(Bucket=self.bucket_name, Key=file_path)
                logger.info(f"File exists: {file_path}")
                return True
            except Exception as e:
                logger.info(f"File not found with original path, checking for double extension: {str(e)}")
                
                # Check if there might be a double extension issue
                file_name, file_ext = os.path.splitext(file_path)
                if file_ext:
                    # Try with double extension
                    double_ext_path = f"{file_path}{file_ext}"
                    try:
                        self.s3.head_object(Bucket=self.bucket_name, Key=double_ext_path)
                        logger.info(f"File exists with double extension: {double_ext_path}")
                        return True
                    except Exception:
                        pass
                    
                    # Try without extension
                    try:
                        self.s3.head_object(Bucket=self.bucket_name, Key=file_name)
                        logger.info(f"File exists without extension: {file_name}")
                        return True
                    except Exception:
                        pass
                
                logger.info(f"File does not exist: {file_path}")
                return False
        except Exception as e:
            # If we get an error, the file doesn't exist
            logger.error(f"Error checking if file exists: {str(e)}")
            return False

file_storage_service = FileStorageService()
