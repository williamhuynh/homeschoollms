from typing import List, Optional
from .base import MongoBaseModel, PyObjectId

class Subject(MongoBaseModel):
    name: str
    code: str
    description: Optional[str]
    grade_levels: List[str]
    organization_id: Optional[PyObjectId]  # If custom to org
    is_standard: bool = True  # If it's a standard subject
    parent_subject_id: Optional[PyObjectId] = None  # For subject hierarchies