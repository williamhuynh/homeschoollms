from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.security import OAuth2PasswordRequestForm
from typing import Optional
from ..services.auth_service import AuthService
from ..services.supabase_service import SupabaseService
from ..utils.auth_utils import create_access_token, get_current_user, ALGORITHM, SECRET_KEY
from datetime import timedelta
from ..config.settings import settings
from ..models.schemas.token import Token
from ..utils.password_utils import get_password_hash
from ..models.schemas.user import User, UserCreate, UserInDB


router = APIRouter()

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await AuthService.authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/register", response_model=User)
async def register(user: UserCreate):
    existing_user = await AuthService.get_user_by_email(user.email)
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="User with this email already exists"
        )
    
    hashed_password = get_password_hash(user.password)
    new_user = await AuthService.create_user(user.email, hashed_password, user.first_name, user.last_name)
    return new_user

@router.get("/me", response_model=User)
async def get_current_user_info(current_user: UserInDB = Depends(get_current_user)):
    """Get the current authenticated user's information"""
    return current_user

@router.post("/verify-token")
async def verify_token(authorization: Optional[str] = Header(None)):
    """Verify a token and return basic user info if valid"""
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Extract token from Authorization header
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication scheme",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Try to verify as Supabase token first
    if settings.supabase_url and settings.supabase_jwt_secret:
        try:
            supabase_user = await SupabaseService.verify_token(token)
            if supabase_user:
                return {
                    "valid": True,
                    "user": {
                        "id": supabase_user.get("id"),
                        "email": supabase_user.get("email"),
                        "user_metadata": supabase_user.get("user_metadata", {})
                    }
                }
        except Exception as e:
            print(f"Supabase token verification failed: {e}")
            # Continue to try legacy token verification
    
    # Legacy token verification
    try:
        user = await get_current_user(token)
        if user:
            return {
                "valid": True,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "role": user.role
                }
            }
    except Exception as e:
        pass
    
    return {"valid": False}
