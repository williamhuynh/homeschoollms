from typing import List, Dict, Optional
from datetime import date
from .base import MongoBaseModel, PyObjectId
from pydantic import BaseModel

class ContentBase(MongoBaseModel):
    title: str
    description: str
    subject_id: PyObjectId
    content_type: str  # video, exercise, document, etc.
    content_date: date
    created_by: PyObjectId
    organization_id: Optional[PyObjectId]
    learning_outcome_ids: List[PyObjectId] = []
    difficulty_level: int = 1  # 1-5 scale
    estimated_duration: int  # in minutes
    prerequisites: List[PyObjectId] = []  # Prerequisite content
    tags: List[str] = []
    metadata: Dict = {}  # Flexible metadata field

class SignedUrlRequest(BaseModel):
    file_path: str
    width: Optional[int] = None
    height: Optional[int] = None
    quality: Optional[int] = 80
    expiration: Optional[int] = 3600  # 1 hour default