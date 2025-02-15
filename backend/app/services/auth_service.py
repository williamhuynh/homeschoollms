from ..utils.database import Database
from ..models.schemas.user import UserInDB
from ..utils.auth import verify_password

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