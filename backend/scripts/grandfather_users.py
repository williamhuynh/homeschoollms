#!/usr/bin/env python3
"""
Migration script to grandfather existing users.

This script marks all existing users as 'grandfathered', giving them
Basic tier features for free permanently.

Run this script ONCE after deploying the subscription feature to mark
all existing users as grandfathered.

Usage:
    python scripts/grandfather_users.py

Environment variables required:
    MONGODB_URL: MongoDB connection string
"""

import asyncio
import os
import sys
from datetime import datetime

# Add the parent directory to path so we can import from app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()


async def grandfather_existing_users():
    """Mark all existing users as grandfathered."""
    mongodb_url = os.getenv("MONGODB_URL")
    
    if not mongodb_url:
        print("ERROR: MONGODB_URL environment variable not set")
        sys.exit(1)
    
    print(f"Connecting to MongoDB...")
    client = AsyncIOMotorClient(mongodb_url)
    db = client.homeschool_lms
    
    try:
        # Count existing users
        total_users = await db.users.count_documents({})
        print(f"Found {total_users} total users in database")
        
        # Count users already grandfathered
        already_grandfathered = await db.users.count_documents({"is_grandfathered": True})
        print(f"{already_grandfathered} users are already grandfathered")
        
        # Count users to be grandfathered
        to_grandfather = await db.users.count_documents({
            "$or": [
                {"is_grandfathered": {"$ne": True}},
                {"is_grandfathered": {"$exists": False}}
            ]
        })
        print(f"{to_grandfather} users will be grandfathered")
        
        if to_grandfather == 0:
            print("No users need to be grandfathered. Exiting.")
            return
        
        # Ask for confirmation
        response = input(f"\nDo you want to grandfather {to_grandfather} users? (yes/no): ")
        if response.lower() != "yes":
            print("Aborted.")
            return
        
        # Perform the migration
        print("\nGrandfathering users...")
        result = await db.users.update_many(
            {
                "$or": [
                    {"is_grandfathered": {"$ne": True}},
                    {"is_grandfathered": {"$exists": False}}
                ]
            },
            {
                "$set": {
                    "is_grandfathered": True,
                    "subscription_tier": "free",  # Tier stays free, but they get basic limits
                    "subscription_status": "active",
                    "grandfathered_at": datetime.utcnow()
                }
            }
        )
        
        print(f"\n✅ Successfully grandfathered {result.modified_count} users!")
        print("\nThese users will now have access to Basic tier features for free.")
        
        # Log the migration
        await db.system_logs.insert_one({
            "type": "migration",
            "migration_name": "grandfather_existing_users",
            "users_affected": result.modified_count,
            "executed_at": datetime.utcnow(),
            "details": "Marked existing users as grandfathered for Basic tier access"
        })
        
        print("Migration logged to system_logs collection.")
        
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)
    finally:
        client.close()
        print("\nDatabase connection closed.")


if __name__ == "__main__":
    print("=" * 60)
    print("Grandfather Existing Users Migration")
    print("=" * 60)
    print()
    asyncio.run(grandfather_existing_users())
