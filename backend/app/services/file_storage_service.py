import os
import boto3
import io
from PIL import Image
from botocore.client import Config
from fastapi import UploadFile
import cloudinary
import cloudinary.uploader
import cloudinary.api
import cloudinary.utils
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
        
        # Migration mode configuration
        self.migration_mode = os.getenv('CLOUDINARY_MIGRATION_MODE', 'hybrid')  # hybrid, private, public
        
        # Log the environment variables
        logger.info(f"BACKBLAZE_ENDPOINT: {os.getenv('BACKBLAZE_ENDPOINT')}")
        logger.info(f"BACKBLAZE_KEY_ID: {os.getenv('BACKBLAZE_KEY_ID')}")
        logger.info(f"BACKBLAZE_APPLICATION_KEY: {'*****' if os.getenv('BACKBLAZE_APPLICATION_KEY') else None}")
        logger.info(f"BACKBLAZE_BUCKET_NAME: {os.getenv('BACKBLAZE_BUCKET_NAME')}")
        logger.info(f"CLOUDINARY_MIGRATION_MODE: {self.migration_mode}")
        
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
            
            # Choose upload type based on migration mode
            upload_type = "authenticated" if self.migration_mode in ['private', 'hybrid'] else "upload"
            logger.info(f"Uploading to Cloudinary with type: {upload_type}")
            
            # Upload to Cloudinary for delivery/serving
            upload_result = cloudinary.uploader.upload(
                file_data,
                public_id=file_path_without_ext,
                resource_type="auto",
                type=upload_type
            )
            logger.info(f"File uploaded to Cloudinary (type: {upload_type}): {upload_result['secure_url']}")
            
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
                        resource_type="auto",
                        type=upload_type
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
            
            logger.info(f"Generating URL for path: {file_path} (mode: {self.migration_mode})")
            
            # Clean and prepare the file path
            clean_path = file_path.strip().strip('/')
            file_name, file_ext = os.path.splitext(clean_path)
            logger.info(f"File name: {file_name}, extension: {file_ext}")
            
            # Try authenticated first (new system) if in private or hybrid mode
            if self.migration_mode in ['private', 'hybrid']:
                try:
                    logger.info("Attempting to generate authenticated signed URL")
                    transformation = {}
                    if width:
                        transformation['width'] = width
                    if height:
                        transformation['height'] = height
                    if quality != 80:
                        transformation['quality'] = quality
                    if width and height:
                        transformation['crop'] = 'fill'
                        transformation['gravity'] = 'auto'
                    
                    signed_url = cloudinary.utils.cloudinary_url(
                        file_name,
                        type="authenticated",
                        sign_url=True,
                        **transformation
                    )[0]
                    
                    logger.info(f"Generated authenticated signed URL: {signed_url}")
                    return signed_url
                    
                except Exception as auth_error:
                    logger.warning(f"Authenticated URL failed for {file_path}: {str(auth_error)}")
                    if self.migration_mode == 'private':
                        # In private mode, we don't fall back
                        raise Exception(f"Private image access failed: {str(auth_error)}")
            
            # Fallback to public (legacy system) during hybrid mode or when in public mode
            if self.migration_mode in ['hybrid', 'public']:
                logger.info("Generating public Cloudinary URL as fallback")
                
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
                            logger.info(f"Found public resource. Using versioned URL: {cloudinary_url}")
                            return cloudinary_url
                except Exception as lookup_err:
                    logger.warning(f"Failed to look up public resource: {str(lookup_err)}")
                
                # Fallback to using the path without version if lookup failed
                cloudinary_url += f"/{file_name}"
                logger.info(f"Generated fallback public URL: {cloudinary_url}")
                return cloudinary_url
            
            # If we're in private mode and auth failed, raise error
            raise Exception("Image not accessible - private mode enabled but authentication failed")
            
        except Exception as e:
            logger.error(f"Error generating URL: {str(e)}")
            raise Exception(f"Failed to generate URL: {str(e)}")

    async def generate_user_signed_url(self, file_path: str, user_id: str, expiration=3600, **transforms):
        """Generate signed URL with user-specific access control"""
        import logging
        logger = logging.getLogger(__name__)

        try:
            logger.info(f"Generating user-specific signed URL for user {user_id}, file {file_path}")

            # In hybrid mode, if this is already a public Cloudinary URL, return it directly
            if self.migration_mode == 'hybrid' and file_path.startswith('https://res.cloudinary.com/'):
                logger.info("Hybrid mode: Returning existing public Cloudinary URL")
                return file_path

            # For non-URL paths, verify user has permission to access this image
            if not await self._verify_user_access(file_path, user_id):
                raise Exception("Access denied - user does not have permission to view this image")
            
            # If it's a full URL but not Cloudinary, extract the path
            if file_path.startswith('http'):
                logger.warning(f"Received non-Cloudinary URL: {file_path}")
                # Return as-is for now
                return file_path
            
            # Clean file path
            clean_path = file_path.strip().strip('/')
            file_name, file_ext = os.path.splitext(clean_path)
            
            # Generate time-limited signed URL for authenticated assets
            transformation = {}
            transformation.update(transforms)
            
            auth_token_key = os.getenv('CLOUDINARY_AUTH_KEY')
            if auth_token_key:
                # Use token-based authentication if auth key is available
                signed_url = cloudinary.utils.cloudinary_url(
                    file_name,
                    type="authenticated",
                    sign_url=True,
                    auth_token={
                        "key": auth_token_key,
                        "duration": expiration,
                        "acl": f"/image/authenticated/{file_name}*"
                    },
                    **transformation
                )[0]
            else:
                # Fallback to basic signed URL
                signed_url = cloudinary.utils.cloudinary_url(
                    file_name,
                    type="authenticated",
                    sign_url=True,
                    **transformation
                )[0]
            
            logger.info(f"Generated user-specific signed URL successfully")
            return signed_url
            
        except Exception as e:
            logger.error(f"Error generating user-specific URL: {str(e)}")
            raise Exception(f"Failed to generate user URL: {str(e)}")
    
    async def _verify_user_access(self, file_path: str, user_id: str) -> bool:
        """Verify if user has access to the specified file path"""
        from ..utils.database_utils import Database
        from bson import ObjectId
        import logging
        logger = logging.getLogger(__name__)

        # No access if no user_id provided
        if not user_id:
            return False

        try:
            db = Database.get_db()

            # Get user to check if they're admin
            user = await db.users.find_one({"_id": ObjectId(user_id)})
            if user and user.get("role") in ["admin", "super_admin"]:
                return True

            # Extract student_id from file path: evidence/{student_id}/...
            if not file_path.startswith("evidence/"):
                return False

            path_parts = file_path.split("/")
            if len(path_parts) < 2:
                return False

            student_id_from_path = path_parts[1]

            # Check if user has access to this student
            try:
                # Handle both ObjectId and slug
                if ObjectId.is_valid(student_id_from_path):
                    student = await db.students.find_one({"_id": ObjectId(student_id_from_path)})
                else:
                    student = await db.students.find_one({"slug": student_id_from_path})

                if not student:
                    return False

                user_obj_id = ObjectId(user_id)

                # Check parent_access entries
                for access in student.get("parent_access", []):
                    if access.get("parent_id") == user_obj_id:
                        # Any access level allows viewing evidence
                        return True

                # For backward compatibility: check parent_ids
                if user_obj_id in student.get("parent_ids", []):
                    return True

                return False

            except Exception as e:
                logger.error(f"Error checking student access in _verify_user_access: {str(e)}")
                return False

        except Exception as e:
            logger.error(f"Error in _verify_user_access: {str(e)}")
            return False

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
