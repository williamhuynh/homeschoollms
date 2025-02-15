from typing import List, Dict
from datetime import date
from .base import MongoBaseModel, PyObjectId

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