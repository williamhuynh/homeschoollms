from datetime import datetime, timedelta, timezone
from typing import Optional, Union
from jose import JWTError, jwt
from fastapi import HTTPException, status, Depends, Header
from fastapi.security import OAuth2PasswordBearer
from ..models.schemas.user import UserInDB
from ..services.auth_service import AuthService
from ..services.supabase_service import SupabaseService
from ..config.settings import settings
import os

# Ensure we have a valid secret key
SECRET_KEY = settings.jwt_secret
if not SECRET_KEY:
    # Fallback to environment variable directly as a last resort
    SECRET_KEY = os.getenv("JWT_SECRET", "fallback-secret-key-for-development-only")
    if not SECRET_KEY:
        print("WARNING: No JWT_SECRET found. Using insecure default secret key!")
        SECRET_KEY = "insecure-default-secret-key-for-development-only"

ALGORITHM = settings.jwt_algorithm

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserInDB:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # First try to verify as a Supabase token
    if settings.supabase_url and settings.supabase_jwt_secret:
        try:
            # Verify token with Supabase
            supabase_user = await SupabaseService.verify_token(token)
            if supabase_user:
                # Get or create user in our database
                email = supabase_user.get("email")
                if not email:
                    raise credentials_exception
                
                # Check if user exists in our database
                user = await AuthService.get_user_by_email(email)
                if not user:
                    # Create user in our database
                    user_metadata = supabase_user.get("user_metadata", {})
                    first_name = user_metadata.get("first_name", "User")
                    last_name = user_metadata.get("last_name", "Name")
                    role = user_metadata.get("role", "parent")
                    
                    # Create user with hashed password placeholder (Supabase manages auth)
                    from ..utils.password_utils import get_password_hash
                    hashed_password = get_password_hash("supabase_managed_password")
                    
                    user = await AuthService.create_user(
                        email=email,
                        hashed_password=hashed_password,
                        first_name=first_name,
                        last_name=last_name,
                        is_verified=True,
                        role=role
                    )
                
                return user
        except Exception as e:
            print(f"Supabase token verification failed: {e}")
            # Continue to try legacy token verification
    
    # Legacy token verification
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = await AuthService.get_user_by_email(email)
    if user is None:
        raise credentials_exception
    return user

async def get_current_user_with_org(
    current_user: UserInDB = Depends(get_current_user)
) -> UserInDB:
    if not current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be associated with an organization"
        )
    return current_user
