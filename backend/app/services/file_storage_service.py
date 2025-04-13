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
        logging.basicConfig(level=logging.ERROR)
        logger = logging.getLogger(__name__)
        
        # Log the environment variables
        logger.error(f"BACKBLAZE_ENDPOINT: {os.getenv('BACKBLAZE_ENDPOINT')}")
        logger.error(f"BACKBLAZE_KEY_ID: {os.getenv('BACKBLAZE_KEY_ID')}")
        logger.error(f"BACKBLAZE_APPLICATION_KEY: {'*****' if os.getenv('BACKBLAZE_APPLICATION_KEY') else None}")
        logger.error(f"BACKBLAZE_BUCKET_NAME: {os.getenv('BACKBLAZE_BUCKET_NAME')}")
        
        self.s3 = boto3.client(
            's3',
            endpoint_url=os.getenv('BACKBLAZE_ENDPOINT'),
            aws_access_key_id=os.getenv('BACKBLAZE_KEY_ID'),
            aws_secret_access_key=os.getenv('BACKBLAZE_APPLICATION_KEY'),
            config=Config(signature_version='s3v4')
        )
        self.bucket_name = os.getenv('BACKBLAZE_BUCKET_NAME')
        
        # Log the s3 client
        logger.error(f"S3 client: {self.s3}")

    async def upload_file(self, file: UploadFile, file_path: str, generate_thumbnail=False, thumbnail_size=(200, 200)):
        import logging
        logging.basicConfig(level=logging.ERROR)
        logger = logging.getLogger(__name__)

        try:
            # Log the environment variables
            logger.error(f"BACKBLAZE_ENDPOINT: {os.getenv('BACKBLAZE_ENDPOINT')}")
            logger.error(f"BACKBLAZE_KEY_ID: {os.getenv('BACKBLAZE_KEY_ID')}")
            logger.error(f"BACKBLAZE_APPLICATION_KEY: {'*****' if os.getenv('BACKBLAZE_APPLICATION_KEY') else None}")
            logger.error(f"BACKBLAZE_BUCKET_NAME: {os.getenv('BACKBLAZE_BUCKET_NAME')}")
            
            # Log the s3 client
            logger.error(f"S3 client: {self.s3}")
            logger.error(f"Bucket name: {self.bucket_name}")
            
            # Log the file object and its file attribute before passing to upload_fileobj
            logger.error(f"Received file object: {file}")
            logger.error(f"Received file.file: {file.file}")

            # Check if file.file is None
            if file.file is None:
                logger.error("file.file is None")
                raise Exception("file.file is None")

            # Log the type of file.file
            logger.error(f"Type of file.file: {type(file.file)}")

            # Log the seekable status of file.file
            logger.error(f"Is file.file seekable? {file.file.seekable()}")

            # Log the current position of the file.file object
            logger.error(f"Current position of file.file before seek: {file.file.tell()}")

            # Check if file.file is seekable and seek to the beginning if it is
            if file.file.seekable():
                file.file.seek(0)
                logger.error(f"Seeked file.file to position: {file.file.tell()}")

            # Log the file path
            logger.error(f"Generated file path: {file_path}")

            # Log the file content type
            logger.error(f"File content type: {file.content_type}")

            # Log the file size
            logger.error(f"File size: {file.size}")

            # Log the file data before upload
            file_data = file.file.read()
            logger.error(f"File data length: {len(file_data)}")
            logger.error(f"File data type: {type(file_data)}")
            
            # Check if file_data is None
            if file_data is None:
                logger.error("file_data is None")
                raise Exception("file_data is None")
                
            # Check if file_data is empty
            if len(file_data) == 0:
                logger.error("file_data is empty")
                raise Exception("file_data is empty")

            # Upload using boto3.resource
            logger.error("Using boto3.resource")
            
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
            logger.error(f"Bucket: {bucket}")
            
            # Upload the file data directly
            from io import BytesIO
            bucket.upload_fileobj(
                BytesIO(file_data),
                file_path,
                ExtraArgs={'ContentType': file.content_type}
            )
            
            # Log the current position of the file.file object after upload
            logger.error(f"Current position of file.file after upload: {file.file.tell()}")

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
            logger.error(f"Generated presigned URL: {presigned_url}")

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
                thumbnail_path = f"{self.bucket_name}/{thumbnail_url.split('/')[-1]}"
                edge_function_thumbnail_url = f"{base_url}/{path}/{thumbnail_path}"
            
            logger.error(f"Returning URLs - File: {edge_function_file_url}, Thumbnail: {edge_function_thumbnail_url}")
            
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
        try:
            params = {
                'Bucket': self.bucket_name, 
                'Key': file_path,
                'ResponseContentType': 'image/png',  # Set appropriate content type
                'ResponseContentDisposition': content_disposition  # Can be 'inline' or 'attachment; filename="..."'
            }
            
            url = self.s3.generate_presigned_url(
                'get_object',
                Params=params,
                ExpiresIn=expiration
            )
            return url
        except Exception as e:
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

file_storage_service = FileStorageService()
