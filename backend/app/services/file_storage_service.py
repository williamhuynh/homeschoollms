import os
import boto3
from botocore.client import Config
from fastapi import UploadFile
from ..config import settings

class FileStorageService:
    def __init__(self):
        self.s3 = boto3.client(
            's3',
            endpoint_url=os.getenv('BACKBLAZE_ENDPOINT'),
            aws_access_key_id=os.getenv('BACKBLAZE_KEY_ID'),
            aws_secret_access_key=os.getenv('BACKBLAZE_APPLICATION_KEY'),
            config=Config(signature_version='s3v4')
        )
        self.bucket_name = os.getenv('BACKBLAZE_BUCKET_NAME')

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

            # Check if file.file is seekable and seek to the beginning if it is
            if file.file.seekable():
                file.file.seek(0)

            # Log the current position of the file file object
            logger.error(f"Current position of file.file: {file.file.tell()}")

            self.s3.upload_fileobj(
                file.file,
                self.bucket_name,
                file_path,
                ExtraArgs={'ContentType': file.content_type}
            )

            # Log the current position of the file file object after upload
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
