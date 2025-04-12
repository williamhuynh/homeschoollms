from ..utils.database_utils import Database
from ..models.schemas.learning_outcome import LearningOutcome
from fastapi import HTTPException
from bson import ObjectId
from typing import List, Optional
import os
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

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
                            presigned_url = file_storage_service.generate_presigned_url(file_url)
                            serialized_item["fileUrl"] = presigned_url
                        except Exception as e:
                            logger.error(f"Error generating presigned URL: {str(e)}")
                            # Fallback to direct URL if presigned URL generation fails
                            backblaze_endpoint = os.getenv('BACKBLAZE_ENDPOINT', 'https://s3.us-east-005.backblazeb2.com')
                            serialized_item["fileUrl"] = f"{backblaze_endpoint}/{bucket_name}/{file_url}"
                
                # Handle thumbnail_url field similarly
                if "thumbnail_url" in serialized_item:
                    thumbnail_url = serialized_item["thumbnail_url"]
                    # If it doesn't start with http, generate a presigned URL
                    if thumbnail_url and not thumbnail_url.startswith("http"):
                        from ..services.file_storage_service import file_storage_service
                        
                        # Remove bucket name from the beginning if it's there
                        bucket_name = os.getenv('BACKBLAZE_BUCKET_NAME', 'homeschoollms')
                        if thumbnail_url.startswith(f"{bucket_name}/"):
                            thumbnail_url = thumbnail_url[len(f"{bucket_name}/"):]
                            
                        # Generate a presigned URL with proper headers
                        try:
                            presigned_url = file_storage_service.generate_presigned_url(thumbnail_url)
                            serialized_item["thumbnailUrl"] = presigned_url
                        except Exception as e:
                            logger.error(f"Error generating presigned URL for thumbnail: {str(e)}")
                            # Fallback to direct URL if presigned URL generation fails
                            backblaze_endpoint = os.getenv('BACKBLAZE_ENDPOINT', 'https://s3.us-east-005.backblazeb2.com')
                            serialized_item["thumbnailUrl"] = f"{backblaze_endpoint}/{bucket_name}/{thumbnail_url}"
            
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
            # Only return evidence that is not marked as deleted
            evidence = await db.student_evidence.find({
                "student_id": student_obj_id,
                "learning_outcome_id": outcome_obj_id,
                "$or": [
                    {"deleted": {"$exists": False}},
                    {"deleted": False}
                ]
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
                            presigned_url = file_storage_service.generate_presigned_url(file_url)
                            serialized_item["fileUrl"] = presigned_url
                        except Exception as e:
                            logger.error(f"Error generating presigned URL: {str(e)}")
                            # Fallback to direct URL if presigned URL generation fails
                            backblaze_endpoint = os.getenv('BACKBLAZE_ENDPOINT', 'https://s3.us-east-005.backblazeb2.com')
                            serialized_item["fileUrl"] = f"{backblaze_endpoint}/{bucket_name}/{file_url}"
                
                # Handle thumbnail_url field similarly
                if "thumbnail_url" in serialized_item:
                    thumbnail_url = serialized_item["thumbnail_url"]
                    # If it doesn't start with http, generate a presigned URL
                    if thumbnail_url and not thumbnail_url.startswith("http"):
                        from ..services.file_storage_service import file_storage_service
                        
                        # Remove bucket name from the beginning if it's there
                        bucket_name = os.getenv('BACKBLAZE_BUCKET_NAME', 'homeschoollms')
                        if thumbnail_url.startswith(f"{bucket_name}/"):
                            thumbnail_url = thumbnail_url[len(f"{bucket_name}/"):]
                            
                        # Generate a presigned URL with proper headers
                        try:
                            presigned_url = file_storage_service.generate_presigned_url(thumbnail_url)
                            serialized_item["thumbnailUrl"] = presigned_url
                        except Exception as e:
                            logger.error(f"Error generating presigned URL for thumbnail: {str(e)}")
                            # Fallback to direct URL if presigned URL generation fails
                            backblaze_endpoint = os.getenv('BACKBLAZE_ENDPOINT', 'https://s3.us-east-005.backblazeb2.com')
                            serialized_item["thumbnailUrl"] = f"{backblaze_endpoint}/{bucket_name}/{thumbnail_url}"
                
                serializable_evidence.append(serialized_item)
            
            return serializable_evidence or []
        except Exception as e:
            logger.error(f"Error in get_evidence: {str(e)}", exc_info=True)
            raise Exception(f"Failed to fetch evidence: {str(e)}")
            
    @staticmethod
    async def mark_evidence_as_deleted(student_id: str, learning_outcome_id: str, evidence_id: str):
        """
        Mark evidence as deleted without removing it from storage.
        """
        try:
            db = Database.get_db()
            
            # Convert IDs to ObjectId
            student_obj_id = ObjectId(student_id)
            evidence_obj_id = ObjectId(evidence_id)
            
            # Try to find outcome by ObjectId first
            try:
                outcome_obj_id = ObjectId(learning_outcome_id)
            except:
                # If conversion fails, look up by code (case-insensitive)
                import re
                code_pattern = re.compile(f"^{re.escape(learning_outcome_id)}$", re.IGNORECASE)
                outcome = await db.learning_outcomes.find_one({"code": {"$regex": code_pattern}})
                if not outcome:
                    raise HTTPException(status_code=404, detail="Learning outcome not found")
                outcome_obj_id = outcome["_id"]
            
            # Find the evidence
            evidence = await db.student_evidence.find_one({
                "_id": evidence_obj_id,
                "student_id": student_obj_id,
                "learning_outcome_id": outcome_obj_id
            })
            
            if not evidence:
                raise HTTPException(status_code=404, detail="Evidence not found")
            
            # Mark as deleted
            result = await db.student_evidence.update_one(
                {"_id": evidence_obj_id},
                {"$set": {"deleted": True, "deleted_at": datetime.now()}}
            )
            
            if result.modified_count == 0:
                raise HTTPException(status_code=500, detail="Failed to mark evidence as deleted")
                
            return {"success": True}
        except Exception as e:
            logger.error(f"Error marking evidence as deleted: {str(e)}", exc_info=True)
            raise Exception(f"Failed to mark evidence as deleted: {str(e)}")
    
    @staticmethod
    async def generate_evidence_download_url(student_id: str, learning_outcome_id: str, evidence_id: str):
        """
        Generate a download URL for the evidence file.
        """
        try:
            db = Database.get_db()
            
            # Convert IDs to ObjectId
            student_obj_id = ObjectId(student_id)
            evidence_obj_id = ObjectId(evidence_id)
            
            # Try to find outcome by ObjectId first
            try:
                outcome_obj_id = ObjectId(learning_outcome_id)
            except:
                # If conversion fails, look up by code (case-insensitive)
                import re
                code_pattern = re.compile(f"^{re.escape(learning_outcome_id)}$", re.IGNORECASE)
                outcome = await db.learning_outcomes.find_one({"code": {"$regex": code_pattern}})
                if not outcome:
                    raise HTTPException(status_code=404, detail="Learning outcome not found")
                outcome_obj_id = outcome["_id"]
            
            # Find the evidence
            evidence = await db.student_evidence.find_one({
                "_id": evidence_obj_id,
                "student_id": student_obj_id,
                "learning_outcome_id": outcome_obj_id
            })
            
            if not evidence:
                raise HTTPException(status_code=404, detail="Evidence not found")
            
            # Get the file URL
            file_url = evidence.get("file_url")
            if not file_url:
                raise HTTPException(status_code=404, detail="File URL not found")
            
            # Generate a download URL with appropriate headers
            from ..services.file_storage_service import file_storage_service
            
            # Remove bucket name from the beginning if it's there
            bucket_name = os.getenv('BACKBLAZE_BUCKET_NAME', 'homeschoollms')
            if file_url.startswith(f"{bucket_name}/"):
                file_url = file_url[len(f"{bucket_name}/"):]
                
            # Generate a presigned URL with download headers
            try:
                # Use a longer expiration for downloads (1 day)
                download_url = file_storage_service.generate_presigned_url(
                    file_url,
                    expiration=86400,  # 24 hours
                    content_disposition=f'attachment; filename="{evidence.get("file_name", "download")}"'
                )
                return download_url
            except Exception as e:
                logger.error(f"Error generating download URL: {str(e)}")
                # Fallback to direct URL if presigned URL generation fails
                backblaze_endpoint = os.getenv('BACKBLAZE_ENDPOINT', 'https://s3.us-east-005.backblazeb2.com')
                return f"{backblaze_endpoint}/{bucket_name}/{file_url}"
        except Exception as e:
            logger.error(f"Error generating download URL: {str(e)}", exc_info=True)
            raise Exception(f"Failed to generate download URL: {str(e)}")
    
    @staticmethod
    async def generate_evidence_share_url(student_id: str, learning_outcome_id: str, evidence_id: str):
        """
        Generate a shareable URL for the evidence file.
        """
        try:
            db = Database.get_db()
            
            # Convert IDs to ObjectId
            student_obj_id = ObjectId(student_id)
            evidence_obj_id = ObjectId(evidence_id)
            
            # Try to find outcome by ObjectId first
            try:
                outcome_obj_id = ObjectId(learning_outcome_id)
            except:
                # If conversion fails, look up by code (case-insensitive)
                import re
                code_pattern = re.compile(f"^{re.escape(learning_outcome_id)}$", re.IGNORECASE)
                outcome = await db.learning_outcomes.find_one({"code": {"$regex": code_pattern}})
                if not outcome:
                    raise HTTPException(status_code=404, detail="Learning outcome not found")
                outcome_obj_id = outcome["_id"]
            
            # Find the evidence
            evidence = await db.student_evidence.find_one({
                "_id": evidence_obj_id,
                "student_id": student_obj_id,
                "learning_outcome_id": outcome_obj_id
            })
            
            if not evidence:
                raise HTTPException(status_code=404, detail="Evidence not found")
            
            # Get the file URL
            file_url = evidence.get("file_url")
            if not file_url:
                raise HTTPException(status_code=404, detail="File URL not found")
            
            # Generate a shareable URL with appropriate headers
            from ..services.file_storage_service import file_storage_service
            
            # Remove bucket name from the beginning if it's there
            bucket_name = os.getenv('BACKBLAZE_BUCKET_NAME', 'homeschoollms')
            if file_url.startswith(f"{bucket_name}/"):
                file_url = file_url[len(f"{bucket_name}/"):]
                
            # Generate a presigned URL with inline display headers
            try:
                # Use a longer expiration for shares (7 days)
                share_url = file_storage_service.generate_presigned_url(
                    file_url,
                    expiration=604800,  # 7 days
                    content_disposition='inline'
                )
                return share_url
            except Exception as e:
                logger.error(f"Error generating share URL: {str(e)}")
                # Fallback to direct URL if presigned URL generation fails
                backblaze_endpoint = os.getenv('BACKBLAZE_ENDPOINT', 'https://s3.us-east-005.backblazeb2.com')
                return f"{backblaze_endpoint}/{bucket_name}/{file_url}"
        except Exception as e:
            logger.error(f"Error generating share URL: {str(e)}", exc_info=True)
            raise Exception(f"Failed to generate share URL: {str(e)}")
