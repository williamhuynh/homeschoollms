from ..utils.database_utils import Database
from ..utils.password_utils import get_password_hash  # Updated import
from ..models.schemas.user import UserCreate, UserInDB
from fastapi import HTTPException
from bson import ObjectId
from typing import List

class UserService:
    @staticmethod
    async def create_user(user: UserCreate):
        db = Database.get_db()
        if await db.users.find_one({"email": user.email}):
            raise HTTPException(status_code=400, detail="Email already registered")
        
        user_dict = user.dict()
        user_dict["hashed_password"] = get_password_hash(user_dict.pop("password"))
        
        result = await db.users.insert_one(user_dict)
        created_user = await db.users.find_one({"_id": result.inserted_id})
        return UserInDB(**created_user)

    @staticmethod
    async def get_user_by_id(user_id: str):
        db = Database.get_db()
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return UserInDB(**user)

    @staticmethod
    async def get_user_by_email(email: str):
        """
        Get a user by their email address.
        
        Args:
            email: The email address to search for
            
        Returns:
            The user if found, None otherwise
        """
        db = Database.get_db()
        user = await db.users.find_one({"email": email})
        if not user:
            return None
            
        # Handle ObjectId fields
        if "organization_id" in user and user["organization_id"] is not None:
            user["organization_id"] = str(user["organization_id"])
        if "family_id" in user and user["family_id"] is not None:
            user["family_id"] = str(user["family_id"])
            
        return UserInDB(**user)

    @staticmethod
    async def get_family_members(family_id: str) -> List[UserInDB]:
        db = Database.get_db()
        users = await db.users.find({"family_id": ObjectId(family_id)}).to_list(None)
        return [UserInDB(**user) for user in users]

    @staticmethod
    async def update_user(user_id: str, update_data: dict):
        """
        Update a user's attributes in the database.
        
        Args:
            user_id: The ID of the user to update
            update_data: Dictionary containing fields to update
            
        Returns:
            The updated user object
        """
        db = Database.get_db()
        
        # Validate user exists
        existing_user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not existing_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Update the user
        result = await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            # If no modification was done (maybe trying to update to same values)
            # Still return the user without error
            pass
            
        # Get the updated user
        updated_user = await db.users.find_one({"_id": ObjectId(user_id)})
        return UserInDB(**updated_user)