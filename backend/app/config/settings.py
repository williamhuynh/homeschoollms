from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # MongoDB settings
    mongodb_url: str

    # JWT settings
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # CORS settings
    allowed_origins: List[str] = [
        "http://localhost:5173",
        "https://homeschoollms.vercel.app"
        "https://homeschool-lms.vercel.app"  # Production frontend
    ]
    
    class Config:
        env_file = ".env"

settings = Settings()