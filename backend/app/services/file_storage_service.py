import os
import boto3
import io
from PIL import Image
from botocore.client import Config
from fastapi import UploadFile
from ..config import settings

# CDN configuration
CDN_URL = os.getenv('CDN_URL', '')  # e.g., 'https://cdn.yourdomain.com'

# Vercel Edge Function configuration
VERCEL_URL = os.getenv('VERCEL_URL', '')  # e.g., 'https://your-app.vercel.app'
EDGE_FUNCTION_PATH = os.getenv('EDGE_FUNCTION_PATH', '/api/images')  # Path to the Edge Function

class FileStorageService:
    def __init__(self):
        import logging
        logging.basicConfig(level=logging.INFO) # Changed level to INFO
        logger = logging.getLogger(__name__)
        
        # Log the environment variables
        logger.info(f"BACKBLAZE_ENDPOINT: {os.getenv('BACKBLAZE_ENDPOINT')}") # Changed level to INFO
        logger.info(f"BACKBLAZE_KEY_ID: {os.getenv('BACKBLAZE_KEY_ID')}") # Changed level to INFO
        logger.info(f"BACKBLAZE_APPLICATION_KEY: {'*****' if os.getenv('BACKBLAZE_APPLICATION_KEY') else None}") # Changed level to INFO
        logger.info(f"BACKBLAZE_BUCKET_NAME: {os.getenv('BACKBLAZE_BUCKET_NAME')}") # Changed level to INFO
        
        self.s3 = boto3.client(
            's3',
            endpoint_url=os.getenv('BACKBLAZE_ENDPOINT'),
            aws_access_key_id=os.getenv('BACKBLAZE_KEY_ID'),
            aws_secret_access_key=os.getenv('BACKBLAZE_APPLICATION_KEY'),
            config=Config(signature_version='s3v4')
        )
        self.bucket_name = os.getenv('BACKBLAZE_BUCKET_NAME')
        
        # Log the s3 client
        logger.info(f"S3 client: {self.s3}") # Changed level to INFO

    async def upload_file(self, file: UploadFile, file_path: str, generate_thumbnail=False, thumbnail_size=(200, 200)):
        import logging
        logging.basicConfig(level=logging.INFO) # Changed level to INFO
        logger = logging.getLogger(__name__)

        try:
            # Log the environment variables
            logger.info(f"BACKBLAZE_ENDPOINT: {os.getenv('BACKBLAZE_ENDPOINT')}") # Changed level to INFO
            logger.info(f"BACKBLAZE_KEY_ID: {os.getenv('BACKBLAZE_KEY_ID')}") # Changed level to INFO
            logger.info(f"BACKBLAZE_APPLICATION_KEY: {'*****' if os.getenv('BACKBLAZE_APPLICATION_KEY') else None}") # Changed level to INFO
            logger.info(f"BACKBLAZE_BUCKET_NAME: {os.getenv('BACKBLAZE_BUCKET_NAME')}") # Changed level to INFO
            
            # Log the s3 client
            logger.info(f"S3 client: {self.s3}") # Changed level to INFO
            logger.info(f"Bucket name: {self.bucket_name}") # Changed level to INFO
            
            # Log the file object and its file attribute before passing to upload_fileobj
            logger.info(f"Received file object: {file}") # Changed level to INFO
            logger.info(f"Received file.file: {file.file}") # Changed level to INFO

            # Check if file.file is None
            if file.file is None:
                logger.error("file.file is None")
                raise Exception("file.file is None")

            # Log the type of file.file
            logger.info(f"Type of file.file: {type(file.file)}") # Changed level to INFO

            # Log the seekable status of file.file
            logger.info(f"Is file.file seekable? {file.file.seekable()}") # Changed level to INFO

            # Log the current position of the file.file object
            logger.info(f"Current position of file.file before seek: {file.file.tell()}") # Changed level to INFO

            # Check if file.file is seekable and seek to the beginning if it is
            if file.file.seekable():
                file.file.seek(0)
                logger.info(f"Seeked file.file to position: {file.file.tell()}") # Changed level to INFO

            # Log the file path
            logger.info(f"Generated file path: {file_path}") # Changed level to INFO

            # Log the file content type
            logger.info(f"File content type: {file.content_type}") # Changed level to INFO

            # Log the file size
            logger.info(f"File size: {file.size}") # Changed level to INFO

            # Log the file data before upload
            file_data = file.file.read()
            logger.info(f"File data length: {len(file_data)}") # Changed level to INFO
            logger.info(f"File data type: {type(file_data)}") # Changed level to INFO
            
            # Check if file_data is None
            if file_data is None:
                logger.error("file_data is None")
                raise Exception("file_data is None")
                
            # Check if file_data is empty
            if len(file_data) == 0:
                logger.error("file_data is empty")
                raise Exception("file_data is empty")

            # Upload using boto3.resource
            logger.info("Using boto3.resource") # Changed level to INFO
            
            # Create a new boto3 resource
            s3_resource = boto3.resource(
                's3',
                endpoint_url=os.getenv('BACKBLAZE_ENDPOINT'),
                aws_access_key_id=os.getenv('BACKBLAZE_KEY_ID'),
                aws_secret_access_key=os.getenv('BACKBLAZE_APPLICATION_KEY'),
                config=Config(signature_version='s3v4')
            )
            
            # Get the bucket
            bucket = s3_resource.Bucket(self.bucket_name)
            
            # Log the bucket
            logger.info(f"Bucket: {bucket}") # Changed level to INFO
            
            # Upload the file data directly
            from io import BytesIO
            bucket.upload_fileobj(
                BytesIO(file_data),
                file_path,
                ExtraArgs={'ContentType': file.content_type}
            )
            
            # Log the current position of the file.file object after upload
            logger.info(f"Current position of file.file after upload: {file.file.tell()}") # Changed level to INFO

            # If thumbnail generation is requested, generate and upload it
            thumbnail_url = None
            if generate_thumbnail:
                try:
                    # Reset file pointer for thumbnail generation
                    file.file.seek(0)
                    thumbnail_url = await self.generate_and_upload_thumbnail(file, file_path, thumbnail_size)
                except Exception as e:
                    logger.error(f"Error generating thumbnail: {str(e)}")
                    # Continue even if thumbnail generation fails

            # Generate presigned URLs for immediate access
            presigned_url = self.generate_presigned_url(file_path)
            logger.info(f"Generated presigned URL: {presigned_url}") # Changed level to INFO

            # Store the presigned URL in the database or cache for immediate use
            # But return Edge Function URLs for the frontend
            file_url = f"{self.bucket_name}/{file_path}"
            
            # Always use Edge Function URLs for the frontend
            if not VERCEL_URL:
                logger.error("VERCEL_URL not configured")
                raise Exception("VERCEL_URL environment variable must be configured")
            
            # Construct Edge Function URLs
            base_url = VERCEL_URL.rstrip('/')
            path = EDGE_FUNCTION_PATH.lstrip('/')
            edge_function_file_url = f"{base_url}/{path}/{file_url}"
            
            # Construct the thumbnail URL using Edge Function
            edge_function_thumbnail_url = None
            if thumbnail_url:
                thumbnail_path = f"{self.bucket_name}/{thumbnail_url['original_url'].split('/')[-1]}"
                edge_function_thumbnail_url = f"{base_url}/{path}/{thumbnail_path}"
            
            logger.info(f"Returning URLs - File: {edge_function_file_url}, Thumbnail: {edge_function_thumbnail_url}") # Changed level to INFO
            
            # Return URLs in the format expected by the frontend components
            return {
                "original_url": edge_function_file_url,
                "thumbnail_small_url": f"{edge_function_file_url}?width=150&height=150&quality=80",
                "thumbnail_medium_url": f"{edge_function_file_url}?width=400&height=300&quality=80",
                "thumbnail_large_url": f"{edge_function_file_url}?width=600&height=450&quality=80"
            }
        except Exception as e:
            logger.error(f"Error uploading file: {str(e)}")
            raise Exception(f"Failed to upload file: {str(e)}")

    def generate_presigned_url(self, file_path: str, expiration=3600, content_disposition='inline'):
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            logger.info(f"Generating presigned URL for file: {file_path}")
            logger.info(f"Parameters - Expiration: {expiration}s, Disposition: {content_disposition}")
            
            # Determine content type based on file extension
            content_type = 'application/octet-stream'  # Default fallback
            if file_path:
                ext = file_path.lower().split('.')[-1] if '.' in file_path else ''
                # Map extensions to content types
                content_type_map = {
                    'png': 'image/png',
                    'jpg': 'image/jpeg',
                    'jpeg': 'image/jpeg',
                    'gif': 'image/gif',
                    'webp': 'image/webp',
                    'svg': 'image/svg+xml',
                    'pdf': 'application/pdf',
                    'doc': 'application/msword',
                    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'xls': 'application/vnd.ms-excel',
                    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'ppt': 'application/vnd.ms-powerpoint',
                    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                    'txt': 'text/plain',
                    'csv': 'text/csv',
                    'html': 'text/html',
                    'mp4': 'video/mp4',
                    'mp3': 'audio/mpeg',
                    'wav': 'audio/wav',
                    'json': 'application/json',
                    'zip': 'application/zip'
                }
                content_type = content_type_map.get(ext, 'application/octet-stream')
            
            logger.info(f"Determined content type: {content_type}")
            
            # Extract filename for attachment disposition if needed
            filename = file_path.split('/')[-1] if '/' in file_path else file_path
            final_disposition = content_disposition
            if content_disposition == 'attachment':
                final_disposition = f'attachment; filename="{filename}"'
            
            params = {
                'Bucket': self.bucket_name, 
                'Key': file_path,
                'ResponseContentType': content_type,
                'ResponseContentDisposition': final_disposition
            }
            
            logger.info(f"Generating presigned URL with params: {params}")
            
            url = self.s3.generate_presigned_url(
                'get_object',
                Params=params,
                ExpiresIn=expiration
            )
            
            logger.info(f"Successfully generated presigned URL (expires in {expiration}s)")
            logger.debug(f"Generated URL: {url[:50]}...")  # Log part of the URL for debugging
            
            return url
        except Exception as e:
            logger.error(f"Failed to generate presigned URL: {str(e)}")
            raise Exception(f"Failed to generate presigned URL: {str(e)}")
            
    async def generate_and_upload_thumbnail(self, file: UploadFile, original_path: str, size=(200, 200)):
        """Generate a thumbnail and upload it to storage."""
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            # Read the file
            contents = await file.read()
            image = Image.open(io.BytesIO(contents))
            
            # Generate thumbnail
            image.thumbnail(size)
            
            # Save to buffer
            buffer = io.BytesIO()
            image.save(buffer, format=image.format or 'JPEG')
            buffer.seek(0)
            
            # Generate thumbnail path
            path_parts = original_path.split('.')
            thumbnail_path = f"{path_parts[0]}_thumb.{path_parts[1]}"
            
            # Upload thumbnail using boto3.resource
            s3_resource = boto3.resource(
                's3',
                endpoint_url=os.getenv('BACKBLAZE_ENDPOINT'),
                aws_access_key_id=os.getenv('BACKBLAZE_KEY_ID'),
                aws_secret_access_key=os.getenv('BACKBLAZE_APPLICATION_KEY'),
                config=Config(signature_version='s3v4')
            )
            
            # Get the bucket
            bucket = s3_resource.Bucket(self.bucket_name)
            
            # Upload the thumbnail
            bucket.upload_fileobj(
                buffer,
                thumbnail_path,
                ExtraArgs={'ContentType': file.content_type}
            )
            
            # Reset file pointer for future operations
            await file.seek(0)
            
            # Return the thumbnail path
            thumbnail_url = f"{self.bucket_name}/{thumbnail_path}"
            
            # If Vercel Edge Function is configured, use it
            # Always use Edge Function URLs with appropriate transformations
            if VERCEL_URL:
                base_url = VERCEL_URL.rstrip('/')
                path = EDGE_FUNCTION_PATH.lstrip('/')
                # Fix: Ensure the path doesn't include [...path].js
                if path.endswith('[...path].js'):
                    path = "api/images"
                edge_function_url = f"{base_url}/{path}/{thumbnail_path}"
                return {
                    "original_url": edge_function_url,
                    "thumbnail_small_url": f"{edge_function_url}?width=150&height=150&quality=80",
                    "thumbnail_medium_url": f"{edge_function_url}?width=400&height=300&quality=80",
                    "thumbnail_large_url": f"{edge_function_url}?width=600&height=450&quality=80"
                }
            else:
                # Fall back to CDN if available, or direct Backblaze URL
                base_url = f"{CDN_URL}/{thumbnail_path}" if CDN_URL else thumbnail_url
                return {
                    "original_url": base_url,
                    "thumbnail_small_url": base_url,
                    "thumbnail_medium_url": base_url,
                    "thumbnail_large_url": base_url
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
