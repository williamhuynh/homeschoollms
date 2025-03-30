from ..utils.database_utils import Database
from ..models.schemas.student import Student, StudentSubject
from fastapi import HTTPException
from bson import ObjectId
from typing import List
from datetime import datetime, date

class StudentService:
    @staticmethod
    async def create_student(student: Student, parent_id: str):
        db = Database.get_db()
        student_dict = student.dict()
        student_dict["parent_ids"] = [ObjectId(parent_id)]
        
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
