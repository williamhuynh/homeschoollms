from ..utils.database_utils import Database
from ..models.schemas.user import UserInDB
from ..utils.password_utils import verify_password

class AuthService:
    @staticmethod
    async def authenticate_user(email: str, password: str):
        db = Database.get_db()
        user = await db.users.find_one({"email": email})
        if not user:
            return None
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
        return UserInDB(**user)
    
    @staticmethod
    async def create_user(email: str, hashed_password: str):
        db = Database.get_db()
        user_data = {
            "email": email,
            "hashed_password": hashed_password,
            "is_active": True,
            "organization_id": None  # Add default fields as needed
        }
        result = await db.users.insert_one(user_data)
        if result.inserted_id:
            return UserInDB(**user_data, id=str(result.inserted_id))
        return None