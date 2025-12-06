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
    
    # Sentry settings
    sentry_dsn: Optional[str] = None
    sentry_environment: str = "development"
    sentry_traces_sample_rate: float = 1.0  # 1.0 = 100% of transactions, reduce in production
    
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
        "https://homeschool-lms.vercel.app",  # Production frontend
        "http://localhost:4173", # Local frontend
        "capacitor://localhost",
        "ionic://localhost"
    ]
    # Allow any http/https origin via regex (works with allow_credentials=True)
    # This helps dev on mobile/LAN IPs where the exact origin is unknown.
    allowed_origin_regex: Optional[str] = r"https?://.*"
    
    class Config:
        env_file = ".env"

settings = Settings()
