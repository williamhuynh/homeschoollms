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
            
                # Handle file paths for Cloudinary or Backblaze
                if "file_path" in serialized_item:
                    file_path = serialized_item["file_path"]
                    
                    # Try to generate fresh presigned URLs for better security
                    try:
                        from ..services.file_storage_service import file_storage_service
                        
                        # Generate main image URL
                        image_url = file_storage_service.generate_presigned_url(file_path)
                        serialized_item["fileUrl"] = image_url
                        
                        # Generate thumbnail URL
                        thumbnail_url = file_storage_service.generate_presigned_url(
                            file_path, 
                            width=150, 
                            height=150, 
                            quality=80
                        )
                        serialized_item["thumbnailUrl"] = thumbnail_url
                        
                        logger.info(f"Successfully generated presigned URLs for evidence {serialized_item.get('_id', 'unknown')}")
                        
                    except Exception as e:
                        logger.error(f"Error generating presigned URLs for file_path '{file_path}': {str(e)}")
                        logger.info("Falling back to stored URLs from database")
                        
                        # Fallback to stored URLs (like batch method does)
                        if "file_url" in serialized_item:
                            serialized_item["fileUrl"] = serialized_item["file_url"]
                            logger.info(f"Using stored file_url: {serialized_item['file_url']}")
                        
                        if "thumbnail_url" in serialized_item:
                            serialized_item["thumbnailUrl"] = serialized_item["thumbnail_url"]
                            logger.info(f"Using stored thumbnail_url: {serialized_item['thumbnail_url']}")
                        else:
                            # Generate thumbnail URL from main URL if available
                            if "file_url" in serialized_item:
                                base_url = serialized_item["file_url"]
                                if "?" in base_url:
                                    serialized_item["thumbnailUrl"] = f"{base_url}&width=150&height=150&quality=80"
                                else:
                                    serialized_item["thumbnailUrl"] = f"{base_url}?width=150&height=150&quality=80"
                
                # Ensure we have URLs even without file_path (backward compatibility)
                if "fileUrl" not in serialized_item and "file_url" in serialized_item:
                    serialized_item["fileUrl"] = serialized_item["file_url"]
                
                if "thumbnailUrl" not in serialized_item and "thumbnail_url" in serialized_item:
                    serialized_item["thumbnailUrl"] = serialized_item["thumbnail_url"]
            
            # Ensure learning_area_code is present if it exists in the document
            if 'learning_area_code' in item:
                serialized_item['learning_area_code'] = item['learning_area_code']
            
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
                logger.info(f"Successfully converted learning_outcome_id to ObjectId: {outcome_obj_id}")
            except:
                outcome_obj_id = None
                logger.info(f"learning_outcome_id is not a valid ObjectId, using as string: {learning_outcome_id}")
                
            # If not found by ObjectId, try to find by code (case-insensitive)
            outcome_code = learning_outcome_id
            if not outcome_obj_id:
                logger.info(f"Looking up learning outcome by code: {learning_outcome_id}")
                logger.info(f"Database name: {db.name}")
                logger.info(f"Collection stats: {await db.learning_outcomes.count_documents({})}")
                
                import re
                code_pattern = re.compile(f"^{re.escape(learning_outcome_id)}$", re.IGNORECASE)
                outcome = await db.learning_outcomes.find_one({"code": {"$regex": code_pattern}})
                if outcome:
                    outcome_obj_id = outcome["_id"]
                    logger.info(f"Found learning outcome with ID: {outcome_obj_id}")
                else:
                    logger.info(f"No learning outcome found with code: {learning_outcome_id}")
            
            # Build a query that will match evidence regardless of how it was stored
            query = {
                "student_id": student_obj_id,
                "$or": [
                    {"deleted": {"$exists": False}},
                    {"deleted": False}
                ]
            }
            
            # Add conditions to match either by ObjectId or by code string
            id_conditions = []
            if outcome_obj_id:
                id_conditions.append({"learning_outcome_id": outcome_obj_id})
            id_conditions.append({"learning_outcome_id": outcome_code})
            id_conditions.append({"learning_outcome_code": outcome_code})
            
            query["$or"] = id_conditions
            
            logger.info(f"Querying evidence with: {query}")
            evidence = await db.student_evidence.find(query).to_list(None)
            
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
                
                # Ensure learning_area_code is present if it exists in the document
                if 'learning_area_code' in item:
                    serialized_item['learning_area_code'] = item['learning_area_code']
                
                # Handle file paths for Cloudinary or Backblaze
                if "file_path" in serialized_item:
                    file_path = serialized_item["file_path"]
                    
                    # Try to generate fresh presigned URLs for better security
                    try:
                        from ..services.file_storage_service import file_storage_service
                        
                        # Generate main image URL
                        image_url = file_storage_service.generate_presigned_url(file_path)
                        serialized_item["fileUrl"] = image_url
                        
                        # Generate thumbnail URL
                        thumbnail_url = file_storage_service.generate_presigned_url(
                            file_path, 
                            width=150, 
                            height=150, 
                            quality=80
                        )
                        serialized_item["thumbnailUrl"] = thumbnail_url
                        
                        logger.info(f"Successfully generated presigned URLs for evidence {serialized_item.get('_id', 'unknown')}")
                        
                    except Exception as e:
                        logger.error(f"Error generating presigned URLs for file_path '{file_path}': {str(e)}")
                        logger.info("Falling back to stored URLs from database")
                        
                        # Fallback to stored URLs (like batch method does)
                        if "file_url" in serialized_item:
                            serialized_item["fileUrl"] = serialized_item["file_url"]
                            logger.info(f"Using stored file_url: {serialized_item['file_url']}")
                        
                        if "thumbnail_url" in serialized_item:
                            serialized_item["thumbnailUrl"] = serialized_item["thumbnail_url"]
                            logger.info(f"Using stored thumbnail_url: {serialized_item['thumbnail_url']}")
                        else:
                            # Generate thumbnail URL from main URL if available
                            if "file_url" in serialized_item:
                                base_url = serialized_item["file_url"]
                                if "?" in base_url:
                                    serialized_item["thumbnailUrl"] = f"{base_url}&width=150&height=150&quality=80"
                                else:
                                    serialized_item["thumbnailUrl"] = f"{base_url}?width=150&height=150&quality=80"
                
                # Ensure we have URLs even without file_path (backward compatibility)
                if "fileUrl" not in serialized_item and "file_url" in serialized_item:
                    serialized_item["fileUrl"] = serialized_item["file_url"]
                
                if "thumbnailUrl" not in serialized_item and "thumbnail_url" in serialized_item:
                    serialized_item["thumbnailUrl"] = serialized_item["thumbnail_url"]
                
                serializable_evidence.append(serialized_item)
            
            return serializable_evidence or []
        except Exception as e:
            logger.error(f"Error in get_evidence: {str(e)}", exc_info=True)
            raise Exception(f"Failed to fetch evidence: {str(e)}")
            
    @staticmethod
    async def get_batch_evidence(student_id: str, learning_outcome_codes: list):
        """
        Retrieve the latest evidence for multiple learning outcomes at once.
        Returns a map of outcome_code -> latest evidence item.
        """
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            # Validate student_id
            db = Database.get_db()
            
            try:
                student_obj_id = ObjectId(student_id)
            except:
                # If conversion fails, try to find student by slug
                student = await db.students.find_one({"slug": student_id})
                if student:
                    student_obj_id = student["_id"]
                else:
                    logger.error(f"Invalid student ID or slug: {student_id}")
                    return {}
            
            logger.info(f"Fetching batch evidence for student {student_obj_id} and {len(learning_outcome_codes)} outcomes")
            
            # Convert all outcome codes to a list of possible ObjectIds and string codes
            outcome_conditions = []
            for outcome_code in learning_outcome_codes:
                try:
                    # Try to convert to ObjectId if it's a valid ObjectId
                    outcome_obj_id = ObjectId(outcome_code)
                    outcome_conditions.append({"learning_outcome_id": outcome_obj_id})
                    outcome_conditions.append({"outcome_obj_id": outcome_obj_id})
                except:
                    # Otherwise, use it as a string code
                    pass
                
                # Always add the string code conditions
                outcome_conditions.append({"learning_outcome_id": outcome_code})
                outcome_conditions.append({"learning_outcome_code": outcome_code})
            
            # Build query to find all evidence for this student and the requested outcomes
            query = {
                "student_id": student_obj_id,
                "$or": outcome_conditions,
                "$and": [
                    {
                        "$or": [
                            {"deleted": {"$exists": False}},
                            {"deleted": False}
                        ]
                    }
                ]
            }
            
            logger.info(f"Querying evidence with: {query}")
            
            # Fetch all evidence for the specified outcomes
            evidence_items = await db.student_evidence.find(query).to_list(None)
            
            logger.info(f"Found {len(evidence_items)} total evidence records")
            
            # Group by outcome code and find the latest for each
            outcome_to_evidence = {}
            for evidence in evidence_items:
                # Get the outcome code (prefer learning_outcome_code if available)
                outcome_code = evidence.get("learning_outcome_code", evidence.get("learning_outcome_id"))
                
                # Skip if we can't determine the outcome code
                if not outcome_code:
                    continue
                
                # Convert ObjectId to string if needed
                if isinstance(outcome_code, ObjectId):
                    outcome_code = str(outcome_code)
                
                # Skip if this outcome wasn't in our request list
                if outcome_code not in learning_outcome_codes:
                    continue
                
                # Convert to serializable format
                serialized_item = {}
                for k, v in evidence.items():
                    if isinstance(v, ObjectId):
                        serialized_item[k] = str(v)
                    elif isinstance(v, datetime):
                        serialized_item[k] = v.isoformat()
                    else:
                        serialized_item[k] = v
                
                # Normalize field names
                if "file_url" in serialized_item and "fileUrl" not in serialized_item:
                    serialized_item["fileUrl"] = serialized_item["file_url"]
                
                if "thumbnail_url" in serialized_item and "thumbnailUrl" not in serialized_item:
                    serialized_item["thumbnailUrl"] = serialized_item["thumbnail_url"]
                
                # Determine if this is the latest evidence for this outcome
                current_timestamp = serialized_item.get("uploaded_at")
                if not current_timestamp:
                    continue
                
                # If we don't have an item for this outcome yet, or this one is newer
                if (outcome_code not in outcome_to_evidence or 
                    current_timestamp > outcome_to_evidence[outcome_code].get("uploaded_at", "")):
                    outcome_to_evidence[outcome_code] = serialized_item
            
            return outcome_to_evidence
        except Exception as e:
            logger.error(f"Error in get_batch_evidence: {str(e)}", exc_info=True)
            return {}
    
    @staticmethod
    async def mark_evidence_as_deleted(student_id: str, learning_outcome_id: str, evidence_id: str):
        """
        Mark evidence as deleted without removing it from storage.
        """
        try:
            db = Database.get_db()
            logger = logging.getLogger(__name__)
            
            # Convert IDs to ObjectId
            student_obj_id = ObjectId(student_id)
            evidence_obj_id = ObjectId(evidence_id)
            
            logger.info(f"Marking evidence as deleted: student_id={student_id}, learning_outcome_id={learning_outcome_id}, evidence_id={evidence_id}")
            
            # Try to find outcome by ObjectId first
            outcome_obj_id = None
            try:
                outcome_obj_id = ObjectId(learning_outcome_id)
                logger.info(f"Successfully converted learning_outcome_id to ObjectId: {outcome_obj_id}")
            except:
                outcome_obj_id = None
                logger.info(f"learning_outcome_id is not a valid ObjectId, using as string: {learning_outcome_id}")
                
                # If conversion fails, look up by code (case-insensitive)
                import re
                code_pattern = re.compile(f"^{re.escape(learning_outcome_id)}$", re.IGNORECASE)
                outcome = await db.learning_outcomes.find_one({"code": {"$regex": code_pattern}})
                if outcome:
                    outcome_obj_id = outcome["_id"]
                    logger.info(f"Found learning outcome with ID: {outcome_obj_id}")
                else:
                    logger.info(f"No learning outcome found with code: {learning_outcome_id}")
            
            # Build a query that will match evidence regardless of how it was stored
            query = {
                "_id": evidence_obj_id,
                "student_id": student_obj_id,
            }
            
            # Add conditions to match either by ObjectId or by code string
            id_conditions = []
            if outcome_obj_id:
                id_conditions.append({"learning_outcome_id": outcome_obj_id})
                id_conditions.append({"outcome_obj_id": outcome_obj_id})
            id_conditions.append({"learning_outcome_id": learning_outcome_id})
            id_conditions.append({"learning_outcome_code": learning_outcome_id})
            
            if id_conditions:
                query["$or"] = id_conditions
                
            logger.info(f"Querying evidence with: {query}")
            
            # Find the evidence
            evidence = await db.student_evidence.find_one(query)
            
            if not evidence:
                logger.error(f"Evidence not found: ID={evidence_id}, student={student_id}, outcome={learning_outcome_id}")
                raise HTTPException(status_code=404, detail="Evidence not found")
            
            # Mark as deleted
            result = await db.student_evidence.update_one(
                {"_id": evidence_obj_id},
                {"$set": {"deleted": True, "deleted_at": datetime.now()}}
            )
            
            if result.modified_count == 0:
                logger.error(f"Failed to mark evidence {evidence_id} as deleted")
                raise HTTPException(status_code=500, detail="Failed to mark evidence as deleted")
                
            logger.info(f"Successfully marked evidence {evidence_id} as deleted")
            return {"success": True}
        except HTTPException as he:
            logger.error(f"HTTP error marking evidence as deleted: {str(he)}")
            raise he
        except Exception as e:
            logger.error(f"Error marking evidence as deleted: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to mark evidence as deleted: {str(e)}")
    
    @staticmethod
    async def generate_evidence_download_url(student_id: str, learning_outcome_id: str, evidence_id: str):
        """
        Generate a download URL for the evidence file.
        """
        try:
            db = Database.get_db()
            logger = logging.getLogger(__name__)
            
            # Convert IDs to ObjectId
            student_obj_id = ObjectId(student_id)
            evidence_obj_id = ObjectId(evidence_id)
            
            logger.info(f"Generating download URL: student_id={student_id}, learning_outcome_id={learning_outcome_id}, evidence_id={evidence_id}")
            
            # Try to find outcome by ObjectId first
            outcome_obj_id = None
            try:
                outcome_obj_id = ObjectId(learning_outcome_id)
                logger.info(f"Successfully converted learning_outcome_id to ObjectId: {outcome_obj_id}")
            except:
                outcome_obj_id = None
                logger.info(f"learning_outcome_id is not a valid ObjectId, using as string: {learning_outcome_id}")
                
                # If conversion fails, look up by code (case-insensitive)
                import re
                code_pattern = re.compile(f"^{re.escape(learning_outcome_id)}$", re.IGNORECASE)
                outcome = await db.learning_outcomes.find_one({"code": {"$regex": code_pattern}})
                if outcome:
                    outcome_obj_id = outcome["_id"]
                    logger.info(f"Found learning outcome with ID: {outcome_obj_id}")
                else:
                    logger.info(f"No learning outcome found with code: {learning_outcome_id}")
            
            # Build a query that will match evidence regardless of how it was stored
            query = {
                "_id": evidence_obj_id,
                "student_id": student_obj_id,
            }
            
            # Add conditions to match either by ObjectId or by code string
            id_conditions = []
            if outcome_obj_id:
                id_conditions.append({"learning_outcome_id": outcome_obj_id})
                id_conditions.append({"outcome_obj_id": outcome_obj_id})
            id_conditions.append({"learning_outcome_id": learning_outcome_id})
            id_conditions.append({"learning_outcome_code": learning_outcome_id})
            
            if id_conditions:
                query["$or"] = id_conditions
                
            logger.info(f"Querying evidence with: {query}")
            
            # Find the evidence
            evidence = await db.student_evidence.find_one(query)
            
            if not evidence:
                logger.error(f"Evidence not found: ID={evidence_id}, student={student_id}, outcome={learning_outcome_id}")
                raise HTTPException(status_code=404, detail="Evidence not found")
            
            # Get the file path (canonical Backblaze path)
            file_path = evidence.get("file_path")
            if not file_path:
                logger.error(f"File path not found for evidence: {evidence_id}")
                raise HTTPException(status_code=404, detail="File path not found for evidence")
            
            # Generate a download URL with appropriate headers
            from ..services.file_storage_service import file_storage_service
            
            # Remove bucket name from the beginning if it's there
            bucket_name = os.getenv('BACKBLAZE_BUCKET_NAME', 'homeschoollms')
            if file_path.startswith(f"{bucket_name}/"):
                file_path = file_path[len(f"{bucket_name}/"):]
            
            # Generate a presigned URL with download headers
            try:
                # Use a longer expiration for downloads (1 day)
                download_url = file_storage_service.generate_presigned_url(
                    file_path,
                    expiration=86400,  # 24 hours
                    content_disposition=f'attachment; filename="{evidence.get("file_name", "download")}"'
                )
                logger.info(f"Generated download URL for evidence: {evidence_id}")
                return download_url
            except Exception as e:
                logger.error(f"Error generating download URL: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Failed to generate download URL: {str(e)}")
        except HTTPException as he:
            logger.error(f"HTTP error generating download URL: {str(he)}")
            raise he
        except Exception as e:
            logger.error(f"Error generating download URL: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to generate download URL: {str(e)}")
    
    @staticmethod
    async def generate_evidence_share_url(student_id: str, learning_outcome_id: str, evidence_id: str):
        """
        Generate a shareable URL for the evidence file.
        """
        try:
            db = Database.get_db()
            logger = logging.getLogger(__name__)
            
            # Convert IDs to ObjectId
            student_obj_id = ObjectId(student_id)
            evidence_obj_id = ObjectId(evidence_id)
            
            logger.info(f"Generating share URL: student_id={student_id}, learning_outcome_id={learning_outcome_id}, evidence_id={evidence_id}")
            
            # Try to find outcome by ObjectId first
            outcome_obj_id = None
            try:
                outcome_obj_id = ObjectId(learning_outcome_id)
                logger.info(f"Successfully converted learning_outcome_id to ObjectId: {outcome_obj_id}")
            except:
                outcome_obj_id = None
                logger.info(f"learning_outcome_id is not a valid ObjectId, using as string: {learning_outcome_id}")
                
                # If conversion fails, look up by code (case-insensitive)
                import re
                code_pattern = re.compile(f"^{re.escape(learning_outcome_id)}$", re.IGNORECASE)
                outcome = await db.learning_outcomes.find_one({"code": {"$regex": code_pattern}})
                if outcome:
                    outcome_obj_id = outcome["_id"]
                    logger.info(f"Found learning outcome with ID: {outcome_obj_id}")
                else:
                    logger.info(f"No learning outcome found with code: {learning_outcome_id}")
            
            # Build a query that will match evidence regardless of how it was stored
            query = {
                "_id": evidence_obj_id,
                "student_id": student_obj_id,
            }
            
            # Add conditions to match either by ObjectId or by code string
            id_conditions = []
            if outcome_obj_id:
                id_conditions.append({"learning_outcome_id": outcome_obj_id})
                id_conditions.append({"outcome_obj_id": outcome_obj_id})
            id_conditions.append({"learning_outcome_id": learning_outcome_id})
            id_conditions.append({"learning_outcome_code": learning_outcome_id})
            
            if id_conditions:
                query["$or"] = id_conditions
                
            logger.info(f"Querying evidence with: {query}")
            
            # Find the evidence
            evidence = await db.student_evidence.find_one(query)
            
            if not evidence:
                logger.error(f"Evidence not found: ID={evidence_id}, student={student_id}, outcome={learning_outcome_id}")
                raise HTTPException(status_code=404, detail="Evidence not found")
            
            # Get the file URL
            file_url = evidence.get("file_url")
            if not file_url:
                logger.error(f"File URL not found for evidence: {evidence_id}")
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
                logger.info(f"Generated share URL for evidence: {evidence_id}")
                return share_url
            except Exception as e:
                logger.error(f"Error generating share URL: {str(e)}")
                # Fallback to direct URL if presigned URL generation fails
                backblaze_endpoint = os.getenv('BACKBLAZE_ENDPOINT', 'https://s3.us-east-005.backblazeb2.com')
                return f"{backblaze_endpoint}/{bucket_name}/{file_url}"
        except HTTPException as he:
            logger.error(f"HTTP error generating share URL: {str(he)}")
            raise he
        except Exception as e:
            logger.error(f"Error generating share URL: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to generate share URL: {str(e)}")

    @staticmethod
    async def update_evidence(student_id: str, learning_outcome_id: str, evidence_id: str, update_data: dict):
        db = Database.get_db()
        from bson import ObjectId

        # If learning_outcome_code is being updated, look up the new outcome
        if 'learning_outcome_code' in update_data:
            new_code = update_data['learning_outcome_code']
            import re
            code_pattern = re.compile(f"^{re.escape(new_code)}$", re.IGNORECASE)
            outcome = await db.learning_outcomes.find_one({"code": {"$regex": code_pattern}})
            if not outcome:
                raise HTTPException(status_code=400, detail="Learning outcome code not found")
            update_data['learning_outcome_id'] = new_code  # Keep both fields in sync
            update_data['outcome_obj_id'] = outcome['_id']

        # Build the query to match the evidence
        query = {
            "_id": ObjectId(evidence_id),
            "student_id": ObjectId(student_id),
            "learning_outcome_id": learning_outcome_id
        }
        # Only update provided fields
        result = await db.student_evidence.update_one(query, {"$set": update_data})
        if result.modified_count == 0:
            return None
        updated = await db.student_evidence.find_one({"_id": ObjectId(evidence_id)})
        if updated:
            updated["id"] = str(updated["_id"])
        return serialize_mongo_document(updated)

def serialize_mongo_document(obj):
    """
    Recursively convert ObjectId fields in a dict, list, or primitive to strings for JSON serialization.
    """
    if isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, dict):
        return {k: serialize_mongo_document(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [serialize_mongo_document(item) for item in obj]
    else:
        return obj
