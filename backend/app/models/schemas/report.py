from typing import List, Dict, Optional
from datetime import datetime
from enum import Enum
from .base import MongoBaseModel, PyObjectId
from pydantic import BaseModel, Field

class ReportStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    GENERATING = "generating"

class ReportPeriod(str, Enum):
    ANNUAL = "annual"
    TERM_1 = "term_1"
    TERM_2 = "term_2"
    TERM_3 = "term_3"
    TERM_4 = "term_4"
    CUSTOM = "custom"

class EvidenceExample(BaseModel):
    evidence_id: PyObjectId
    thumbnail_url: str
    title: str
    description: Optional[str] = ""
    uploaded_at: datetime

class LearningAreaSummary(BaseModel):
    learning_area_code: str
    learning_area_name: str
    ai_generated_summary: Optional[str] = None
    user_edited_summary: Optional[str] = None
    is_edited: bool = False
    evidence_examples: List[EvidenceExample] = []
    evidence_count: int = 0
    outcomes_with_evidence: int = 0
    total_outcomes: int = 0
    progress_percentage: float = 0.0
    last_updated: datetime = Field(default_factory=datetime.utcnow)

class ExportSettings(BaseModel):
    include_thumbnails: bool = True
    include_evidence_links: bool = True
    include_progress_charts: bool = False

class StudentReport(MongoBaseModel):
    student_id: PyObjectId
    academic_year: str  # e.g., "2024-2025"
    report_period: ReportPeriod
    custom_period_name: Optional[str] = None  # For custom periods
    title: Optional[str] = None
    learning_area_summaries: List[LearningAreaSummary] = []
    generated_at: Optional[datetime] = None
    last_modified: datetime = Field(default_factory=datetime.utcnow)
    created_by: PyObjectId
    modified_by: Optional[PyObjectId] = None
    status: ReportStatus = ReportStatus.DRAFT
    export_settings: ExportSettings = Field(default_factory=ExportSettings)
    grade_level: Optional[str] = None
    
    # Metadata for tracking changes
    version: int = 1
    generation_time_seconds: Optional[float] = None  # Time taken to generate

# Request/Response models
class GenerateReportRequest(BaseModel):
    academic_year: str
    report_period: ReportPeriod
    custom_period_name: Optional[str] = None
    learning_area_codes: Optional[List[str]] = None  # If None, generate for all areas
    grade_level: Optional[str] = None

class UpdateLearningAreaSummaryRequest(BaseModel):
    user_edited_summary: str

class UpdateReportTitleRequest(BaseModel):
    title: str

class UpdateReportStatusRequest(BaseModel):
    status: ReportStatus

class ReportListResponse(BaseModel):
    reports: List[StudentReport]
    total: int 