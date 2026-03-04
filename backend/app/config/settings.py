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
    
    # Stripe settings
    stripe_secret_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    stripe_monthly_price_id: Optional[str] = None
    stripe_annual_price_id: Optional[str] = None
    
    # Frontend URL for redirects
    frontend_url: str = "http://localhost:5173"
    
    def __init__(self, **data):
        super().__init__(**data)
        # Use JWT_SECRET as fallback for jwt_secret
        if self.jwt_secret is None and self.JWT_SECRET is not None:
            self.jwt_secret = self.JWT_SECRET

    # CORS settings
    allowed_origins: List[str] = [
        "http://localhost:5173",
        "http://localhost",
        "https://homeschool-lms.vercel.app",  # Production frontend (Vercel)
        "https://www.astralearn.com.au",  # Production frontend (custom domain)
        "https://astralearn.com.au",  # Production frontend (custom domain without www)
        "https://app.astralearn.com.au",  # Production frontend (app subdomain)
        "http://localhost:4173", # Local frontend
        "capacitor://localhost",
        "ionic://localhost"
    ]
    # Origin regex removed - the explicit allowed_origins list above is sufficient.
    # A wildcard regex combined with allow_credentials=True allows any website
    # to make authenticated cross-origin requests, which is a critical security risk.
    allowed_origin_regex: Optional[str] = None
    
    class Config:
        env_file = ".env"

settings = Settings()
