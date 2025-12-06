"""
Admin Service - Super Admin operations for platform management.

This service provides functionality for super admins to:
- List and search all users
- Update any user's profile and subscription
- Manage user account status
- Access all students regardless of parent relationship
- Impersonate users for debugging
"""

from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from bson import ObjectId
from fastapi import HTTPException
import logging

from ..utils.database_utils import Database
from ..models.schemas.user import UserInDB, UserRole
from ..utils.auth_utils import create_access_token
from ..config.settings import settings

logger = logging.getLogger(__name__)


class AdminService:
    """Service for super admin operations"""
    
    @staticmethod
    async def list_users(
        skip: int = 0,
        limit: int = 50,
        search: Optional[str] = None,
        role: Optional[str] = None,
        is_active: Optional[bool] = None,
        subscription_tier: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        List all users with optional filtering and pagination.
        
        Args:
            skip: Number of records to skip (for pagination)
            limit: Maximum number of records to return
            search: Search term for email or name
            role: Filter by role (parent, admin, super_admin)
            is_active: Filter by active status
            subscription_tier: Filter by subscription tier
            
        Returns:
            Dict with users list and total count
        """
        db = Database.get_db()
        
        # Build query
        query = {}
        
        if search:
            # Case-insensitive search on email, first_name, last_name
            query["$or"] = [
                {"email": {"$regex": search, "$options": "i"}},
                {"first_name": {"$regex": search, "$options": "i"}},
                {"last_name": {"$regex": search, "$options": "i"}}
            ]
        
        if role:
            query["role"] = role
            
        if is_active is not None:
            query["is_active"] = is_active
            
        if subscription_tier:
            query["subscription_tier"] = subscription_tier
        
        # Get total count
        total = await db.users.count_documents(query)
        
        # Get users with pagination
        cursor = db.users.find(query).skip(skip).limit(limit).sort("created_at", -1)
        users = []
        
        async for user in cursor:
            # Sanitize user data (remove sensitive fields)
            user_data = AdminService._sanitize_user(user)
            users.append(user_data)
        
        return {
            "users": users,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    
    @staticmethod
    async def get_user_by_id(user_id: str) -> Dict[str, Any]:
        """
        Get a user's full profile by ID.
        
        Args:
            user_id: The user's ObjectId as string
            
        Returns:
            User data dict
        """
        db = Database.get_db()
        
        if not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=400, detail="Invalid user ID format")
        
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return AdminService._sanitize_user(user, include_sensitive=True)
    
    @staticmethod
    async def get_user_by_email(email: str) -> Dict[str, Any]:
        """
        Get a user's full profile by email.
        
        Args:
            email: The user's email address
            
        Returns:
            User data dict
        """
        db = Database.get_db()
        
        user = await db.users.find_one({"email": email.lower()})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return AdminService._sanitize_user(user, include_sensitive=True)
    
    @staticmethod
    async def update_user_profile(user_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update a user's profile information.
        
        Args:
            user_id: The user's ObjectId as string
            updates: Dict containing fields to update
            
        Returns:
            Updated user data
        """
        db = Database.get_db()
        
        if not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=400, detail="Invalid user ID format")
        
        # Allowed fields for profile update
        allowed_fields = {
            "first_name", "last_name", "email", "role", 
            "is_active", "is_verified", "profile_image"
        }
        
        # Filter to only allowed fields
        update_data = {k: v for k, v in updates.items() if k in allowed_fields and v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        # Validate role if being updated
        if "role" in update_data:
            valid_roles = [r.value for r in UserRole]
            if update_data["role"] not in valid_roles:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid role. Must be one of: {valid_roles}"
                )
        
        # Validate email if being updated
        if "email" in update_data:
            update_data["email"] = update_data["email"].lower()
            existing = await db.users.find_one({
                "email": update_data["email"],
                "_id": {"$ne": ObjectId(user_id)}
            })
            if existing:
                raise HTTPException(status_code=400, detail="Email already in use")
        
        result = await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Return updated user
        updated_user = await db.users.find_one({"_id": ObjectId(user_id)})
        
        logger.info(f"Super admin updated user {user_id}: {list(update_data.keys())}")
        
        return AdminService._sanitize_user(updated_user, include_sensitive=True)
    
    @staticmethod
    async def update_user_subscription(
        user_id: str,
        subscription_tier: Optional[str] = None,
        is_grandfathered: Optional[bool] = None,
        subscription_status: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Update a user's subscription settings directly (bypass Stripe).
        
        Args:
            user_id: The user's ObjectId as string
            subscription_tier: New tier (free, basic)
            is_grandfathered: Whether user is grandfathered
            subscription_status: Subscription status
            
        Returns:
            Updated user data
        """
        db = Database.get_db()
        
        if not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=400, detail="Invalid user ID format")
        
        update_data = {}
        
        if subscription_tier is not None:
            if subscription_tier not in ["free", "basic"]:
                raise HTTPException(status_code=400, detail="Invalid tier. Must be 'free' or 'basic'")
            update_data["subscription_tier"] = subscription_tier
        
        if is_grandfathered is not None:
            update_data["is_grandfathered"] = is_grandfathered
        
        if subscription_status is not None:
            valid_statuses = ["active", "canceled", "past_due", "incomplete", "trialing"]
            if subscription_status not in valid_statuses:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid status. Must be one of: {valid_statuses}"
                )
            update_data["subscription_status"] = subscription_status
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No subscription fields to update")
        
        result = await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Return updated user
        updated_user = await db.users.find_one({"_id": ObjectId(user_id)})
        
        logger.info(f"Super admin updated subscription for user {user_id}: {update_data}")
        
        return AdminService._sanitize_user(updated_user, include_sensitive=True)
    
    @staticmethod
    async def deactivate_user(user_id: str) -> Dict[str, Any]:
        """
        Deactivate a user account.
        
        Args:
            user_id: The user's ObjectId as string
            
        Returns:
            Updated user data
        """
        return await AdminService.update_user_profile(user_id, {"is_active": False})
    
    @staticmethod
    async def reactivate_user(user_id: str) -> Dict[str, Any]:
        """
        Reactivate a user account.
        
        Args:
            user_id: The user's ObjectId as string
            
        Returns:
            Updated user data
        """
        return await AdminService.update_user_profile(user_id, {"is_active": True})
    
    @staticmethod
    async def delete_user(user_id: str, soft_delete: bool = True) -> Dict[str, str]:
        """
        Delete a user account.
        
        Args:
            user_id: The user's ObjectId as string
            soft_delete: If True, just deactivate. If False, permanently delete.
            
        Returns:
            Success message
        """
        db = Database.get_db()
        
        if not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=400, detail="Invalid user ID format")
        
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if soft_delete:
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"is_active": False, "deleted_at": datetime.utcnow()}}
            )
            logger.info(f"Super admin soft-deleted user {user_id}")
            return {"message": f"User {user.get('email')} has been deactivated"}
        else:
            # Hard delete - also clean up related data
            await db.users.delete_one({"_id": ObjectId(user_id)})
            logger.warning(f"Super admin permanently deleted user {user_id}")
            return {"message": f"User {user.get('email')} has been permanently deleted"}
    
    @staticmethod
    async def list_all_students(
        skip: int = 0,
        limit: int = 50,
        search: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        List all students in the system (super admin access).
        
        Args:
            skip: Number of records to skip
            limit: Maximum records to return
            search: Search term for student name
            
        Returns:
            Dict with students list and total count
        """
        db = Database.get_db()
        
        query = {}
        
        if search:
            query["$or"] = [
                {"first_name": {"$regex": search, "$options": "i"}},
                {"last_name": {"$regex": search, "$options": "i"}},
                {"slug": {"$regex": search, "$options": "i"}}
            ]
        
        total = await db.students.count_documents(query)
        
        cursor = db.students.find(query).skip(skip).limit(limit).sort("_id", -1)
        students = []
        
        async for student in cursor:
            student["id"] = str(student.pop("_id"))
            # Convert ObjectId fields to strings
            if "parent_ids" in student:
                student["parent_ids"] = [str(pid) for pid in student.get("parent_ids", [])]
            if "parent_access" in student:
                for access in student.get("parent_access", []):
                    if "parent_id" in access:
                        access["parent_id"] = str(access["parent_id"])
            students.append(student)
        
        return {
            "students": students,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    
    @staticmethod
    async def get_student_by_id_admin(student_id: str) -> Dict[str, Any]:
        """
        Get any student by ID (super admin bypass).
        
        Args:
            student_id: The student's ObjectId as string
            
        Returns:
            Student data
        """
        db = Database.get_db()
        
        if not ObjectId.is_valid(student_id):
            raise HTTPException(status_code=400, detail="Invalid student ID format")
        
        student = await db.students.find_one({"_id": ObjectId(student_id)})
        
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        
        student["id"] = str(student.pop("_id"))
        if "parent_ids" in student:
            student["parent_ids"] = [str(pid) for pid in student.get("parent_ids", [])]
        if "parent_access" in student:
            for access in student.get("parent_access", []):
                if "parent_id" in access:
                    access["parent_id"] = str(access["parent_id"])
        
        return student
    
    @staticmethod
    async def create_impersonation_token(
        admin_user_id: str,
        target_user_id: str
    ) -> Dict[str, str]:
        """
        Create an impersonation token to act as another user.
        
        Args:
            admin_user_id: The super admin's user ID
            target_user_id: The user to impersonate
            
        Returns:
            Dict with impersonation token
        """
        db = Database.get_db()
        
        if not ObjectId.is_valid(target_user_id):
            raise HTTPException(status_code=400, detail="Invalid target user ID format")
        
        target_user = await db.users.find_one({"_id": ObjectId(target_user_id)})
        
        if not target_user:
            raise HTTPException(status_code=404, detail="Target user not found")
        
        # Create a special token that includes impersonation metadata
        token_data = {
            "sub": target_user.get("email"),
            "impersonated_by": admin_user_id,
            "impersonation": True,
            "original_user_email": target_user.get("email")
        }
        
        # Impersonation tokens expire in 1 hour for security
        expires_delta = timedelta(hours=1)
        token = create_access_token(data=token_data, expires_delta=expires_delta)
        
        logger.warning(
            f"Super admin {admin_user_id} started impersonating user {target_user_id} "
            f"({target_user.get('email')})"
        )
        
        return {
            "token": token,
            "impersonated_user": {
                "id": str(target_user["_id"]),
                "email": target_user.get("email"),
                "first_name": target_user.get("first_name"),
                "last_name": target_user.get("last_name"),
                "role": target_user.get("role")
            },
            "expires_in": 3600  # 1 hour in seconds
        }
    
    @staticmethod
    async def get_platform_stats() -> Dict[str, Any]:
        """
        Get platform-wide statistics for super admin dashboard.
        
        Returns:
            Dict with various platform statistics
        """
        db = Database.get_db()
        
        # User stats
        total_users = await db.users.count_documents({})
        active_users = await db.users.count_documents({"is_active": True})
        users_by_role = {}
        for role in UserRole:
            count = await db.users.count_documents({"role": role.value})
            users_by_role[role.value] = count
        
        # Subscription stats
        free_users = await db.users.count_documents({"subscription_tier": "free"})
        basic_users = await db.users.count_documents({"subscription_tier": "basic"})
        grandfathered_users = await db.users.count_documents({"is_grandfathered": True})
        
        # Student stats
        total_students = await db.students.count_documents({})
        
        # Evidence stats (approximate)
        total_evidence = 0
        async for lo in db.learning_outcomes.find({}):
            total_evidence += len(lo.get("evidence", []))
        
        return {
            "users": {
                "total": total_users,
                "active": active_users,
                "by_role": users_by_role
            },
            "subscriptions": {
                "free": free_users,
                "basic": basic_users,
                "grandfathered": grandfathered_users
            },
            "students": {
                "total": total_students
            },
            "evidence": {
                "total": total_evidence
            }
        }
    
    @staticmethod
    def _sanitize_user(user: dict, include_sensitive: bool = False) -> Dict[str, Any]:
        """
        Sanitize user data for API response.
        
        Args:
            user: Raw user document from database
            include_sensitive: Whether to include sensitive fields
            
        Returns:
            Sanitized user dict
        """
        result = {
            "id": str(user.get("_id")),
            "email": user.get("email"),
            "first_name": user.get("first_name"),
            "last_name": user.get("last_name"),
            "role": user.get("role", "parent"),
            "is_active": user.get("is_active", True),
            "is_verified": user.get("is_verified", False),
            "profile_image": user.get("profile_image"),
            "created_at": user.get("created_at"),
            "last_login": user.get("last_login"),
            "subscription_tier": user.get("subscription_tier", "free"),
            "subscription_status": user.get("subscription_status", "active"),
            "is_grandfathered": user.get("is_grandfathered", False),
        }
        
        if include_sensitive:
            result["stripe_customer_id"] = user.get("stripe_customer_id")
            result["stripe_subscription_id"] = user.get("stripe_subscription_id")
            result["current_period_end"] = user.get("current_period_end")
            result["organization_id"] = str(user.get("organization_id")) if user.get("organization_id") else None
            result["family_id"] = str(user.get("family_id")) if user.get("family_id") else None
        
        return result
