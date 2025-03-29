from ..utils.database_utils import Database
from ..models.schemas.user import UserInDB, UserCreate
from ..utils.password_utils import get_password_hash, verify_password

class AuthService:
    @staticmethod
    async def authenticate_user(email: str, password: str):
        db = Database.get_db()
        user = await db.users.find_one({"email": email})
        if not user:
            return None
        
        # Ensure PyObjectId fields are properly handled
        if "organization_id" in user and user["organization_id"] is not None:
            user["organization_id"] = str(user["organization_id"])
        if "family_id" in user and user["family_id"] is not None:
            user["family_id"] = str(user["family_id"])
        
        user = UserInDB(**user)
        if not verify_password(password, user.hashed_password):
            return None
        return user

    @staticmethod
    async def get_user_by_email(email: str):
        db = Database.get_db()
        user = await db.users.find_one({"email": email})
        if not user:
            return None
        # Ensure PyObjectId fields are properly handled
        if "organization_id" in user and user["organization_id"] is not None:
            user["organization_id"] = str(user["organization_id"])
        if "family_id" in user and user["family_id"] is not None:
            user["family_id"] = str(user["family_id"])
        return UserInDB(**user)
    
    @staticmethod
    async def create_user(email: str, hashed_password: str, first_name: str, last_name: str):
        db = Database.get_db()
        user_data = {
            "email": email,
            "hashed_password": hashed_password,
            "first_name": first_name,
            "last_name": last_name,
            "is_active": True,
            "role": "parent",  # Default role
            "is_verified": False,
            "profile_image": None,
            "last_login": None,
            "organization_id": None,
            "family_id": None
        }
        result = await db.users.insert_one(user_data)
        if result.inserted_id:
            return UserInDB(**user_data, id=str(result.inserted_id))
        return None
