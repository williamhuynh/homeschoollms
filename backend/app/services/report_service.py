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
from ..services.curriculum_service import CurriculumService
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
        
        # Backward-compatible match for reports that may have stored different field names/types
        query: Dict = {
            "$or": [
                {"student_id": student_obj_id},
                {"student_id": str(student_obj_id)},
                {"studentId": student_obj_id},
                {"studentId": str(student_obj_id)}
            ]
        }
        if academic_year:
            query["academic_year"] = academic_year
        # Store and query enums as their string values
        if status:
            query["status"] = status.value if hasattr(status, "value") else str(status)
            
        reports = await db.student_reports.find(query).sort("created_at", -1).to_list(None)
        # Normalize enums from stored strings for response model
        normalized = []
        for doc in reports:
            if isinstance(doc.get("status"), str):
                try:
                    doc["status"] = ReportStatus(doc["status"])
                except Exception:
                    pass
            if isinstance(doc.get("report_period"), str):
                try:
                    doc["report_period"] = ReportPeriod(doc["report_period"])
                except Exception:
                    pass
            normalized.append(StudentReport(**doc))
        return normalized
    
    @staticmethod
    async def get_report_by_id(report_id: str) -> StudentReport:
        """Get a specific report by ID."""
        db = Database.get_db()
        
        # Primary lookup by ObjectId
        report = None
        try:
            report = await db.student_reports.find_one({"_id": ObjectId(report_id)})
        except Exception:
            report = None

        # Fallbacks for legacy records that may have string _id or different field name
        if not report:
            # _id stored as string
            report = await db.student_reports.find_one({"_id": report_id})
        if not report:
            # legacy field name
            report = await db.student_reports.find_one({"id": report_id})
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
        # Compute default title using student's first name, grade, and period label
        try:
            report_period_enum = request.report_period if isinstance(request.report_period, ReportPeriod) else ReportPeriod(request.report_period)
        except Exception:
            report_period_enum = ReportPeriod.ANNUAL
        period_label_map = {
            ReportPeriod.ANNUAL: "Annual Report",
            ReportPeriod.TERM_1: "Term 1 Report",
            ReportPeriod.TERM_2: "Term 2 Report",
            ReportPeriod.TERM_3: "Term 3 Report",
            ReportPeriod.TERM_4: "Term 4 Report",
            ReportPeriod.CUSTOM: "Custom Period",
        }
        period_label = period_label_map.get(
            report_period_enum,
            (report_period_enum.value if hasattr(report_period_enum, "value") else str(report_period_enum))
        )
        if report_period_enum == ReportPeriod.CUSTOM and request.custom_period_name:
            period_label = request.custom_period_name
        selected_grade_for_title = request.grade_level or getattr(student, "grade_level", "") or ""
        default_title = f"{getattr(student, 'first_name', '').strip()}'s {selected_grade_for_title} {period_label}".strip()

        report = StudentReport(
            student_id=student_obj_id,
            academic_year=request.academic_year,
            report_period=request.report_period if isinstance(request.report_period, ReportPeriod) else ReportPeriod(request.report_period),
            custom_period_name=request.custom_period_name,
            created_by=ObjectId(current_user.id),
            status=ReportStatus.GENERATING,
            learning_area_summaries=[],
            grade_level=request.grade_level or student.grade_level,
            title=default_title
        )
        
        # Insert the report in generating status ensuring correct BSON/primitive types
        report_doc = report.model_dump(by_alias=True)
        # Ensure ObjectId and enum string values are stored
        report_doc["student_id"] = student_obj_id
        report_doc["created_by"] = ObjectId(current_user.id)
        report_doc["status"] = ReportStatus.GENERATING.value
        if isinstance(report_doc.get("report_period"), ReportPeriod):
            report_doc["report_period"] = report_doc["report_period"].value

        result = await db.student_reports.insert_one(report_doc)
        report_id = result.inserted_id
        
        try:
            # Get curriculum data for the selected grade (fallback to student's current grade)
            selected_grade_level = request.grade_level or student.grade_level
            logger.info(f"Loading curriculum data for grade level: {selected_grade_level}")
            curriculum = await CurriculumService.load_curriculum(selected_grade_level)
            subjects = list(curriculum.get("subjects", []))
            logger.info(f"Loaded curriculum with {len(subjects)} subjects")
            
            # Log the subjects found
            for subject in subjects:
                logger.info(f"Available subject: {subject.get('name', 'Unknown')} ({subject.get('code', 'No code')})")
            
            # Filter learning areas if specific ones requested
            if request.learning_area_codes:
                logger.info(f"Filtering to specific learning areas: {request.learning_area_codes}")
                original_count = len(subjects)
                subjects = [
                    s for s in subjects 
                    if s.get("code") in request.learning_area_codes
                ]
                logger.info(f"Filtered from {original_count} to {len(subjects)} subjects")
            
            # Fallback: if we couldn't load subjects (e.g., curriculum files not available in backend),
            # discover learning areas directly from student's evidence so the report still contains content.
            if not subjects:
                logger.warning("No subjects loaded from curriculum. Falling back to discovering learning areas from evidence.")
                subjects = await ReportService._discover_learning_areas_from_evidence(student_obj_id, selected_grade_level)
                logger.info(f"Discovered {len(subjects)} learning areas from evidence for student {student_obj_id}")
            
            # Generate summaries for each learning area
            summaries = []
            logger.info(f"Starting summary generation for {len(subjects)} subjects")
            
            for i, subject in enumerate(subjects):
                try:
                    logger.info(f"[{i+1}/{len(subjects)}] Generating summary for {subject['name']} ({subject['code']})")
                    summary = await ReportService._generate_learning_area_summary(
                        student_obj_id, 
                        subject,
                        request.report_period,
                        (request.grade_level or student.grade_level)
                    )
                    logger.info(f"Successfully generated summary for {subject['name']}: {len(summary.ai_generated_summary)} chars, {summary.evidence_count} evidence items")
                    summaries.append(summary)
                except Exception as e:
                    logger.error(f"Failed to generate summary for {subject.get('code', 'UNKNOWN')}: {str(e)}", exc_info=True)
                    # Continue with other subjects even if one fails
            
            # Calculate generation time
            generation_time = (datetime.utcnow() - start_time).total_seconds()
            
            logger.info(f"Report generation completed in {generation_time:.2f} seconds")
            logger.info(f"Generated {len(summaries)} learning area summaries")
            
            # Log summary of what was generated
            for summary in summaries:
                logger.info(f"  Summary for {summary.learning_area_name}: {summary.evidence_count} evidence, {summary.outcomes_with_evidence}/{summary.total_outcomes} outcomes, {len(summary.ai_generated_summary)} chars")
            
            # Update report with generated summaries
            summaries_data = [s.dict() for s in summaries]
            logger.info(f"Updating report {report_id} with {len(summaries_data)} summaries")
            
            update_result = await db.student_reports.update_one(
                {"_id": report_id},
                {
                    "$set": {
                        "learning_area_summaries": summaries_data,
                        "status": ReportStatus.DRAFT.value,
                        "generated_at": datetime.utcnow(),
                        "generation_time_seconds": generation_time
                    }
                }
            )
            
            logger.info(f"Report update result: matched={update_result.matched_count}, modified={update_result.modified_count}")
            
            # Return the updated report
            updated_report = await db.student_reports.find_one({"_id": report_id})
            if updated_report:
                logger.info(f"Retrieved updated report with {len(updated_report.get('learning_area_summaries', []))} summaries")
            else:
                logger.error(f"Failed to retrieve updated report {report_id}")
            
            # Normalize fields before returning
            if isinstance(updated_report.get("status"), str):
                try:
                    updated_report["status"] = ReportStatus(updated_report["status"])
                except Exception:
                    pass
            if isinstance(updated_report.get("report_period"), str):
                try:
                    updated_report["report_period"] = ReportPeriod(updated_report["report_period"])
                except Exception:
                    pass
            return StudentReport(**updated_report)
            
        except Exception as e:
            # If generation fails, update status to draft with error
            await db.student_reports.update_one(
                {"_id": report_id},
                {"$set": {"status": ReportStatus.DRAFT.value}}
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
        
        # Get the report with robust id handling
        report = None
        try:
            report = await db.student_reports.find_one({"_id": ObjectId(report_id)})
        except Exception:
            report = None
        if not report:
            report = await db.student_reports.find_one({"_id": report_id})
        if not report:
            report = await db.student_reports.find_one({"id": report_id})
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
        
        # Update the report using the actual _id value
        await db.student_reports.update_one(
            {"_id": report["_id"]},
            {
                "$set": {
                    "learning_area_summaries": report["learning_area_summaries"],
                    "last_modified": datetime.utcnow(),
                    "modified_by": ObjectId(current_user.id)
                }
            }
        )
        
        # Return updated report
        updated_report = await db.student_reports.find_one({"_id": report["_id"]})
        return StudentReport(**updated_report)
    
    @staticmethod
    async def delete_report(report_id: str) -> bool:
        """Delete a report."""
        db = Database.get_db()
        
        # Try multiple deletion strategies for backward compatibility
        # 1) ObjectId _id
        try:
            result = await db.student_reports.delete_one({"_id": ObjectId(report_id)})
            if result.deleted_count > 0:
                return True
        except Exception:
            pass
        # 2) String _id
        result = await db.student_reports.delete_one({"_id": report_id})
        if result.deleted_count > 0:
            return True
        # 3) Legacy 'id' field
        result = await db.student_reports.delete_one({"id": report_id})
        if result.deleted_count > 0:
            return True
        
        raise HTTPException(status_code=404, detail="Report not found")
    
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
        # Handle both array-based (new) and string-based (legacy) storage formats
        # Use case-insensitive matching for robustness
        subject_code = subject["code"]
        evidence_query = {
            "student_id": student_id,
            "$or": [
                # New array-based format: learning_area_codes contains the subject code
                {"learning_area_codes": {"$in": [subject_code]}},
                # Case-insensitive array matching
                {"learning_area_codes": {"$elemMatch": {"$regex": f"^{subject_code}$", "$options": "i"}}},
                # Legacy string-based format (backward compatibility)
                {"learning_area_codes": subject_code},
                {"learning_area_codes": {"$regex": f"^{subject_code}$", "$options": "i"}}
            ],
            "deleted": {"$ne": True}
        }
        # If evidence contains grade_level metadata, filter to selected grade only
        if grade_level:
            evidence_query["$and"] = evidence_query.get("$and", []) + [
                {"$or": [
                    {"grade_level": {"$exists": False}},
                    {"grade_level": {"$eq": grade_level}}
                ]}
            ]
        
        logger.info(f"Searching for evidence with learning area code: {subject_code}")
        logger.info(f"Evidence query: {evidence_query}")
        
        all_evidence = await db.student_evidence.find(evidence_query).sort("uploaded_at", -1).to_list(None)
        logger.info(f"Found {len(all_evidence)} evidence items for {subject['name']} ({subject_code})")
        
        # Log details about evidence found
        if all_evidence:
            logger.info(f"Sample evidence items:")
            for i, evidence in enumerate(all_evidence[:3]):  # Log first 3 items
                logger.info(f"  Evidence {i+1}: {evidence.get('title', 'No title')} - Areas: {evidence.get('learning_area_codes', [])} - Outcomes: {evidence.get('learning_outcome_codes', [])}")
        else:
            logger.warning(f"No evidence found for {subject['name']} ({subject_code})")
            
            # Let's also check what evidence exists for this student regardless of learning area
            all_student_evidence = await db.student_evidence.find({
                "student_id": student_id,
                "deleted": {"$ne": True}
            }).to_list(None)
            logger.info(f"Total evidence for student: {len(all_student_evidence)} items")
            
            if all_student_evidence:
                logger.info("Sample of all student evidence:")
                for i, evidence in enumerate(all_student_evidence[:5]):
                    logger.info(f"  Evidence {i+1}: {evidence.get('title', 'No title')} - Areas: {evidence.get('learning_area_codes', [])} - Type: {type(evidence.get('learning_area_codes'))}")
            
            # Check for evidence with any learning area codes
            evidence_with_areas = await db.student_evidence.find({
                "student_id": student_id,
                "learning_area_codes": {"$exists": True, "$ne": None, "$ne": []},
                "deleted": {"$ne": True}
            }).to_list(None)
            logger.info(f"Evidence with learning_area_codes: {len(evidence_with_areas)} items")
        
        # Get learning outcomes for this subject
        outcomes = subject.get("outcomes", [])
        # If outcomes are missing (e.g., subject discovered from evidence without full curriculum data),
        # try to hydrate from the curriculum using the subject code for this student's grade level
        if not outcomes:
            try:
                hydrated = await CurriculumService.get_subject_by_code(grade_level, subject.get("code"))
                if hydrated:
                    outcomes = hydrated.get("outcomes", [])
            except Exception:
                # If hydration fails, proceed with empty outcomes list
                pass
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
        # Resolve student's name for personalization and placeholder replacement
        student_first_name = None
        student_last_name = None
        try:
            student_obj = await StudentService.get_student_by_id(str(student_id))
            student_first_name = getattr(student_obj, "first_name", None) or None
            student_last_name = getattr(student_obj, "last_name", None) or None
        except Exception:
            pass
        if all_evidence:
            logger.info(f"Generating AI summary for {subject['name']} with {len(all_evidence)} evidence items (using top {min(12, len(all_evidence))})")
            try:
                ai_summary = await generate_learning_area_report(
                    student_id=str(student_id),
                    learning_area_code=subject["code"],
                    learning_area_name=subject["name"],
                    evidence_items=all_evidence[:12],  # Use up to 12 recent items for richer context
                    report_period=report_period,
                    grade_level=grade_level,
                    outcomes_data=outcomes,  # Pass full outcome definitions for context
                    student_name=student_first_name  # Pass student's first name for personalization
                )
                # Normalize any template placeholders with the student's name
                if ai_summary and student_first_name:
                    # Common placeholders we may see
                    placeholder_patterns = [
                        r"\[\s*Child\s*'?s\s*name\s*\]",
                        r"\[\s*Student\s*'?s\s*name\s*\]",
                        r"\{\s*Child\s*'?s\s*name\s*\}",
                        r"\{\s*Student\s*'?s\s*name\s*\}",
                    ]
                    display_name = student_first_name if not student_last_name else f"{student_first_name} {student_last_name}"
                    for pattern in placeholder_patterns:
                        try:
                            ai_summary = re.sub(pattern, display_name, ai_summary, flags=re.IGNORECASE)
                        except Exception:
                            pass
                logger.info(f"Successfully generated AI summary for {subject['name']}: {len(ai_summary)} characters")
            except Exception as e:
                logger.error(f"AI generation failed for {subject['code']}: {str(e)}", exc_info=True)
                # Provide a deterministic dummy summary so we can verify the pipeline end-to-end
                ai_summary = f"{len(all_evidence)} evidence item(s) uploaded for {subject['name']}."
        else:
            logger.info(f"No evidence found for {subject['name']}, using default message")
            ai_summary = f"No evidence has been uploaded for {subject['name']} during this period."
            # Also normalize placeholders in case future templates introduce them
            if ai_summary and student_first_name:
                display_name = student_first_name if not student_last_name else f"{student_first_name} {student_last_name}"
                try:
                    ai_summary = re.sub(r"\[\s*Child\s*'?s\s*name\s*\]", display_name, ai_summary, flags=re.IGNORECASE)
                except Exception:
                    pass
        
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
    async def _discover_learning_areas_from_evidence(student_id: ObjectId, grade_level: str) -> List[Dict]:
        """Discover distinct learning areas from student's evidence.
        Returns a list of minimal subject dicts: { code, name, outcomes }
        Attempts to map codes back to full subject data when curriculum is available.
        """
        db = Database.get_db()
        logger.info("Discovering learning areas from evidence via aggregation")
        
        # Build aggregation to handle both array and legacy string formats for learning_area_codes
        pipeline = [
            {"$match": {"student_id": student_id, "deleted": {"$ne": True}}},
            {"$project": {
                "codes": {
                    "$cond": [
                        {"$isArray": "$learning_area_codes"},
                        "$learning_area_codes",
                        {"$cond": [
                            {"$and": [
                                {"$ne": ["$learning_area_codes", None]},
                                {"$ne": ["$learning_area_codes", ""]}
                            ]},
                            ["$learning_area_codes"],
                            []
                        ]}
                    ]
                }
            }},
            {"$unwind": "$codes"},
            {"$group": {"_id": {"$toUpper": "$codes"}, "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        
        try:
            agg_results = await db.student_evidence.aggregate(pipeline).to_list(None)
        except Exception as e:
            logger.error(f"Aggregation failed when discovering learning areas: {e}")
            agg_results = []
        
        codes = [doc["_id"] for doc in agg_results if doc.get("_id")]
        logger.info(f"Found {len(codes)} distinct learning area code(s) from evidence: {codes}")
        
        # Attempt to map to full subject data for nicer names
        subjects: List[Dict] = []
        curriculum = await CurriculumService.load_curriculum(grade_level)
        curriculum_subjects = {s.get("code"): s for s in curriculum.get("subjects", [])}

        # Build a resilient alias map to handle stage/code variations and outcome-prefix aliases
        # Map alias -> list of candidate canonical subject codes. We'll pick the first present in the current curriculum.
        alias_to_candidates: Dict[str, List[str]] = {
            # English
            "ENG": ["ENG"], "EN": ["ENG"], "EN1": ["ENG"], "EN2": ["ENG"], "EN3": ["ENG"], "ENE": ["ENG"],
            # Mathematics
            "MAT": ["MAT", "MATH"], "MATH": ["MATH", "MAT"], "MA": ["MATH", "MAT"],
            "MAE": ["MATH", "MAT"], "MA1": ["MATH", "MAT"], "MA2": ["MATH", "MAT"], "MA3": ["MATH", "MAT"],
            # HSIE
            "HSIE": ["HSIE", "HSE"], "HSE": ["HSIE", "HSE"], "HS": ["HSIE", "HSE"], "HS1": ["HSIE", "HSE"],
            # Science and Technology
            "SCI": ["SCI", "STE"], "STE": ["SCI", "STE"], "ST": ["SCI", "STE"], "ST1": ["SCI", "STE"],
            # Creative Arts
            "CRA": ["CRA", "CART"], "CART": ["CART", "CRA"], "CA": ["CRA", "CART"], "CAE": ["CRA", "CART"], "CA1": ["CRA", "CART"],
            # PDH/PDHPE
            "PDH": ["PDH", "PHE"], "PDHPE": ["PDH", "PHE"], "PHE": ["PDH", "PHE"], "PH": ["PDH", "PHE"], "PH1": ["PDH", "PHE"],
            # Languages variants
            "ABL": ["ABL", "ALE"], "ALE": ["ABL", "ALE"],
            "AUS": ["AUS", "AUE"], "AUE": ["AUS", "AUE"],
            "CLA": ["CLA", "CLE"], "CLE": ["CLA", "CLE"],
            "MOD": ["MOD", "MLE"], "MLE": ["MOD", "MLE"],
        }

        def resolve_subject_for_code(raw_code: str) -> Dict:
            if not raw_code:
                return None
            code_upper = str(raw_code).upper()
            # Direct match first
            if code_upper in curriculum_subjects:
                return curriculum_subjects[code_upper]
            # Try alias resolution: take token before '-' if present
            token = code_upper.split("-")[0]
            # Also strip trailing digits to handle forms like EN1, MA1
            token_no_digits = token.rstrip("0123456789") or token

            candidate_keys: List[str] = []
            if token in alias_to_candidates:
                candidate_keys.extend(alias_to_candidates[token])
            if token_no_digits in alias_to_candidates:
                candidate_keys.extend(alias_to_candidates[token_no_digits])
            # As a last heuristic, try the first three letters
            if len(token) >= 3 and token[:3] in alias_to_candidates:
                candidate_keys.extend(alias_to_candidates[token[:3]])
            # Pick the first that exists in current curriculum
            for candidate in candidate_keys:
                if candidate in curriculum_subjects:
                    return curriculum_subjects[candidate]
            return None

        for code in codes:
            subject = resolve_subject_for_code(code)
            if subject:
                subjects.append(subject)
            else:
                # Fallback with code as name to keep visibility, but outcomes will be empty
                subjects.append({"code": code, "name": code, "outcomes": []})

        return subjects

    # New methods
    @staticmethod
    async def update_report_title(report_id: str, title: str, current_user: UserInDB) -> StudentReport:
        db = Database.get_db()
        # Find report
        report = None
        try:
            report = await db.student_reports.find_one({"_id": ObjectId(report_id)})
        except Exception:
            report = await db.student_reports.find_one({"_id": report_id})
        if not report:
            report = await db.student_reports.find_one({"id": report_id})
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        await db.student_reports.update_one(
            {"_id": report["_id"]},
            {"$set": {"title": title, "last_modified": datetime.utcnow(), "modified_by": ObjectId(current_user.id)}}
        )
        updated = await db.student_reports.find_one({"_id": report["_id"]})
        return StudentReport(**updated)

    @staticmethod
    async def update_report_status(report_id: str, status: ReportStatus, current_user: UserInDB) -> StudentReport:
        db = Database.get_db()
        # Find report
        report = None
        try:
            report = await db.student_reports.find_one({"_id": ObjectId(report_id)})
        except Exception:
            report = await db.student_reports.find_one({"_id": report_id})
        if not report:
            report = await db.student_reports.find_one({"id": report_id})
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        # Only allow valid transitions (generating -> draft handled by generator)
        if status not in [ReportStatus.DRAFT, ReportStatus.PUBLISHED]:
            raise HTTPException(status_code=400, detail="Invalid status update")
        await db.student_reports.update_one(
            {"_id": report["_id"]},
            {"$set": {"status": status.value if hasattr(status, 'value') else str(status), "last_modified": datetime.utcnow(), "modified_by": ObjectId(current_user.id)}}
        )
        updated = await db.student_reports.find_one({"_id": report["_id"]})
        # Normalize
        if isinstance(updated.get("status"), str):
            try:
                updated["status"] = ReportStatus(updated["status"])
            except Exception:
                pass
        if isinstance(updated.get("report_period"), str):
            try:
                updated["report_period"] = ReportPeriod(updated["report_period"])
            except Exception:
                pass
        return StudentReport(**updated)

    @staticmethod
    async def regenerate_report(student_id: str, report_id: str, current_user: UserInDB) -> StudentReport:
        db = Database.get_db()
        # Resolve student id
        try:
            student_obj_id = ObjectId(student_id)
        except Exception:
            student_doc = await db.students.find_one({"slug": student_id})
            if not student_doc:
                raise HTTPException(status_code=404, detail=f"Student not found: {student_id}")
            student_obj_id = student_doc["_id"]
        # Fetch report
        report = None
        try:
            report = await db.student_reports.find_one({"_id": ObjectId(report_id)})
        except Exception:
            report = await db.student_reports.find_one({"_id": report_id})
        if not report:
            report = await db.student_reports.find_one({"id": report_id})
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        # Ensure report belongs to student
        if str(report.get("student_id")) != str(student_obj_id):
            raise HTTPException(status_code=403, detail="Report does not belong to this student")
        # Set status to generating
        await db.student_reports.update_one(
            {"_id": report["_id"]},
            {"$set": {"status": ReportStatus.GENERATING.value, "last_modified": datetime.utcnow(), "modified_by": ObjectId(current_user.id)}}
        )
        # Re-run generation using existing academic_year and report_period
        generate_request = GenerateReportRequest(
            academic_year=report.get("academic_year"),
            report_period=report.get("report_period") if isinstance(report.get("report_period"), ReportPeriod) else ReportPeriod(report.get("report_period")),
            custom_period_name=report.get("custom_period_name"),
            learning_area_codes=None,
            grade_level=report.get("grade_level")
        )
        # Instead of creating a new document, reuse same report id: call internal logic below
        start_time = datetime.utcnow()
        student = await StudentService.get_student_by_id(str(student_obj_id))
        # Load curriculum
        selected_grade_level = generate_request.grade_level or student.grade_level
        curriculum = await CurriculumService.load_curriculum(selected_grade_level)
        subjects = list(curriculum.get("subjects", []))
        if not subjects:
            subjects = await ReportService._discover_learning_areas_from_evidence(student_obj_id, selected_grade_level)
        summaries: List[LearningAreaSummary] = []
        for subject in subjects:
            try:
                summaries.append(
                    await ReportService._generate_learning_area_summary(
                        student_obj_id,
                        subject,
                        generate_request.report_period,
                        selected_grade_level
                    )
                )
            except Exception as e:
                logger.error(f"Failed to regenerate summary for {subject.get('code')}: {e}")
        generation_time = (datetime.utcnow() - start_time).total_seconds()
        await db.student_reports.update_one(
            {"_id": report["_id"]},
            {"$set": {
                "learning_area_summaries": [s.dict() for s in summaries],
                "status": ReportStatus.DRAFT.value,
                "generated_at": datetime.utcnow(),
                "generation_time_seconds": generation_time,
                "last_modified": datetime.utcnow()
            }}
        )
        updated = await db.student_reports.find_one({"_id": report["_id"]})
        if isinstance(updated.get("status"), str):
            try:
                updated["status"] = ReportStatus(updated["status"])
            except Exception:
                pass
        if isinstance(updated.get("report_period"), str):
            try:
                updated["report_period"] = ReportPeriod(updated["report_period"])
            except Exception:
                pass
        return StudentReport(**updated)
    
 