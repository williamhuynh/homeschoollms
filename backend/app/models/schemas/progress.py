from typing import Optional, Dict
from datetime import datetime
from .base import MongoBaseModel, PyObjectId

class Progress(MongoBaseModel):
    student_id: PyObjectId
    content_id: PyObjectId
    status: str = "not_started"  # not_started, in_progress, completed
    start_date: Optional[datetime]
    completion_date: Optional[datetime]
    score: Optional[float]
    time_spent: int = 0  # in seconds
    attempts: int = 0
    metadata: Dict = {}  # For additional tracking data