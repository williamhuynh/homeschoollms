from typing import Optional
from pydantic import BaseModel

class EvidenceUpdate(BaseModel):
    title: Optional[str]
    description: Optional[str]
    learning_area_code: Optional[str]
    learning_outcome_code: Optional[str] 