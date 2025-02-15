from ..utils.database_utils import Database
from ..models.schemas.content import ContentBase
from fastapi import HTTPException
from bson import ObjectId
from typing import List

class ContentService:
    @staticmethod
    async def create_content(content: ContentBase, creator_id: str):
        db = Database.get_db()
        content_dict = content.dict()
        content_dict["created_by"] = ObjectId(creator_id)
        
        result = await db.content.insert_one(content_dict)
        created_content = await db.content.find_one({"_id": result.inserted_id})
        return ContentBase(**created_content)

    @staticmethod
    async def get_subject_content(subject_id: str, grade_level: str = None):
        db = Database.get_db()
        query = {"subject_id": ObjectId(subject_id)}
        if grade_level:
            query["grade_level"] = grade_level
            
        content = await db.content.find(query).to_list(None)
        return [ContentBase(**item) for item in content]

    @staticmethod
    async def get_content_by_outcomes(outcome_ids: List[str]):
        db = Database.get_db()
        outcome_ids = [ObjectId(id) for id in outcome_ids]
        content = await db.content.find(
            {"learning_outcome_ids": {"$in": outcome_ids}}
        ).to_list(None)
        return [ContentBase(**item) for item in content]