from ..utils.database import Database
from ..utils.auth import get_password_hash, verify_password
from ..models.user import UserCreate, UserInDB
from fastapi import HTTPException
from bson import ObjectId

class UserService:
    @staticmethod
    async def create_user(user: UserCreate):
        db = Database.get_db()
        
        # Check if user already exists
        if await db.users.find_one({"email": user.email}):
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Create new user
        user_dict = user.dict()
        user_dict["hashed_password"] = get_password_hash(user_dict.pop("password"))
        
        result = await db.users.insert_one(user_dict)
        
        created_user = await db.users.find_one({"_id": result.inserted_id})
        return UserInDB(**created_user)

    @staticmethod
    async def authenticate_user(email: str, password: str):
        db = Database.get_db()
        user = await db.users.find_one({"email": email})
        
        if not user:
            return False
        if not verify_password(password, user["hashed_password"]):
            return False
        
        return UserInDB(**user)