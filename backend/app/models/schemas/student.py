from typing import List, Dict, Optional
from datetime import date
from enum import Enum
from .base import MongoBaseModel, PyObjectId

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

class Student(MongoBaseModel):
    first_name: str
    last_name: str
    date_of_birth: date
    gender: Gender
    grade_level: str
    parent_ids: List[PyObjectId]  # Multiple parents/guardians
    organization_id: Optional[PyObjectId]
    family_id: Optional[PyObjectId]
    subjects: Dict[str, StudentSubject] = {}  # Key: subject_id
    active_subjects: List[PyObjectId] = []