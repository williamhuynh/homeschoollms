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
import logging # Import logging

# JWT secret for legacy auth (optional - Supabase is primary auth provider)
# If not configured, legacy JWT auth is disabled but Supabase auth still works
SECRET_KEY = settings.jwt_secret or os.getenv("JWT_SECRET")

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
    logging.info(f"Checking for Supabase settings: URL set? {'Yes' if settings.supabase_url else 'No'}, Secret set? {'Yes' if settings.supabase_jwt_secret else 'No'}")
    if settings.supabase_url and settings.supabase_jwt_secret:
        logging.info("Attempting Supabase token verification.")
        try:
            # Verify token with Supabase
            supabase_user = await SupabaseService.verify_token(token)
            if supabase_user:
                logging.info("Supabase token verified successfully.")
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
                    # Always assign 'parent' role for auto-created users.
                    # Never trust client-supplied role from user_metadata as it
                    # can be set during signup, enabling privilege escalation.
                    role = "parent"
                    
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
            logging.error(f"Supabase token verification failed: {e}", exc_info=True)
            # Continue to try legacy token verification
    else:
        logging.info("Supabase URL or JWT Secret not set, skipping Supabase verification.")
    
    # Legacy token verification (only if JWT_SECRET is configured)
    if not SECRET_KEY:
        logging.warning("Legacy JWT auth disabled - JWT_SECRET not configured. Supabase auth should be used.")
        raise credentials_exception
    
    logging.info("Attempting legacy token verification.")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError as e:
        logging.error(f"Legacy JWTError: {e}", exc_info=True)
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

async def get_admin_user(
    current_user: UserInDB = Depends(get_current_user)
) -> UserInDB:
    """
    Dependency that ensures the current user is an admin or super_admin.
    Use this for routes that should only be accessible to admin users.
    """
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required for this operation"
        )
    return current_user


async def get_super_admin_user(
    current_user: UserInDB = Depends(get_current_user)
) -> UserInDB:
    """
    Dependency that ensures the current user is a super_admin.
    Use this for routes that should only be accessible to the platform owner.
    Super admin has full system access including:
    - Managing all users across the platform
    - Modifying subscription tiers directly
    - Impersonating users
    - Accessing all students regardless of parent relationship
    """
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super administrator access required for this operation"
        )
    return current_user


def is_admin_user(user: UserInDB) -> bool:
    """
    Helper function to check if a user has admin privileges.
    Returns True if the user's role is 'admin' or 'super_admin'.
    """
    return user.role in ["admin", "super_admin"]


def is_super_admin_user(user: UserInDB) -> bool:
    """
    Helper function to check if a user has super admin privileges.
    Returns True if the user's role is 'super_admin'.
    """
    return user.role == "super_admin"
