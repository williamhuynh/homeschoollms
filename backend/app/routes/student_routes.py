from fastapi import APIRouter, Depends, HTTPException
from ..services.student_service import StudentService
from ..models.schemas.student import Student
from ..utils.auth import get_current_user
from typing import List

router = APIRouter()

@router.post("/students/", response_model=Student)
async def create_student(
    student: Student,
    current_user: UserInDB = Depends(get_current_user)
):
    return await StudentService.create_student(student, str(current_user.id))

@router.get("/students/{student_id}", response_model=Student)
async def get_student(
    student_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    return await StudentService.get_student_by_id(student_id)

@router.post("/students/{student_id}/subjects/{subject_id}")
async def enroll_student_in_subject(
    student_id: str,
    subject_id: str,
    grade_level: str,
    current_user: UserInDB = Depends(get_current_user)
):
    return await StudentService.enroll_in_subject(student_id, subject_id, grade_level)