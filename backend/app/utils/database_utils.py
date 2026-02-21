from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
from bson import ObjectId
import os

class Database:
    client: AsyncIOMotorClient = None
    db = None

    @classmethod
    def initialize(cls, db):
        """Initialize the database connection with an existing database instance."""
        cls.db = db
        cls.client = db.client

    @classmethod
    def get_db(cls):
        if not cls.client:
            cls.client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
            cls.db = cls.client.homeschool_lms
        return cls.db

    @classmethod
    async def close_db(cls):
        if cls.client:
            cls.client.close()

    @classmethod
    async def create_indexes(cls):
        db = cls.get_db()
        
        # Users collection
        await db.users.create_index("email", unique=True)
        await db.users.create_index("organization_id")
        await db.users.create_index("family_id")
        
        # Students collection
        await db.students.create_index([("organization_id", 1), ("family_id", 1)])
        await db.students.create_index("parent_ids")
        await db.students.create_index("active_subjects")
        
        # Subjects collection
        await db.subjects.create_index([("code", 1), ("organization_id", 1)], unique=True)
        
        # Learning Outcomes collection
        await db.learning_outcomes.create_index([
            ("code", 1), 
            ("subject_id", 1), 
            ("organization_id", 1)
        ], unique=True)
        
        # Content collection
        await db.content.create_index([("subject_id", 1), ("organization_id", 1)])
        await db.content.create_index("learning_outcome_ids")
        
        # Progress collection
        await db.progress.create_index([
            ("student_id", 1), 
            ("content_id", 1)
        ], unique=True)
        
        # Student Reports collection
        await db.student_reports.create_index([("student_id", 1), ("created_at", -1)])
        await db.student_reports.create_index([
            ("student_id", 1),
            ("grade_level", 1)
        ], unique=True)
        await db.student_reports.create_index("status")

# Make sure to export the Database class
__all__ = ['Database']
