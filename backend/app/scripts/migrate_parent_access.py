"""
Migration script to update existing students to use the new parent_access field.
This script will:
1. Find all students in the database
2. For each student, create parent_access entries based on the existing parent_ids
3. Set all existing parents to have admin access level
"""

import asyncio
import sys
import os
from bson import ObjectId

# Add the parent directory to the path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.utils.database_utils import Database
from app.models.schemas.student import AccessLevel, ParentAccess

async def migrate_parent_access():
    print("Starting parent access migration...")
    db = Database.get_db()
    
    # Get all students
    students = []
    async for student in db.students.find():
        students.append(student)
    
    print(f"Found {len(students)} students to migrate")
    
    # Process each student
    for student in students:
        student_id = student["_id"]
        parent_ids = student.get("parent_ids", [])
        existing_parent_access = student.get("parent_access", [])
        
        # Skip if student already has parent_access entries for all parent_ids
        if existing_parent_access and len(existing_parent_access) >= len(parent_ids):
            existing_parent_ids = [access["parent_id"] for access in existing_parent_access]
            if all(parent_id in existing_parent_ids for parent_id in parent_ids):
                print(f"Student {student_id} already has parent_access entries for all parent_ids. Skipping.")
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
            print(f"Updated student {student_id}: Added {len(parent_access_entries)} parent_access entries. Modified: {result.modified_count}")
        else:
            print(f"No new parent_access entries needed for student {student_id}")
    
    print("Parent access migration completed successfully!")

if __name__ == "__main__":
    # Run the migration
    asyncio.run(migrate_parent_access())
