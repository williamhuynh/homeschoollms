#!/usr/bin/env python3
"""
Script to set a user as super_admin by email.

Usage:
    python scripts/set_super_admin.py william.huynh12@gmail.com

This script:
1. Connects to the database
2. Finds the user by email
3. Updates their role to 'super_admin'
"""

import asyncio
import sys
import os

# Add the parent directory to the path so we can import from app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


async def set_super_admin(email: str):
    """Set a user as super_admin by email."""
    
    mongodb_url = os.getenv("MONGODB_URL")
    if not mongodb_url:
        print("ERROR: MONGODB_URL environment variable not set")
        sys.exit(1)
    
    print(f"Connecting to database...")
    client = AsyncIOMotorClient(mongodb_url)
    db = client.homeschool_lms
    
    try:
        # Find the user
        user = await db.users.find_one({"email": email.lower()})
        
        if not user:
            print(f"ERROR: User with email '{email}' not found")
            # List existing users for debugging
            print("\nExisting users in database:")
            async for u in db.users.find({}, {"email": 1, "role": 1}):
                print(f"  - {u.get('email')} (role: {u.get('role', 'parent')})")
            sys.exit(1)
        
        current_role = user.get("role", "parent")
        print(f"Found user: {user.get('first_name')} {user.get('last_name')}")
        print(f"Current role: {current_role}")
        
        if current_role == "super_admin":
            print("User is already a super_admin. No changes needed.")
            return
        
        # Update the role
        result = await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"role": "super_admin"}}
        )
        
        if result.modified_count > 0:
            print(f"SUCCESS: User '{email}' has been set as super_admin")
        else:
            print("WARNING: No changes were made (user may already have this role)")
        
        # Verify the change
        updated_user = await db.users.find_one({"_id": user["_id"]})
        print(f"Verified role: {updated_user.get('role')}")
        
    finally:
        client.close()


async def list_super_admins():
    """List all super_admin users."""
    
    mongodb_url = os.getenv("MONGODB_URL")
    if not mongodb_url:
        print("ERROR: MONGODB_URL environment variable not set")
        sys.exit(1)
    
    client = AsyncIOMotorClient(mongodb_url)
    db = client.homeschool_lms
    
    try:
        print("Super Admins in the system:")
        print("-" * 50)
        count = 0
        async for user in db.users.find({"role": "super_admin"}):
            count += 1
            print(f"  {user.get('email')} - {user.get('first_name')} {user.get('last_name')}")
        
        if count == 0:
            print("  (none)")
        print("-" * 50)
        print(f"Total: {count} super admin(s)")
        
    finally:
        client.close()


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python scripts/set_super_admin.py <email>     - Set user as super_admin")
        print("  python scripts/set_super_admin.py --list      - List all super_admins")
        sys.exit(1)
    
    arg = sys.argv[1]
    
    if arg == "--list":
        asyncio.run(list_super_admins())
    else:
        email = arg
        asyncio.run(set_super_admin(email))


if __name__ == "__main__":
    main()
