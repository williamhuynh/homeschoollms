from fastapi import FastAPI
from .config.api_description import API_DESCRIPTION, TAGS_METADATA
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from .config.settings import settings  # Add this import
from .routes import (
    auth,
    user_routes, 
    student_routes, 
    content_routes, 
    progress_routes,
    subject_routes,
    learning_outcome_routes
)

import os

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Homeschool LMS API",
    description=API_DESCRIPTION,
    version="1.0.0",
    openapi_tags=TAGS_METADATA,
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(user_routes.router, prefix="/api", tags=["users"])
app.include_router(student_routes.router, prefix="/api", tags=["students"])
app.include_router(content_routes.router, prefix="/api", tags=["content"])
app.include_router(progress_routes.router, prefix="/api", tags=["progress"])
app.include_router(subject_routes.router, prefix="/api", tags=["subjects"])
app.include_router(learning_outcome_routes.router, prefix="/api", tags=["learning-outcomes"])


# Add error handlers
app.add_exception_handler(HTTPException, http_error_handler)
app.add_exception_handler(InvalidId, invalid_object_id_handler)


@app.on_event("startup")
async def startup_db_client():
    app.mongodb_client = AsyncIOMotorClient(settings.mongodb_url)  # Use settings here too
    app.mongodb = app.mongodb_client.homeschool_lms

@app.get("/health")
async def health_check():
    try:
        await app.mongodb.command("ping")
        return {
            "status": "healthy",
            "database": "connected"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": str(e)
        }
    
@app.on_event("shutdown")
async def shutdown_db_client():
    await Database.close_db()