from pydantic_settings import BaseSettings
from typing import List, Optional

class Settings(BaseSettings):
    # MongoDB settings
    mongodb_url: str

    # JWT settings
    jwt_secret: str = None
    JWT_SECRET: str = None  # For backward compatibility
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # Supabase settings
    supabase_url: Optional[str] = None
    supabase_anon_key: Optional[str] = None
    supabase_service_key: Optional[str] = None
    supabase_jwt_secret: Optional[str] = None
    
    def __init__(self, **data):
        super().__init__(**data)
        # Use JWT_SECRET as fallback for jwt_secret
        if self.jwt_secret is None and self.JWT_SECRET is not None:
            self.jwt_secret = self.JWT_SECRET

    # CORS settings
    allowed_origins: List[str] = [
        "http://localhost:5173",
        "https://homeschoollms.vercel.app",
        "https://homeschool-lms.vercel.app"  # Production frontend
    ]
    
    class Config:
        env_file = ".env"

settings = Settings()
