"""
Script to migrate existing users from MongoDB to Supabase.

This script:
1. Fetches all users from MongoDB
2. Creates corresponding users in Supabase
3. Updates MongoDB users with their Supabase IDs

Usage:
    python -m backend.app.scripts.migrate_users_to_supabase

Environment variables required:
    - MONGODB_URL: MongoDB connection string
    - SUPABASE_URL: Supabase project URL
    - SUPABASE_SERVICE_KEY: Supabase service key
"""

import asyncio
import httpx
import os
import sys
from typing import Dict, Any, List
import json
from datetime import datetime

# Add the parent directory to the path so we can import from the app
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.utils.database_utils import Database
from app.config.settings import settings

async def get_all_users_from_mongodb():
    """Fetch all users from MongoDB"""
    db = Database.get_db()
    users = await db.users.find({}).to_list(length=None)
    return users

async def create_user_in_supabase(user: Dict[str, Any], supabase_url: str, service_key: str):
    """Create a user in Supabase Auth"""
    try:
        # Prepare user data for Supabase
        user_data = {
            "email": user["email"],
            "password": "TemporaryPassword123!",  # Temporary password, users will need to reset
            "email_confirm": True,  # Skip email confirmation
            "user_metadata": {
                "first_name": user.get("first_name", ""),
                "last_name": user.get("last_name", ""),
                "role": user.get("role", "parent"),
                "mongodb_id": str(user["_id"])
            }
        }
        
        # Create user in Supabase
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{supabase_url}/auth/v1/admin/users",
                headers={
                    "Authorization": f"Bearer {service_key}",
                    "apikey": service_key,
                    "Content-Type": "application/json"
                },
                json=user_data
            )
            
            if response.status_code != 200 and response.status_code != 201:
                print(f"Error creating user {user['email']} in Supabase: {response.status_code} {response.text}")
                return None
            
            supabase_user = response.json()
            return supabase_user
    except Exception as e:
        print(f"Exception creating user {user['email']} in Supabase: {e}")
        return None

async def update_user_in_mongodb(user_id, supabase_id):
    """Update MongoDB user with Supabase ID"""
    db = Database.get_db()
    result = await db.users.update_one(
        {"_id": user_id},
        {"$set": {"supabase_id": supabase_id}}
    )
    return result.modified_count > 0

async def migrate_users():
    """Main migration function"""
    # Check required environment variables
    if not settings.mongodb_url:
        print("MONGODB_URL environment variable is required")
        return
    
    if not settings.supabase_url or not settings.supabase_service_key:
        print("SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required")
        return
    
    # Get all users from MongoDB
    print("Fetching users from MongoDB...")
    users = await get_all_users_from_mongodb()
    print(f"Found {len(users)} users in MongoDB")
    
    # Migrate each user to Supabase
    successful_migrations = 0
    failed_migrations = 0
    already_migrated = 0
    
    for user in users:
        # Skip users that already have a Supabase ID
        if "supabase_id" in user and user["supabase_id"]:
            print(f"User {user['email']} already migrated, skipping")
            already_migrated += 1
            continue
        
        print(f"Migrating user {user['email']}...")
        
        # Create user in Supabase
        supabase_user = await create_user_in_supabase(
            user, 
            settings.supabase_url, 
            settings.supabase_service_key
        )
        
        if not supabase_user:
            print(f"Failed to create user {user['email']} in Supabase")
            failed_migrations += 1
            continue
        
        # Update MongoDB user with Supabase ID
        supabase_id = supabase_user.get("id")
        if not supabase_id:
            print(f"No ID in Supabase response for user {user['email']}")
            failed_migrations += 1
            continue
        
        updated = await update_user_in_mongodb(user["_id"], supabase_id)
        if updated:
            print(f"Successfully migrated user {user['email']}")
            successful_migrations += 1
        else:
            print(f"Failed to update MongoDB user {user['email']}")
            failed_migrations += 1
    
    # Print summary
    print("\nMigration Summary:")
    print(f"Total users: {len(users)}")
    print(f"Already migrated: {already_migrated}")
    print(f"Successfully migrated: {successful_migrations}")
    print(f"Failed migrations: {failed_migrations}")
    
    # Instructions for users
    print("\nNext Steps:")
    print("1. Users will need to reset their passwords to use Supabase authentication")
    print("2. You can send password reset emails to users through the Supabase dashboard")
    print("3. Update your frontend to use Supabase authentication")

if __name__ == "__main__":
    asyncio.run(migrate_users())
