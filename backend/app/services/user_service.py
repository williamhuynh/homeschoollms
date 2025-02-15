from ..utils.database import Database
from ..utils.auth import get_password_hash, verify_password
from ..models.schemas.user import UserBase, UserCreate, UserInDB, Organization
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
    async def get_family_members(family_id: str) -> List[UserInDB]:
        db = Database.get_db()
        users = await db.users.find({"family_id": ObjectId(family_id)}).to_list(None)
        return [UserInDB(**user) for user in users]