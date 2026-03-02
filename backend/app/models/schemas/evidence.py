from typing import Optional, List
from pydantic import BaseModel

class LearningResource(BaseModel):
    name: str
    type: Optional[str] = None
    details: Optional[str] = None

class EvidenceUpdate(BaseModel):
    title: Optional[str]
    description: Optional[str]
    learning_area_codes: Optional[List[str]]
    learning_outcome_codes: Optional[List[str]]
    learning_resources: Optional[List[LearningResource]] = None

class EvidenceCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    learning_outcome_codes: List[str]
    learning_area_codes: Optional[List[str]] = None
    location: Optional[str] = None
    student_grade: Optional[str] = None
    learning_resources: Optional[List[LearningResource]] = None
