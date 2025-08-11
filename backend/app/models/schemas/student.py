from typing import List, Dict, Optional
from datetime import date
from enum import Enum
from .base import MongoBaseModel, PyObjectId

class AccessLevel(str, Enum):
    ADMIN = "admin"
    CONTENT = "content"
    VIEW = "view"

class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"
    PREFER_NOT_TO_SAY = "prefer_not_to_say"

class StudentSubject(MongoBaseModel):
    subject_id: PyObjectId
    current_grade_level: str
    start_date: date
    is_active: bool = True
    completed_content_ids: List[PyObjectId] = []
    mastered_outcome_ids: List[PyObjectId] = []
    progress: float = 0.0

class ParentAccess(MongoBaseModel):
    parent_id: PyObjectId
    access_level: AccessLevel = AccessLevel.VIEW

class Student(MongoBaseModel):
    first_name: str
    last_name: str
    date_of_birth: date
    gender: Gender
    grade_level: str
    slug: Optional[str] = None
    parent_ids: List[PyObjectId] = []  # Kept for backward compatibility
    parent_access: List[ParentAccess] = []  # New structure with access levels
    organization_id: Optional[PyObjectId]
    family_id: Optional[PyObjectId]
    subjects: Dict[str, StudentSubject] = {}  # Key: subject_id
    active_subjects: List[PyObjectId] = []
    # Optional avatar fields
    avatar_path: Optional[str] = None
    avatar_url: Optional[str] = None
    avatar_thumbnail_url: Optional[str] = None
