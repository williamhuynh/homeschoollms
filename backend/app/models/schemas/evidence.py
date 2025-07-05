from typing import Optional, List
from pydantic import BaseModel

class EvidenceUpdate(BaseModel):
    title: Optional[str]
    description: Optional[str]
    learning_area_codes: Optional[List[str]]
    learning_outcome_codes: Optional[List[str]]

class EvidenceCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    learning_outcome_codes: List[str]  # Required array
    learning_area_codes: Optional[List[str]] = None
    location: Optional[str] = None
    student_grade: Optional[str] = None 