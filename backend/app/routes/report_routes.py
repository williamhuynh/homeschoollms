from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from ..services.report_service import ReportService
from ..services.subscription_service import SubscriptionService
from ..models.schemas.report import (
    StudentReport,
    GenerateReportRequest,
    UpdateLearningAreaSummaryRequest,
    ReportListResponse,
    ReportStatus
)
from ..models.schemas.user import UserInDB
from ..utils.auth_utils import get_current_user
from ..utils.database_utils import Database
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Utility function to ensure user has access to student
async def ensure_student_access(student_id: str, current_user: UserInDB, required_level: str = "view"):
    """Check if user has required access level for a student."""
    db = Database.get_db()
    
    # Resolve student ID
    try:
        student_obj_id = ObjectId(student_id)
    except:
        # Try to find by slug
        student = await db.students.find_one({"slug": student_id})
        if student:
            student_obj_id = student["_id"]
        else:
            raise HTTPException(status_code=404, detail=f"Student not found: {student_id}")
    
    # Get student
    student = await db.students.find_one({"_id": student_obj_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Check access
    user_id = ObjectId(current_user.id)
    
    # Check parent_access array
    has_access = False
    access_level = None
    
    for access in student.get("parent_access", []):
        if access["parent_id"] == user_id:
            has_access = True
            access_level = access["access_level"]
            break
    
    # Fallback to parent_ids for backward compatibility
    if not has_access and user_id in student.get("parent_ids", []):
        has_access = True
        access_level = "admin"  # Legacy parents get admin access
    
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this student"
        )
    
    # Check access level
    level_hierarchy = {"view": 0, "content": 1, "admin": 2}
    if level_hierarchy.get(access_level, 0) < level_hierarchy.get(required_level, 0):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Insufficient permissions. Required: {required_level}, Current: {access_level}"
        )
    
    return student

@router.get("/reports/{student_id}", response_model=List[StudentReport])
async def get_student_reports(
    student_id: str,
    academic_year: Optional[str] = None,
    status: Optional[ReportStatus] = None,
    current_user: UserInDB = Depends(get_current_user)
):
    """Get all reports for a student."""
    # Ensure user has at least view access
    await ensure_student_access(student_id, current_user, "view")
    
    try:
        reports = await ReportService.get_student_reports(
            student_id, 
            academic_year=academic_year,
            status=status
        )
        return reports
    except Exception as e:
        logger.error(f"Error fetching reports: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/reports/{student_id}/{report_id}", response_model=StudentReport)
async def get_report(
    student_id: str,
    report_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """Get a specific report."""
    # Ensure user has at least view access
    await ensure_student_access(student_id, current_user, "view")
    
    try:
        report = await ReportService.get_report_by_id(report_id)
        # Verify the report belongs to the student
        if str(report.student_id) != student_id:
            # Try to match by resolved student ID
            db = Database.get_db()
            try:
                student_obj_id = ObjectId(student_id)
            except:
                student = await db.students.find_one({"slug": student_id})
                if student:
                    student_obj_id = student["_id"]
                else:
                    raise HTTPException(status_code=404, detail="Student not found")
            
            if str(report.student_id) != str(student_obj_id):
                raise HTTPException(status_code=403, detail="Report does not belong to this student")
        
        return report
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching report: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reports/{student_id}/generate", response_model=StudentReport)
async def generate_report(
    student_id: str,
    request: GenerateReportRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """Generate a new AI-powered report for a student."""
    # Ensure user has content access (required for report generation)
    await ensure_student_access(student_id, current_user, "content")
    
    # Check subscription allows report generation
    can_generate, message = await SubscriptionService.can_generate_reports(str(current_user.id))
    if not can_generate:
        raise HTTPException(status_code=403, detail=message)
    
    try:
        report = await ReportService.generate_report(
            student_id,
            request,
            current_user
        )
        return report
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating report: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/reports/{student_id}/{report_id}/learning-area/{learning_area_code}", response_model=StudentReport)
async def update_learning_area_summary(
    student_id: str,
    report_id: str,
    learning_area_code: str,
    request: UpdateLearningAreaSummaryRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """Update a specific learning area summary in a report."""
    # Ensure user has content access (required for editing)
    await ensure_student_access(student_id, current_user, "content")
    
    try:
        # First verify the report belongs to the student
        report = await ReportService.get_report_by_id(report_id)
        
        # Verify ownership
        db = Database.get_db()
        try:
            student_obj_id = ObjectId(student_id)
        except:
            student = await db.students.find_one({"slug": student_id})
            if student:
                student_obj_id = student["_id"]
            else:
                raise HTTPException(status_code=404, detail="Student not found")
        
        if str(report.student_id) != str(student_obj_id):
            raise HTTPException(status_code=403, detail="Report does not belong to this student")
        
        # Update the summary
        updated_report = await ReportService.update_learning_area_summary(
            report_id,
            learning_area_code,
            request,
            current_user
        )
        return updated_report
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating learning area summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/reports/{student_id}/{report_id}")
async def delete_report(
    student_id: str,
    report_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """Delete a report."""
    # Ensure user has admin access (required for deletion)
    await ensure_student_access(student_id, current_user, "admin")
    
    try:
        # First verify the report belongs to the student
        report = await ReportService.get_report_by_id(report_id)
        
        # Verify ownership
        db = Database.get_db()
        try:
            student_obj_id = ObjectId(student_id)
        except:
            student = await db.students.find_one({"slug": student_id})
            if student:
                student_obj_id = student["_id"]
            else:
                raise HTTPException(status_code=404, detail="Student not found")
        
        if str(report.student_id) != str(student_obj_id):
            raise HTTPException(status_code=403, detail="Report does not belong to this student")
        
        # Delete the report
        success = await ReportService.delete_report(report_id)
        if success:
            return {"message": "Report deleted successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete report")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting report: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# New endpoints
from ..models.schemas.report import UpdateReportTitleRequest, UpdateReportStatusRequest, UpdateReportOverviewRequest

@router.put("/reports/{student_id}/{report_id}/title", response_model=StudentReport)
async def update_report_title(
    student_id: str,
    report_id: str,
    request: UpdateReportTitleRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    # content-level access required
    await ensure_student_access(student_id, current_user, "content")
    # verify ownership
    report = await ReportService.get_report_by_id(report_id)
    db = Database.get_db()
    try:
        student_obj_id = ObjectId(student_id)
    except:
        student = await db.students.find_one({"slug": student_id})
        if student:
            student_obj_id = student["_id"]
        else:
            raise HTTPException(status_code=404, detail="Student not found")
    if str(report.student_id) != str(student_obj_id):
        raise HTTPException(status_code=403, detail="Report does not belong to this student")
    return await ReportService.update_report_title(report_id, request.title, current_user)

@router.put("/reports/{student_id}/{report_id}/status", response_model=StudentReport)
async def update_report_status(
    student_id: str,
    report_id: str,
    request: UpdateReportStatusRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    # content-level access required to publish/draft
    await ensure_student_access(student_id, current_user, "content")
    # verify ownership
    report = await ReportService.get_report_by_id(report_id)
    db = Database.get_db()
    try:
        student_obj_id = ObjectId(student_id)
    except:
        student = await db.students.find_one({"slug": student_id})
        if student:
            student_obj_id = student["_id"]
        else:
            raise HTTPException(status_code=404, detail="Student not found")
    if str(report.student_id) != str(student_obj_id):
        raise HTTPException(status_code=403, detail="Report does not belong to this student")
    return await ReportService.update_report_status(report_id, request.status, current_user)

@router.put("/reports/{student_id}/{report_id}/overview", response_model=StudentReport)
async def update_report_overview(
    student_id: str,
    report_id: str,
    request: UpdateReportOverviewRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """Update the parent overview section of a report."""
    # content-level access required
    await ensure_student_access(student_id, current_user, "content")
    # verify ownership
    report = await ReportService.get_report_by_id(report_id)
    db = Database.get_db()
    try:
        student_obj_id = ObjectId(student_id)
    except:
        student = await db.students.find_one({"slug": student_id})
        if student:
            student_obj_id = student["_id"]
        else:
            raise HTTPException(status_code=404, detail="Student not found")
    if str(report.student_id) != str(student_obj_id):
        raise HTTPException(status_code=403, detail="Report does not belong to this student")
    return await ReportService.update_report_overview(report_id, request.parent_overview, current_user)


@router.post("/reports/{student_id}/{report_id}/regenerate", response_model=StudentReport)
async def regenerate_report(
    student_id: str,
    report_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    # content-level access required
    await ensure_student_access(student_id, current_user, "content")
    return await ReportService.regenerate_report(student_id, report_id, current_user) 