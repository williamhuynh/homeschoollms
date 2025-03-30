from fastapi import APIRouter, Depends, HTTPException, Response
from ..services.student_service import StudentService
from ..models.schemas.student import Student
from ..models.schemas.user import UserInDB
from ..utils.auth_utils import get_current_user
from typing import List

router = APIRouter()

@router.post("/students/update-slugs")
async def update_student_slugs(
    current_user: UserInDB = Depends(get_current_user)
):
    """Update all students that don't have slugs yet."""
    await StudentService.update_missing_slugs()
    return {"message": "Student slugs updated successfully"}

@router.post("/students/", response_model=Student)
async def create_student(
    student: Student,
    current_user: UserInDB = Depends(get_current_user)
):
    return await StudentService.create_student(student, str(current_user.id))

@router.get("/students", response_model=List[Student])
async def get_students(
    current_user: UserInDB = Depends(get_current_user)
):
    return await StudentService.get_all_students()

@router.get("/students/", response_model=List[Student])
async def get_students_with_slash(
    current_user: UserInDB = Depends(get_current_user)
):
    """Duplicate endpoint to handle requests with trailing slash"""
    return await StudentService.get_all_students()

@router.get("/students/by-slug/{slug}", response_model=Student)
async def get_student_by_slug(
    slug: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """Explicit endpoint to get a student by slug."""
    return await StudentService.get_student_by_slug(slug)

@router.get("/students/{student_id}", response_model=Student)
async def get_student(
    student_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    try:
        # First try to interpret as ObjectId
        return await StudentService.get_student_by_id(student_id)
    except (HTTPException, ValueError):
        # If that fails, try as a slug
        return await StudentService.get_student_by_slug(student_id)

@router.post("/students/{student_id}/subjects/{subject_id}")
async def enroll_student_in_subject(
    student_id: str,
    subject_id: str,
    grade_level: str,
    current_user: UserInDB = Depends(get_current_user)
):
    return await StudentService.enroll_in_subject(student_id, subject_id, grade_level)
