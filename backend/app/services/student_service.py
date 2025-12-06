from ..utils.database_utils import Database
from ..models.schemas.student import Student, StudentSubject, ParentAccess, AccessLevel
from ..services.user_service import UserService
from fastapi import HTTPException, Depends, UploadFile
from bson import ObjectId
from typing import List, Dict, Any, Optional
from datetime import datetime, date
import re
from ..models.schemas.user import UserInDB
from ..utils.auth_utils import get_current_user
from .file_storage_service import file_storage_service

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
        # Reserve certain slugs that conflict with API paths
        reserved_slugs = {"update-slugs", "for-parent", "actions", "by-slug"}
        if slug in reserved_slugs:
            slug = f"{slug}-student"
        
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
        
        # Add parent to parent_ids for backward compatibility
        student_dict["parent_ids"] = [ObjectId(parent_id)]
        
        # Add parent to parent_access with admin access
        parent_access = ParentAccess(
            parent_id=ObjectId(parent_id),
            access_level=AccessLevel.ADMIN
        )
        student_dict["parent_access"] = [parent_access.dict()]
        
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
    async def get_students_for_parent(user_id: str, access_level: Optional[str] = None) -> List[Student]:
        """
        Get all students associated with a parent, optionally filtered by access level.
        
        Args:
            user_id: The ID of the parent user
            access_level: Optional filter for access level (admin, content, view)
            
        Returns:
            List of Student objects
        """
        db = Database.get_db()
        students = []
        
        # Base query to find students associated with the parent
        query = {"$or": [
            {"parent_ids": ObjectId(user_id)},  # For backward compatibility
            {"parent_access.parent_id": ObjectId(user_id)}  # New structure
        ]}
        
        async for student in db.students.find(query):
            # If no access level filter, include all students
            if access_level is None:
                students.append(Student(**student))
                continue
                
            # Check if parent has the specified access level for this student
            has_access = False
            
            # Check in parent_access array
            for access in student.get("parent_access", []):
                if str(access.get("parent_id")) == user_id and access.get("access_level") == access_level:
                    has_access = True
                    break
            
            # For backward compatibility, if parent is in parent_ids and there's no parent_access entry,
            # consider them as having admin access
            if not has_access and access_level == "admin":
                if ObjectId(user_id) in student.get("parent_ids", []) and not student.get("parent_access"):
                    has_access = True
            
            if has_access:
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
    async def get_all_students() -> List[Student]:
        db = Database.get_db()
        students: List[Student] = []
        async for s in db.students.find({}):
            students.append(Student(**s))
        return students
    
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
        
        # Validate the student_id format
        if not ObjectId.is_valid(student_id):
            raise HTTPException(
                status_code=400,
                detail="Invalid student ID format. Must be a valid MongoDB ObjectId"
            )
        
        try:
            # First check if the student exists
            student = await StudentService.get_student_by_id(student_id)

            # Delete the student
            result = await db.students.delete_one({"_id": ObjectId(student_id)})
            
            if result.deleted_count == 0:
                raise HTTPException(status_code=404, detail="Student not found or could not be deleted")

            return {"success": True, "message": f"Student {student.first_name} {student.last_name} deleted successfully"}
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Error deleting student: {str(e)}"
            )
    
    @staticmethod
    async def check_admin_access(student_id: str, parent_id: str) -> bool:
        """Check if a parent has admin access to a student."""
        db = Database.get_db()
        student = await db.students.find_one({"_id": ObjectId(student_id)})
        
        if not student:
            return False
        
        # Check if parent has admin access in parent_access
        for access in student.get("parent_access", []):
            if str(access.get("parent_id")) == parent_id and access.get("access_level") == "admin":
                return True
        
        # For backward compatibility, if parent is in parent_ids and there's no parent_access entry,
        # consider them as having admin access (original creator)
        if ObjectId(parent_id) in student.get("parent_ids", []) and not student.get("parent_access"):
            return True
            
        return False
    
    @staticmethod
    async def get_student_parents(student_id: str) -> List[Dict[str, Any]]:
        """Get all parents with access to a student."""
        db = Database.get_db()
        student = await StudentService.get_student_by_id(student_id)
        
        result = []
        
        # Process parent_access entries
        for access in student.dict().get("parent_access", []):
            try:
                parent = await UserService.get_user_by_id(str(access.get("parent_id")))
                result.append({
                    "parent_id": str(access.get("parent_id")),
                    "email": parent.email,
                    "full_name": f"{parent.first_name} {parent.last_name}",
                    "access_level": access.get("access_level")
                })
            except HTTPException:
                # Skip if user not found
                continue
        
        # For backward compatibility, check parent_ids that aren't in parent_access
        for parent_id in student.dict().get("parent_ids", []):
            # Skip if already processed in parent_access
            if any(str(access.get("parent_id")) == str(parent_id) for access in student.dict().get("parent_access", [])):
                continue
                
            try:
                parent = await UserService.get_user_by_id(str(parent_id))
                result.append({
                    "parent_id": str(parent_id),
                    "email": parent.email,
                    "full_name": f"{parent.first_name} {parent.last_name}",
                    "access_level": "admin"  # Default for backward compatibility
                })
            except HTTPException:
                # Skip if user not found
                continue
        
        return result
    
    @staticmethod
    async def add_parent_access(student_id: str, parent_email: str, access_level: AccessLevel, current_parent_id: str) -> Dict[str, Any]:
        """Add a parent to a student with a specific access level."""
        db = Database.get_db()
        
        # Check if current parent has admin access
        has_admin = await StudentService.check_admin_access(student_id, current_parent_id)
        if not has_admin:
            raise HTTPException(status_code=403, detail="Only parents with admin access can add other parents")
        
        # Find the user by email
        user = await db.users.find_one({"email": parent_email})
        if not user:
            raise HTTPException(status_code=404, detail=f"User with email {parent_email} not found")
        
        parent_id = user["_id"]
        
        # Get the student
        student = await StudentService.get_student_by_id(student_id)
        
        # Check if parent already has access
        for access in student.dict().get("parent_access", []):
            if str(access.get("parent_id")) == str(parent_id):
                raise HTTPException(status_code=400, detail="Parent already has access to this student")
        
        # Add parent to parent_access
        parent_access = ParentAccess(parent_id=parent_id, access_level=access_level)
        
        update_result = await db.students.update_one(
            {"_id": ObjectId(student_id)},
            {
                "$push": {"parent_access": parent_access.dict()},
                "$addToSet": {"parent_ids": parent_id}  # For backward compatibility
            }
        )
        
        if update_result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Failed to add parent access")
        
        return {
            "success": True,
            "message": f"Added {access_level} access for {parent_email} to student {student.first_name} {student.last_name}"
        }
    
# End of class
    
    @staticmethod
    async def update_parent_access(student_id: str, parent_id: str, access_level: AccessLevel, current_parent_id: str) -> Dict[str, Any]:
        """Update a parent's access level."""
        db = Database.get_db()
        
        # Check if current parent has admin access
        has_admin = await StudentService.check_admin_access(student_id, current_parent_id)
        if not has_admin:
            raise HTTPException(status_code=403, detail="Only parents with admin access can update parent access")
        
        # Get the student
        student = await StudentService.get_student_by_id(student_id)
        
        # Find the parent access entry
        parent_access_index = None
        for i, access in enumerate(student.get("parent_access", [])):
            if str(access.get("parent_id")) == parent_id:
                parent_access_index = i
                break
        
        if parent_access_index is None:
            # For backward compatibility, if parent is in parent_ids but not in parent_access
            if ObjectId(parent_id) in student.dict().get("parent_ids", []):
                # Add a new parent_access entry
                parent_access = ParentAccess(parent_id=ObjectId(parent_id), access_level=access_level)
                update_result = await db.students.update_one(
                    {"_id": ObjectId(student_id)},
                    {"$push": {"parent_access": parent_access.dict()}}
                )
            else:
                raise HTTPException(status_code=404, detail="Parent does not have access to this student")
        else:
            # Update the existing parent_access entry
            update_result = await db.students.update_one(
                {"_id": ObjectId(student_id)},
                {"$set": {f"parent_access.{parent_access_index}.access_level": access_level}}
            )
        
        if update_result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Failed to update parent access")
        
        return {
            "success": True,
            "message": f"Updated access level to {access_level} for parent"
        }
    
    @staticmethod
    async def remove_parent_access(student_id: str, parent_id: str, current_parent_id: str) -> Dict[str, Any]:
        """Remove a parent's access to a student."""
        db = Database.get_db()
        
        # Check if current parent has admin access
        has_admin = await StudentService.check_admin_access(student_id, current_parent_id)
        if not has_admin:
            raise HTTPException(status_code=403, detail="Only parents with admin access can remove parent access")
        
        # Get the student
        student = await StudentService.get_student_by_id(student_id)
        
        # Check if trying to remove the last admin
        admin_count = 0
        is_target_admin = False
        
        for access in student.get("parent_access", []):
            if access.access_level == AccessLevel.ADMIN:
                admin_count += 1
                if str(access.get("parent_id")) == parent_id:
                    is_target_admin = True
        
        # If there's only one admin and trying to remove them, prevent it
        if admin_count == 1 and is_target_admin:
            raise HTTPException(
                status_code=400, 
                detail="Cannot remove the last admin. Assign admin access to another parent first."
            )
        
        # Remove parent from parent_access
        update_result = await db.students.update_one(
            {"_id": ObjectId(student_id)},
            {
                "$pull": {
                    "parent_access": {"parent_id": ObjectId(parent_id)},
                    "parent_ids": ObjectId(parent_id)  # Also remove from parent_ids
                }
            }
        )
        
        if update_result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Failed to remove parent access")
        
        return {
            "success": True,
            "message": f"Removed access for parent"
        }
    
    @staticmethod
    async def update_grade_level(student_id_or_slug: str, new_grade_level: str, current_parent_id: str) -> Student:
        """Update a student's grade_level after verifying admin access. Accepts id or slug."""
        db = Database.get_db()
        # Resolve student id (accept ObjectId or slug)
        resolved_id: Optional[ObjectId] = None
        if ObjectId.is_valid(student_id_or_slug):
            resolved_id = ObjectId(student_id_or_slug)
        else:
            student_doc = await db.students.find_one({"slug": student_id_or_slug})
            if not student_doc:
                raise HTTPException(status_code=404, detail="Student not found")
            resolved_id = student_doc["_id"]
        # Check admin access
        has_admin = await StudentService.check_admin_access(str(resolved_id), current_parent_id)
        if not has_admin:
            raise HTTPException(status_code=403, detail="Only parents with admin access can change grade")
        # Perform update
        update_result = await db.students.update_one(
            {"_id": resolved_id},
            {"$set": {"grade_level": new_grade_level}}
        )
        if update_result.modified_count == 0:
            # Could be same grade; fetch anyway
            student_doc = await db.students.find_one({"_id": resolved_id})
            if not student_doc:
                raise HTTPException(status_code=404, detail="Student not found after update")
            return Student(**student_doc)
        # Return updated document
        updated = await db.students.find_one({"_id": resolved_id})
        return Student(**updated)

    @staticmethod
    async def resolve_student_object_id(student_id_or_slug: str) -> ObjectId:
        """Resolve a provided id or slug into an ObjectId."""
        db = Database.get_db()
        if ObjectId.is_valid(student_id_or_slug):
            return ObjectId(student_id_or_slug)
        student_doc = await db.students.find_one({"slug": student_id_or_slug})
        if not student_doc:
            raise HTTPException(status_code=404, detail="Student not found")
        return student_doc["_id"]

    @staticmethod
    async def update_student(student_id_or_slug: str, updates: Dict[str, Any], current_parent_id: str) -> Student:
        """Update core student details (first/last name, dob, gender, grade) and regenerate slug if needed."""
        db = Database.get_db()
        resolved_id = await StudentService.resolve_student_object_id(student_id_or_slug)
        # Check admin access
        has_admin = await StudentService.check_admin_access(str(resolved_id), current_parent_id)
        if not has_admin:
            raise HTTPException(status_code=403, detail="Only parents with admin access can update the student")

        # Normalize allowed fields
        allowed_fields = {"first_name", "last_name", "date_of_birth", "gender", "grade_level"}
        set_updates: Dict[str, Any] = {}
        for key, value in updates.items():
            if key in allowed_fields:
                if key == "date_of_birth" and isinstance(value, date):
                    set_updates[key] = value.isoformat()
                else:
                    set_updates[key] = value
        if not set_updates:
            # Nothing to update
            student_doc = await db.students.find_one({"_id": resolved_id})
            return Student(**student_doc)

        # If first/last name changed, update slug
        if "first_name" in set_updates or "last_name" in set_updates:
            # Get current names
            current = await db.students.find_one({"_id": resolved_id}, {"first_name": 1, "last_name": 1})
            first_name = set_updates.get("first_name", current.get("first_name"))
            last_name = set_updates.get("last_name", current.get("last_name"))
            new_slug_base = StudentService.generate_slug(first_name, last_name)
            unique_slug = await StudentService.ensure_unique_slug(db, new_slug_base, str(resolved_id))
            set_updates["slug"] = unique_slug

        update_result = await db.students.update_one({"_id": resolved_id}, {"$set": set_updates})
        if update_result.modified_count == 0:
            # Fetch current doc regardless
            student_doc = await db.students.find_one({"_id": resolved_id})
            return Student(**student_doc)

        updated = await db.students.find_one({"_id": resolved_id})
        return Student(**updated)

    @staticmethod
    async def update_student_avatar(student_id_or_slug: str, file: UploadFile, current_parent_id: str) -> Student:
        """Upload and set a student's avatar image. Returns updated student."""
        db = Database.get_db()
        resolved_id = await StudentService.resolve_student_object_id(student_id_or_slug)
        # Check admin access
        has_admin = await StudentService.check_admin_access(str(resolved_id), current_parent_id)
        if not has_admin:
            raise HTTPException(status_code=403, detail="Only parents with admin access can change the student's avatar")

        # Determine path: use slug if available
        student_doc = await db.students.find_one({"_id": resolved_id}, {"slug": 1})
        slug_or_id = student_doc.get("slug") or str(resolved_id)
        file_path = f"avatars/{slug_or_id}/profile"

        # Upload file via storage service and request thumbnails
        upload_result = await file_storage_service.upload_file(file, file_path, generate_thumbnail=True, thumbnail_size=(200, 200))

        # Persist avatar fields
        avatar_updates = {
            "avatar_path": file_path,
            "avatar_url": upload_result.get("original_url"),
            "avatar_thumbnail_url": upload_result.get("thumbnail_small_url") or upload_result.get("original_url"),
        }
        await db.students.update_one({"_id": resolved_id}, {"$set": avatar_updates})

        updated = await db.students.find_one({"_id": resolved_id})
        return Student(**updated)
