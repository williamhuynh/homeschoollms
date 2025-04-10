from fastapi import FastAPI, HTTPException
from .config.api_description import API_DESCRIPTION, TAGS_METADATA
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from .config.settings import settings  # Add this import
from .models.schemas.student import AccessLevel, ParentAccess
from bson import ObjectId
import logging
from datetime import datetime
from .routes import (
    auth,
    user_routes, 
    student_routes, 
    content_routes, 
    progress_routes,
    subject_routes,
    learning_outcome_routes,
    ai_routes # Add import for AI routes
)
from bson.errors import InvalidId
from .utils.error_handlers import http_error_handler, invalid_object_id_handler
from .utils.database_utils import Database

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
    expose_headers=["Location"]  # Add this to expose redirect headers
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(user_routes.router, prefix="/api", tags=["users"])
app.include_router(student_routes.router, prefix="/api", tags=["students"])
app.include_router(content_routes.router, prefix="/api", tags=["content"])
app.include_router(progress_routes.router, prefix="/api", tags=["progress"])
app.include_router(subject_routes.router, prefix="/api", tags=["subjects"])
app.include_router(learning_outcome_routes.router, prefix="/api", tags=["learning-outcomes"])
app.include_router(ai_routes.router, prefix="/api/v1/ai", tags=["ai"]) # Include the AI router with correct prefix


# Add error handlers
app.add_exception_handler(HTTPException, http_error_handler)
app.add_exception_handler(InvalidId, invalid_object_id_handler)


@app.on_event("startup")
async def startup_db_client():
    app.mongodb_client = AsyncIOMotorClient(settings.mongodb_url)  # Use settings here too
    app.mongodb = app.mongodb_client.homeschool_lms
    
    # Initialize the database connection for Database utility
    Database.initialize(app.mongodb)
    
    # Run the parent access migration
    await migrate_parent_access()

async def migrate_parent_access():
    """
    Migrate existing students to use the new parent_access field.
    This function will:
    1. Check if migration has already been run
    2. Find all students in the database
    3. For each student, create parent_access entries based on the existing parent_ids
    4. Set all existing parents to have admin access level
    5. Mark migration as complete
    """
    try:
        logging.info("Checking if parent access migration is needed...")
        db = Database.get_db()
        
        # Check if migration has already been run by looking for a flag in the database
        migration_status = await db.migration_status.find_one({"name": "parent_access_migration"})
        if migration_status and migration_status.get("completed", False):
            logging.info("Parent access migration has already been run. Skipping.")
            return
            
        # Get all students
        students = []
        async for student in db.students.find():
            students.append(student)
        
        logging.info(f"Found {len(students)} students to migrate")
        
        # Process each student
        for student in students:
            student_id = student["_id"]
            parent_ids = student.get("parent_ids", [])
            existing_parent_access = student.get("parent_access", [])
            
            # Skip if student already has parent_access entries for all parent_ids
            if existing_parent_access and len(existing_parent_access) >= len(parent_ids):
                existing_parent_ids = [access["parent_id"] for access in existing_parent_access]
                if all(parent_id in existing_parent_ids for parent_id in parent_ids):
                    logging.info(f"Student {student_id} already has parent_access entries for all parent_ids. Skipping.")
                    continue
            
            # Create parent_access entries for each parent_id
            parent_access_entries = []
            for parent_id in parent_ids:
                # Check if this parent already has an entry in parent_access
                if existing_parent_access and any(access["parent_id"] == parent_id for access in existing_parent_access):
                    continue
                    
                # Create a new parent_access entry with admin access
                parent_access = {
                    "parent_id": parent_id,
                    "access_level": AccessLevel.ADMIN
                }
                parent_access_entries.append(parent_access)
            
            if parent_access_entries:
                # Update the student with the new parent_access entries
                result = await db.students.update_one(
                    {"_id": student_id},
                    {"$push": {"parent_access": {"$each": parent_access_entries}}}
                )
                logging.info(f"Updated student {student_id}: Added {len(parent_access_entries)} parent_access entries. Modified: {result.modified_count}")
            else:
                logging.info(f"No new parent_access entries needed for student {student_id}")
        
        logging.info("Parent access migration completed successfully!")
        
        # Mark migration as complete
        await db.migration_status.update_one(
            {"name": "parent_access_migration"},
            {"$set": {"completed": True, "completed_at": datetime.now().isoformat()}},
            upsert=True
        )
    except Exception as e:
        logging.error(f"Error during parent access migration: {str(e)}")

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
