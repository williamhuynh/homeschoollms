from ..utils.database_utils import Database
from ..models.schemas.learning_outcome import LearningOutcome
from fastapi import HTTPException
from bson import ObjectId
from typing import List, Optional
import os

class LearningOutcomeService:
    @staticmethod
    async def create_learning_outcome(
        outcome: LearningOutcome,
        organization_id: Optional[str] = None
    ):
        db = Database.get_db()
        
        # Check if outcome code already exists for the subject and organization
        existing = await db.learning_outcomes.find_one({
            "code": outcome.code,
            "subject_id": ObjectId(outcome.subject_id),
            "organization_id": ObjectId(organization_id) if organization_id else None
        })
        if existing:
            raise HTTPException(status_code=400, detail="Learning outcome code already exists")
            
        outcome_dict = outcome.dict()
        if organization_id:
            outcome_dict["organization_id"] = ObjectId(organization_id)
            
        result = await db.learning_outcomes.insert_one(outcome_dict)
        created_outcome = await db.learning_outcomes.find_one({"_id": result.inserted_id})
        return LearningOutcome(**created_outcome)

    @staticmethod
    async def get_subject_outcomes(
        subject_id: str,
        grade_level: Optional[str] = None,
        organization_id: Optional[str] = None
    ):
        db = Database.get_db()
        query = {"subject_id": ObjectId(subject_id)}
        
        if organization_id:
            query["$or"] = [
                {"organization_id": ObjectId(organization_id)},
                {"is_standard": True}
            ]
        else:
            query["is_standard"] = True
            
        if grade_level:
            query["grade_level"] = grade_level
            
        outcomes = await db.learning_outcomes.find(query).to_list(None)
        return [LearningOutcome(**outcome) for outcome in outcomes]

    @staticmethod
    async def get_prerequisite_tree(outcome_id: str):
        db = Database.get_db()
        outcome = await db.learning_outcomes.find_one({"_id": ObjectId(outcome_id)})
        if not outcome:
            raise HTTPException(status_code=404, detail="Learning outcome not found")
            
        prerequisites = []
        if outcome.get("prerequisites"):
            for prereq_id in outcome["prerequisites"]:
                prereq = await db.learning_outcomes.find_one({"_id": prereq_id})
                if prereq:
                    prerequisites.append(LearningOutcome(**prereq))
                    
        return prerequisites

    @staticmethod
    async def update_mastery_status(student_id: str, outcome_id: str, is_mastered: bool):
        db = Database.get_db()
        
        # Update the student's mastered outcomes list
        operation = "$addToSet" if is_mastered else "$pull"
        result = await db.students.update_one(
            {"_id": ObjectId(student_id)},
            {operation: {"mastered_outcome_ids": ObjectId(outcome_id)}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Failed to update mastery status")
            
        # Get updated student record
        student = await db.students.find_one({"_id": ObjectId(student_id)})
        return {"mastered": is_mastered, "outcome_id": outcome_id}

    @staticmethod
    async def get_student_learning_outcome(student_id: str, learning_outcome_id: str):
        db = Database.get_db()
        import logging
        logger = logging.getLogger(__name__)
        
        # Try to find by ObjectId first
        try:
            outcome = await db.learning_outcomes.find_one({"_id": ObjectId(learning_outcome_id)})
        except:
            outcome = None
            
        # If not found by ObjectId, try to find by code (case-insensitive)
        if not outcome:
            import re
            code_pattern = re.compile(f"^{re.escape(learning_outcome_id)}$", re.IGNORECASE)
            outcome = await db.learning_outcomes.find_one({"code": {"$regex": code_pattern}})
            if not outcome:
                raise HTTPException(status_code=404, detail="Learning outcome not found")
        
        # Convert outcome to a serializable dict
        serialized_outcome = {}
        for key, value in outcome.items():
            if isinstance(value, ObjectId):
                serialized_outcome[key] = str(value)
            else:
                serialized_outcome[key] = value
                
        # Get student's evidence for this outcome
        evidence_list = await db.student_evidence.find({
            "student_id": ObjectId(student_id),
            "learning_outcome_id": outcome["_id"]
        }).to_list(None)
        
        # Convert evidence to serializable format
        serialized_evidence = []
        for item in evidence_list:
            # Create a new dict with string IDs instead of ObjectId
            serialized_item = {}
            for key, value in item.items():
                if isinstance(value, ObjectId):
                    serialized_item[key] = str(value)
                else:
                    serialized_item[key] = value
            
                # Ensure the file_url field is properly formatted
                if "file_url" in serialized_item:
                    file_url = serialized_item["file_url"]
                    # If it doesn't start with http, generate a presigned URL
                    if not file_url.startswith("http"):
                        from ..services.file_storage_service import file_storage_service
                        
                        # Remove bucket name from the beginning if it's there
                        bucket_name = os.getenv('BACKBLAZE_BUCKET_NAME', 'homeschoollms')
                        if file_url.startswith(f"{bucket_name}/"):
                            file_url = file_url[len(f"{bucket_name}/"):]
                            
                        # Generate a presigned URL with proper headers
                        try:
                            # Generate the presigned URL
                            presigned_url = file_storage_service.generate_presigned_url(file_url)
                            
                            # Use our proxy endpoint to avoid CORS issues
                            api_url = os.getenv('API_URL', 'https://homeschoollms-server.onrender.com')
                            serialized_item["fileUrl"] = f"{api_url}/api/evidence-proxy?url={presigned_url}"
                        except Exception as e:
                            logger.error(f"Error generating presigned URL: {str(e)}")
                            # Fallback to direct URL if presigned URL generation fails
                            backblaze_endpoint = os.getenv('BACKBLAZE_ENDPOINT', 'https://s3.us-east-005.backblazeb2.com')
                            direct_url = f"{backblaze_endpoint}/{bucket_name}/{file_url}"
                            
                            # Still use our proxy to avoid CORS issues
                            api_url = os.getenv('API_URL', 'https://homeschoollms-server.onrender.com')
                            serialized_item["fileUrl"] = f"{api_url}/api/evidence-proxy?url={direct_url}"
            
            serialized_evidence.append(serialized_item)
        
        return {
            **serialized_outcome,
            "evidence": serialized_evidence or []
        }

    @staticmethod
    async def get_evidence(student_id: str, learning_outcome_id: str):
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            db = Database.get_db()
            
            logger.info(f"Converting IDs: student_id={student_id}, learning_outcome_id={learning_outcome_id}")
            student_obj_id = ObjectId(student_id)
            
            # Try to find outcome by ObjectId first
            try:
                outcome_obj_id = ObjectId(learning_outcome_id)
            except:
                outcome_obj_id = None
                
            # If not found by ObjectId, try to find by code (case-insensitive)
            if not outcome_obj_id:
                logger.info(f"Looking up learning outcome by code: {learning_outcome_id}")
                logger.info(f"Database name: {db.name}")
                logger.info(f"Collection stats: {await db.learning_outcomes.count_documents({})}")
                
                import re
                code_pattern = re.compile(f"^{re.escape(learning_outcome_id)}$", re.IGNORECASE)
                outcome = await db.learning_outcomes.find_one({"code": {"$regex": code_pattern}})
                if not outcome:
                    logger.info(f"No learning outcome found with code: {learning_outcome_id}")
                    return []
                outcome_obj_id = outcome["_id"]
                logger.info(f"Found learning outcome with ID: {outcome_obj_id}")
            
            logger.info(f"Querying evidence for student {student_obj_id} and outcome {outcome_obj_id}")
            evidence = await db.student_evidence.find({
                "student_id": student_obj_id,
                "learning_outcome_id": outcome_obj_id
            }).to_list(None)
            
            logger.info(f"Found {len(evidence)} evidence records")
            
            # Convert ObjectId fields to strings to make them JSON serializable
            serializable_evidence = []
            for item in evidence:
                # Create a new dict with string IDs instead of ObjectId
                serialized_item = {}
                for key, value in item.items():
                    if isinstance(value, ObjectId):
                        serialized_item[key] = str(value)
                    else:
                        serialized_item[key] = value
                
                # Ensure the file_url field is properly formatted
                if "file_url" in serialized_item:
                    file_url = serialized_item["file_url"]
                    # If it doesn't start with http, generate a presigned URL
                    if not file_url.startswith("http"):
                        from ..services.file_storage_service import file_storage_service
                        
                        # Remove bucket name from the beginning if it's there
                        bucket_name = os.getenv('BACKBLAZE_BUCKET_NAME', 'homeschoollms')
                        if file_url.startswith(f"{bucket_name}/"):
                            file_url = file_url[len(f"{bucket_name}/"):]
                            
                        # Generate a presigned URL with proper headers
                        try:
                            # Generate the presigned URL
                            presigned_url = file_storage_service.generate_presigned_url(file_url)
                            
                            # Use our proxy endpoint to avoid CORS issues
                            api_url = os.getenv('API_URL', 'https://homeschoollms-server.onrender.com')
                            serialized_item["fileUrl"] = f"{api_url}/api/evidence-proxy?url={presigned_url}"
                        except Exception as e:
                            logger.error(f"Error generating presigned URL: {str(e)}")
                            # Fallback to direct URL if presigned URL generation fails
                            backblaze_endpoint = os.getenv('BACKBLAZE_ENDPOINT', 'https://s3.us-east-005.backblazeb2.com')
                            direct_url = f"{backblaze_endpoint}/{bucket_name}/{file_url}"
                            
                            # Still use our proxy to avoid CORS issues
                            api_url = os.getenv('API_URL', 'https://homeschoollms-server.onrender.com')
                            serialized_item["fileUrl"] = f"{api_url}/api/evidence-proxy?url={direct_url}"
                
                serializable_evidence.append(serialized_item)
            
            return serializable_evidence or []
        except Exception as e:
            logger.error(f"Error in get_evidence: {str(e)}", exc_info=True)
            raise Exception(f"Failed to fetch evidence: {str(e)}")
