from fastapi import APIRouter, Depends, HTTPException, Response
from ..services.student_service import StudentService
from ..models.schemas.student import Student, AccessLevel
from ..models.schemas.user import UserInDB
from ..utils.auth_utils import get_current_user
from typing import List, Dict, Any
from pydantic import BaseModel, EmailStr

router = APIRouter()

# Parent access models
class ParentAccessAdd(BaseModel):
    email: EmailStr
    access_level: AccessLevel

class ParentAccessUpdate(BaseModel):
    access_level: AccessLevel

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

@router.delete("/students/{student_id}", response_model=Dict[str, Any])
async def delete_student(
    student_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """Delete a student by ID."""
    return await StudentService.delete_student(student_id)

# Parent access endpoints
@router.get("/students/{student_id}/parents", response_model=List[Dict[str, Any]])
async def get_student_parents(
    student_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """Get all parents with access to a student."""
    return await StudentService.get_student_parents(student_id)

@router.post("/students/{student_id}/parents", response_model=Dict[str, Any])
async def add_parent_access(
    student_id: str,
    parent_access: ParentAccessAdd,
    current_user: UserInDB = Depends(get_current_user)
):
    """Add a parent to a student with a specific access level."""
    return await StudentService.add_parent_access(
        student_id, 
        parent_access.email, 
        parent_access.access_level, 
        str(current_user.id)
    )

@router.put("/students/{student_id}/parents/{parent_id}", response_model=Dict[str, Any])
async def update_parent_access(
    student_id: str,
    parent_id: str,
    parent_access: ParentAccessUpdate,
    current_user: UserInDB = Depends(get_current_user)
):
    """Update a parent's access level."""
    return await StudentService.update_parent_access(
        student_id, 
        parent_id, 
        parent_access.access_level, 
        str(current_user.id)
    )

@router.delete("/students/{student_id}/parents/{parent_id}", response_model=Dict[str, Any])
async def remove_parent_access(
    student_id: str,
    parent_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """Remove a parent's access to a student."""
    return await StudentService.remove_parent_access(
        student_id, 
        parent_id, 
        str(current_user.id)
    )
