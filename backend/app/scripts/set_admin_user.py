#!/usr/bin/env python3
"""
One-time script to set a user as an admin in the system.
Run this script to grant admin privileges to a user by email.

Usage:
    python -m app.scripts.set_admin_user
"""

import asyncio
import sys
import os

# Add the parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.utils.database_utils import Database
from app.models.schemas.user import UserInDB
from bson import ObjectId

async def set_admin_user(email: str):
    """
    Set a user as admin by email.
    
    Args:
        email: The email address of the user to make admin
    """
    print(f"Setting user {email} as admin...")
    
    # Get database connection
    db = Database.get_db()
    
    # Find the user
    user = await db.users.find_one({"email": email})
    if not user:
        print(f"Error: User with email {email} not found.")
        return False
    
    # Update the user's role
    result = await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"role": "admin"}}
    )
    
    if result.modified_count > 0:
        print(f"Successfully set user {email} as admin.")
        
        # Display the updated user
        updated_user = await db.users.find_one({"_id": user["_id"]})
        print(f"User details:")
        print(f"  ID: {updated_user['_id']}")
        print(f"  Email: {updated_user['email']}")
        print(f"  Name: {updated_user.get('first_name', '')} {updated_user.get('last_name', '')}")
        print(f"  Role: {updated_user['role']}")
        return True
    else:
        print(f"User was not updated. They may already be an admin.")
        return False

async def main():
    """Main function to run the script."""
    # You can change this email or make it a command line argument
    admin_email = "william.huynh12@gmail.com"
    await set_admin_user(admin_email)

if __name__ == "__main__":
    # Initialize the database connection
    Database.initialize()
    
    # Run the async function
    asyncio.run(main()) 