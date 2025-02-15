from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
from bson import ObjectId
import os

class Database:
    client: AsyncIOMotorClient = None
    db = None

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