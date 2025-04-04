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
        try:
            self.s3.upload_fileobj(
                file.file,
                self.bucket_name,
                file_path,
                ExtraArgs={'ContentType': file.content_type}
            )
            return f"{self.bucket_name}/{file_path}"
        except Exception as e:
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
