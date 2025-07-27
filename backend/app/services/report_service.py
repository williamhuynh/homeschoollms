from ..utils.database_utils import Database
from ..models.schemas.report import (
    StudentReport, 
    ReportStatus, 
    ReportPeriod,
    LearningAreaSummary,
    EvidenceExample,
    GenerateReportRequest,
    UpdateLearningAreaSummaryRequest
)
from ..models.schemas.student import Student
from ..models.schemas.user import UserInDB
from ..services.ai_service import generate_learning_area_report
from ..services.learning_outcome_service import LearningOutcomeService
from ..services.student_service import StudentService
from fastapi import HTTPException
from bson import ObjectId
from typing import List, Optional, Dict
from datetime import datetime
import logging
import asyncio
import re

logger = logging.getLogger(__name__)

class ReportService:
    @staticmethod
    async def get_student_reports(
        student_id: str, 
        academic_year: Optional[str] = None,
        status: Optional[ReportStatus] = None
    ) -> List[StudentReport]:
        """Get all reports for a student, optionally filtered by year and status."""
        db = Database.get_db()
        
        # Resolve student ID (similar to learning outcome routes)
        try:
            student_obj_id = ObjectId(student_id)
        except:
            # Try to find by slug
            student = await db.students.find_one({"slug": student_id})
            if student:
                student_obj_id = student["_id"]
            else:
                raise HTTPException(status_code=404, detail=f"Student not found: {student_id}")
        
        query = {"student_id": student_obj_id}
        if academic_year:
            query["academic_year"] = academic_year
        if status:
            query["status"] = status
            
        reports = await db.student_reports.find(query).sort("created_at", -1).to_list(None)
        return [StudentReport(**report) for report in reports]
    
    @staticmethod
    async def get_report_by_id(report_id: str) -> StudentReport:
        """Get a specific report by ID."""
        db = Database.get_db()
        
        report = await db.student_reports.find_one({"_id": ObjectId(report_id)})
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
            
        return StudentReport(**report)
    
    @staticmethod
    async def generate_report(
        student_id: str,
        request: GenerateReportRequest,
        current_user: UserInDB
    ) -> StudentReport:
        """Generate a new AI-powered report for a student."""
        db = Database.get_db()
        start_time = datetime.utcnow()
        
        # Resolve student ID and get student info
        try:
            student_obj_id = ObjectId(student_id)
        except:
            # Try to find by slug
            student = await db.students.find_one({"slug": student_id})
            if student:
                student_obj_id = student["_id"]
            else:
                raise HTTPException(status_code=404, detail=f"Student not found: {student_id}")
        
        student = await StudentService.get_student_by_id(str(student_obj_id))
        
        # Check if report already exists for this period
        existing = await db.student_reports.find_one({
            "student_id": student_obj_id,
            "academic_year": request.academic_year,
            "report_period": request.report_period
        })
        
        if existing:
            raise HTTPException(
                status_code=400, 
                detail="Report already exists for this period. Delete existing report first."
            )
        
        # Create new report document
        report = StudentReport(
            student_id=student_obj_id,
            academic_year=request.academic_year,
            report_period=request.report_period,
            custom_period_name=request.custom_period_name,
            created_by=ObjectId(current_user.id),
            status=ReportStatus.GENERATING,
            learning_area_summaries=[]
        )
        
        # Insert the report in generating status
        result = await db.student_reports.insert_one(report.dict())
        report_id = result.inserted_id
        
        try:
            # Get curriculum data for the student's grade
            curriculum = await ReportService._get_curriculum_data(student.grade_level)
            
            # Filter learning areas if specific ones requested
            if request.learning_area_codes:
                curriculum["subjects"] = [
                    s for s in curriculum["subjects"] 
                    if s["code"] in request.learning_area_codes
                ]
            
            # Generate summaries for each learning area
            summaries = []
            for subject in curriculum["subjects"]:
                try:
                    summary = await ReportService._generate_learning_area_summary(
                        student_obj_id, 
                        subject,
                        request.report_period,
                        student.grade_level
                    )
                    summaries.append(summary)
                except Exception as e:
                    logger.error(f"Failed to generate summary for {subject['code']}: {str(e)}")
                    # Continue with other subjects even if one fails
            
            # Calculate generation time
            generation_time = (datetime.utcnow() - start_time).total_seconds()
            
            # Update report with generated summaries
            await db.student_reports.update_one(
                {"_id": report_id},
                {
                    "$set": {
                        "learning_area_summaries": [s.dict() for s in summaries],
                        "status": ReportStatus.DRAFT,
                        "generated_at": datetime.utcnow(),
                        "generation_time_seconds": generation_time
                    }
                }
            )
            
            # Return the updated report
            updated_report = await db.student_reports.find_one({"_id": report_id})
            return StudentReport(**updated_report)
            
        except Exception as e:
            # If generation fails, update status to draft with error
            await db.student_reports.update_one(
                {"_id": report_id},
                {"$set": {"status": ReportStatus.DRAFT}}
            )
            logger.error(f"Report generation failed: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")
    
    @staticmethod
    async def update_learning_area_summary(
        report_id: str,
        learning_area_code: str,
        update_request: UpdateLearningAreaSummaryRequest,
        current_user: UserInDB
    ) -> StudentReport:
        """Update a specific learning area summary in a report."""
        db = Database.get_db()
        
        # Get the report
        report = await db.student_reports.find_one({"_id": ObjectId(report_id)})
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        # Find and update the specific learning area summary
        updated = False
        for summary in report["learning_area_summaries"]:
            if summary["learning_area_code"] == learning_area_code:
                summary["user_edited_summary"] = update_request.user_edited_summary
                summary["is_edited"] = True
                summary["last_updated"] = datetime.utcnow()
                updated = True
                break
        
        if not updated:
            raise HTTPException(status_code=404, detail="Learning area not found in report")
        
        # Update the report
        await db.student_reports.update_one(
            {"_id": ObjectId(report_id)},
            {
                "$set": {
                    "learning_area_summaries": report["learning_area_summaries"],
                    "last_modified": datetime.utcnow(),
                    "modified_by": ObjectId(current_user.id)
                }
            }
        )
        
        # Return updated report
        updated_report = await db.student_reports.find_one({"_id": ObjectId(report_id)})
        return StudentReport(**updated_report)
    
    @staticmethod
    async def delete_report(report_id: str) -> bool:
        """Delete a report."""
        db = Database.get_db()
        
        result = await db.student_reports.delete_one({"_id": ObjectId(report_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Report not found")
            
        return True
    
    @staticmethod
    async def _generate_learning_area_summary(
        student_id: ObjectId,
        subject: Dict,
        report_period: ReportPeriod,
        grade_level: str
    ) -> LearningAreaSummary:
        """Generate a summary for a single learning area."""
        db = Database.get_db()
        
        # Get all evidence for this learning area
        evidence_query = {
            "student_id": student_id,
            "learning_area_codes": subject["code"],
            "deleted": {"$ne": True}
        }
        
        all_evidence = await db.student_evidence.find(evidence_query).sort("uploaded_at", -1).to_list(None)
        
        # Get learning outcomes for this subject
        outcomes = subject.get("outcomes", [])
        outcomes_with_evidence = set()
        
        # Count outcomes with evidence
        for evidence in all_evidence:
            for outcome_code in evidence.get("learning_outcome_codes", []):
                # Extract the base outcome code (e.g., "EN1-VOCAB-01" from any variation)
                outcomes_with_evidence.add(outcome_code.upper())
        
        # Select evidence examples (up to 6, prioritizing recent and varied)
        evidence_examples = []
        selected_outcomes = set()
        
        for evidence in all_evidence[:20]:  # Look at recent 20 items
            # Try to get variety in outcomes
            outcome_codes = evidence.get("learning_outcome_codes", [])
            if not outcome_codes or outcome_codes[0] in selected_outcomes:
                if len(evidence_examples) >= 6:
                    continue
            
            evidence_examples.append(EvidenceExample(
                evidence_id=evidence["_id"],
                thumbnail_url=evidence.get("thumbnail_url", ""),
                title=evidence.get("title", ""),
                description=evidence.get("description", ""),
                uploaded_at=evidence.get("uploaded_at", datetime.utcnow())
            ))
            
            if outcome_codes:
                selected_outcomes.add(outcome_codes[0])
            
            if len(evidence_examples) >= 6:
                break
        
        # Calculate progress
        total_outcomes = len(outcomes)
        outcomes_count = len(outcomes_with_evidence)
        progress = (outcomes_count / total_outcomes * 100) if total_outcomes > 0 else 0
        
        # Generate AI summary if evidence exists
        ai_summary = ""
        if all_evidence:
            try:
                ai_summary = await generate_learning_area_report(
                    student_id=str(student_id),
                    learning_area_code=subject["code"],
                    learning_area_name=subject["name"],
                    evidence_items=all_evidence[:10],  # Use up to 10 recent items
                    report_period=report_period,
                    grade_level=grade_level
                )
            except Exception as e:
                logger.error(f"AI generation failed for {subject['code']}: {str(e)}")
                ai_summary = f"Unable to generate summary for {subject['name']}."
        else:
            ai_summary = f"No evidence has been uploaded for {subject['name']} during this period."
        
        return LearningAreaSummary(
            learning_area_code=subject["code"],
            learning_area_name=subject["name"],
            ai_generated_summary=ai_summary,
            evidence_examples=evidence_examples,
            evidence_count=len(all_evidence),
            outcomes_with_evidence=outcomes_count,
            total_outcomes=total_outcomes,
            progress_percentage=progress
        )
    
    @staticmethod
    async def _get_curriculum_data(grade_level: str) -> Dict:
        """Load curriculum data for a grade level."""
        # This would typically load from the curriculum JSON files
        # For now, we'll use a simplified version
        # In production, this should load from the actual curriculum files
        
        import os
        import json
        
        # Map grade level to curriculum file
        grade_to_stage = {
            "Kindergarten": "early-stage-1",
            "Year 1": "stage-1",
            "Year 2": "stage-1",
            "Year 3": "stage-2",
            "Year 4": "stage-2",
            "Year 5": "stage-3",
            "Year 6": "stage-3",
            "Year 7": "stage-4",
            "Year 8": "stage-4",
            "Year 9": "stage-5",
            "Year 10": "stage-5"
        }
        
        stage = grade_to_stage.get(grade_level, "stage-1")
        curriculum_path = f"frontend/public/curriculum/{stage}-curriculum.json"
        
        try:
            with open(curriculum_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load curriculum for {grade_level}: {str(e)}")
            # Return a default structure
            return {
                "stage": stage,
                "subjects": []
            } 