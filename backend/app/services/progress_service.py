from ..utils.database_utils import Database
from ..models.schemas.progress import Progress
from fastapi import HTTPException
from bson import ObjectId
from datetime import datetime
from typing import List

class ProgressService:
    @staticmethod
    async def update_progress(student_id: str, content_id: str, status: str, score: float = None):
        db = Database.get_db()
        progress_data = {
            "student_id": ObjectId(student_id),
            "content_id": ObjectId(content_id),
            "status": status,
            "score": score,
            "last_updated": datetime.utcnow()
        }
        
        if status == "completed":
            progress_data["completion_date"] = datetime.utcnow()
        
        result = await db.progress.update_one(
            {
                "student_id": ObjectId(student_id),
                "content_id": ObjectId(content_id)
            },
            {"$set": progress_data},
            upsert=True
        )
        
        updated_progress = await db.progress.find_one({
            "student_id": ObjectId(student_id),
            "content_id": ObjectId(content_id)
        })
        return Progress(**updated_progress)

    @staticmethod
    async def get_student_progress(student_id: str, subject_id: str = None):
        db = Database.get_db()
        query = {"student_id": ObjectId(student_id)}
        if subject_id:
            # Join with content collection to filter by subject
            pipeline = [
                {"$match": query},
                {"$lookup": {
                    "from": "content",
                    "localField": "content_id",
                    "foreignField": "_id",
                    "as": "content"
                }},
                {"$match": {"content.subject_id": ObjectId(subject_id)}}
            ]
            progress = await db.progress.aggregate(pipeline).to_list(None)
        else:
            progress = await db.progress.find(query).to_list(None)
            
        return [Progress(**item) for item in progress]