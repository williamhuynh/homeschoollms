from ..utils.database_utils import Database
from ..models.schemas.subject import Subject
from fastapi import HTTPException
from bson import ObjectId
from typing import List, Optional

class SubjectService:
    @staticmethod
    async def create_subject(subject: Subject, organization_id: Optional[str] = None):
        db = Database.get_db()
        
        # Check if subject code already exists for the organization
        existing = await db.subjects.find_one({
            "code": subject.code,
            "organization_id": ObjectId(organization_id) if organization_id else None
        })
        if existing:
            raise HTTPException(status_code=400, detail="Subject code already exists")
            
        subject_dict = subject.dict()
        if organization_id:
            subject_dict["organization_id"] = ObjectId(organization_id)
            
        result = await db.subjects.insert_one(subject_dict)
        created_subject = await db.subjects.find_one({"_id": result.inserted_id})
        return Subject(**created_subject)

    @staticmethod
    async def get_subjects(organization_id: Optional[str] = None, grade_level: Optional[str] = None):
        db = Database.get_db()
        query = {}
        
        if organization_id:
            query["$or"] = [
                {"organization_id": ObjectId(organization_id)},
                {"is_standard": True}
            ]
        else:
            query["is_standard"] = True
            
        if grade_level:
            query["grade_levels"] = grade_level
            
        subjects = await db.subjects.find(query).to_list(None)
        return [Subject(**subject) for subject in subjects]

    @staticmethod
    async def update_subject(subject_id: str, updates: dict):
        db = Database.get_db()
        subject = await db.subjects.find_one({"_id": ObjectId(subject_id)})
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
            
        result = await db.subjects.update_one(
            {"_id": ObjectId(subject_id)},
            {"$set": updates}
        )
        
        updated_subject = await db.subjects.find_one({"_id": ObjectId(subject_id)})
        return Subject(**updated_subject)

    @staticmethod
    async def get_subject_hierarchy(subject_id: str):
        db = Database.get_db()
        subject = await db.subjects.find_one({"_id": ObjectId(subject_id)})
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
            
        hierarchy = []
        current = subject
        
        while current.get("parent_subject_id"):
            parent = await db.subjects.find_one({"_id": current["parent_subject_id"]})
            if parent:
                hierarchy.append(Subject(**parent))
                current = parent
            else:
                break
                
        return hierarchy