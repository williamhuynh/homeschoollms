from ..utils.database_utils import Database
from ..models.schemas.student import Student, StudentSubject
from fastapi import HTTPException
from bson import ObjectId
from typing import List, Dict, Any
from datetime import datetime, date
import re

class StudentService:
    @staticmethod
    def generate_slug(first_name: str, last_name: str) -> str:
        """Generate a URL-friendly slug from a student's name."""
        # Combine first and last name, convert to lowercase
        name = f"{first_name}-{last_name}".lower()
        # Replace spaces with hyphens and remove special characters
        slug = re.sub(r'[^a-z0-9-]', '', name.replace(' ', '-'))
        # Remove consecutive hyphens
        slug = re.sub(r'-+', '-', slug)
        return slug
    
    @staticmethod
    async def ensure_unique_slug(db, slug: str, student_id=None) -> str:
        """Ensure the slug is unique by adding a suffix if necessary."""
        # Check if slug already exists for a different student
        query = {"slug": slug}
        if student_id:
            query["_id"] = {"$ne": ObjectId(student_id)}
            
        existing = await db.students.find_one(query)
        
        if not existing:
            return slug
        
        # If slug exists, add a numeric suffix
        counter = 1
        while True:
            new_slug = f"{slug}-{counter}"
            query = {"slug": new_slug}
            if student_id:
                query["_id"] = {"$ne": ObjectId(student_id)}
                
            existing = await db.students.find_one(query)
            if not existing:
                return new_slug
            counter += 1
    
    @staticmethod
    async def create_student(student: Student, parent_id: str):
        db = Database.get_db()
        student_dict = student.dict()
        student_dict["parent_ids"] = [ObjectId(parent_id)]
        
        # Generate a slug from the student's name
        if not student_dict.get("slug"):
            slug = StudentService.generate_slug(student.first_name, student.last_name)
            student_dict["slug"] = await StudentService.ensure_unique_slug(db, slug)
        
        # Convert date_of_birth to ISO format string for MongoDB
        if isinstance(student_dict["date_of_birth"], date):
            student_dict["date_of_birth"] = student_dict["date_of_birth"].isoformat()
        
        result = await db.students.insert_one(student_dict)
        created_student = await db.students.find_one({"_id": result.inserted_id})
        return Student(**created_student)
    
    @staticmethod
    async def get_all_students() -> List[Student]:
        db = Database.get_db()
        students = []
        async for student in db.students.find():
            students.append(Student(**student))
        return students

    @staticmethod
    async def get_student_by_id(student_id: str):
        db = Database.get_db()
        student = await db.students.find_one({"_id": ObjectId(student_id)})
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        return Student(**student)
    
    @staticmethod
    async def get_student_by_slug(slug: str):
        db = Database.get_db()
        student = await db.students.find_one({"slug": slug})
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        return Student(**student)
    
    @staticmethod
    async def update_missing_slugs():
        """Update all students that don't have slugs yet."""
        db = Database.get_db()
        students_without_slug = []
        
        async for student in db.students.find({"slug": {"$exists": False}}):
            students_without_slug.append(Student(**student))
        
        for student in students_without_slug:
            slug = StudentService.generate_slug(student.first_name, student.last_name)
            unique_slug = await StudentService.ensure_unique_slug(db, slug, str(student.id))
            
            await db.students.update_one(
                {"_id": student.id},
                {"$set": {"slug": unique_slug}}
            )

    @staticmethod
    async def enroll_in_subject(student_id: str, subject_id: str, grade_level: str):
        db = Database.get_db()
        student = await StudentService.get_student_by_id(student_id)
        
        subject = StudentSubject(
            subject_id=ObjectId(subject_id),
            current_grade_level=grade_level,
            start_date=datetime.now().date()
        )
        
        # Convert the subject dict and handle the date
        subject_dict = subject.dict()
        if isinstance(subject_dict["start_date"], date):
            subject_dict["start_date"] = subject_dict["start_date"].isoformat()
        
        update_result = await db.students.update_one(
            {"_id": ObjectId(student_id)},
            {
                "$set": {f"subjects.{subject_id}": subject_dict},
                "$addToSet": {"active_subjects": ObjectId(subject_id)}
            }
        )
        
        if update_result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Failed to enroll in subject")
        
        return await StudentService.get_student_by_id(student_id)
        
    @staticmethod
    async def delete_student(student_id: str) -> Dict[str, Any]:
        """Delete a student by ID."""
        db = Database.get_db()
        
        # First check if the student exists
        student = await StudentService.get_student_by_id(student_id)

        # Delete the student
        result = await db.students.delete_one({"_id": ObjectId(student.id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Student not found or could not be deleted")

        return {"success": True, "message": f"Student {student.first_name} {student.last_name} deleted successfully"}
