from typing import Optional, List
from .base import MongoBaseModel, PyObjectId

class LearningOutcome(MongoBaseModel):
    name: str
    description: str
    subject_id: PyObjectId
    grade_level: str
    code: str  # For curriculum alignment
    category: Optional[str] = None
    organization_id: Optional[PyObjectId]  # If custom to org
    prerequisites: List[PyObjectId] = []  # Prerequisite outcomes
    difficulty_level: int = 1  # 1-5 scale
    is_standard: bool = True  # If it's a standard outcome