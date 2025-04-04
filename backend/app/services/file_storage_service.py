import os
import boto3
from botocore.client import Config
from fastapi import UploadFile
from ..config import settings

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

    async def upload_file(self, file: UploadFile, file_path: str):
        import logging
        logging.basicConfig(level=logging.ERROR)
        logger = logging.getLogger(__name__)

        try:
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

            # Try a different approach: write the file data to a temporary file and use upload_file
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False) as temp_file:
                temp_file.write(file_data)
                temp_file_path = temp_file.name
            
            logger.error(f"Temporary file path: {temp_file_path}")
            
            # Upload to Backblaze B2 using upload_file
            logger.error("Using upload_file instead of put_object")
            self.s3.upload_file(
                Filename=temp_file_path,
                Bucket=self.bucket_name,
                Key=file_path,
                ExtraArgs={'ContentType': file.content_type}
            )
            
            # Clean up the temporary file
            os.unlink(temp_file_path)

            # Log the current position of the file.file object after upload
            logger.error(f"Current position of file.file after upload: {file.file.tell()}")

            return f"{self.bucket_name}/{file_path}"
        except Exception as e:
            logger.error(f"Error uploading file: {str(e)}")
            raise Exception(f"Failed to upload file: {str(e)}")

    def generate_presigned_url(self, file_path: str, expiration=3600):
        try:
            url = self.s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': file_path},
                ExpiresIn=expiration
            )
            return url
        except Exception as e:
            raise Exception(f"Failed to generate presigned URL: {str(e)}")

file_storage_service = FileStorageService()
