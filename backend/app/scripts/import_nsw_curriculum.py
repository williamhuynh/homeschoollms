#!/usr/bin/env python3
"""
Script to import NSW curriculum data into MongoDB.
This script imports stages, subjects, and learning outcomes from a JSON file.
"""

import asyncio
import json
import os
import sys
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Dict, List, Any

# Add the parent directory to the path so we can import the app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.models.schemas.subject import Subject
from app.models.schemas.learning_outcome import LearningOutcome
from app.utils.database_utils import Database

# Path to the JSON file containing the curriculum data
CURRICULUM_FILE = "nsw_curriculum.json"

async def import_curriculum():
    """Import the NSW curriculum data into MongoDB."""
    print("Starting NSW curriculum import...")
    
    # Load the curriculum data from the JSON file
    try:
        with open(CURRICULUM_FILE, 'r') as f:
            curriculum_data = json.load(f)
    except FileNotFoundError:
        print(f"Error: Curriculum file '{CURRICULUM_FILE}' not found.")
        return
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON in curriculum file '{CURRICULUM_FILE}'.")
        return
    
    # Get the database connection
    db = Database.get_db()
    
    # Dictionary to store subject IDs for reference when creating learning outcomes
    subject_ids = {}
    
    # Process each stage
    for stage_data in curriculum_data:
        stage = stage_data["stage"]
        print(f"Processing stage: {stage}")
        
        # Process each subject in the stage
        for subject_data in stage_data["subjects"]:
            # Create the subject
            subject_dict = {
                "name": subject_data["name"],
                "code": subject_data["code"],
                "description": subject_data["description"],
                "grade_levels": [stage],
                "is_standard": True
            }
            
            # Check if subject already exists
            existing_subject = await db.subjects.find_one({
                "code": subject_dict["code"],
                "organization_id": None
            })
            
            if existing_subject:
                # Update the existing subject to add the current grade level if not already present
                if stage not in existing_subject.get("grade_levels", []):
                    await db.subjects.update_one(
                        {"_id": existing_subject["_id"]},
                        {"$addToSet": {"grade_levels": stage}}
                    )
                subject_id = existing_subject["_id"]
                print(f"  Updated existing subject: {subject_dict['name']} ({subject_dict['code']})")
            else:
                # Insert the new subject
                result = await db.subjects.insert_one(subject_dict)
                subject_id = result.inserted_id
                print(f"  Created new subject: {subject_dict['name']} ({subject_dict['code']})")
            
            # Store the subject ID for reference
            subject_key = f"{subject_dict['code']}_{stage}"
            subject_ids[subject_key] = subject_id
            
            # Process each learning outcome for the subject
            for outcome_data in subject_data["outcomes"]:
                # Create the learning outcome
                outcome_dict = {
                    "name": outcome_data["name"],
                    "description": outcome_data["description"],
                    "subject_id": subject_id,
                    "grade_level": stage,
                    "code": outcome_data["code"],
                    "is_standard": True,
                    "difficulty_level": 1,
                    "prerequisites": []
                }
                
                # Check if learning outcome already exists
                existing_outcome = await db.learning_outcomes.find_one({
                    "code": outcome_dict["code"],
                    "subject_id": subject_id,
                    "organization_id": None
                })
                
                if existing_outcome:
                    # Update the existing learning outcome
                    await db.learning_outcomes.update_one(
                        {"_id": existing_outcome["_id"]},
                        {"$set": {
                            "name": outcome_dict["name"],
                            "description": outcome_dict["description"],
                            "grade_level": outcome_dict["grade_level"]
                        }}
                    )
                    print(f"    Updated existing learning outcome: {outcome_dict['code']} - {outcome_dict['name']}")
                else:
                    # Insert the new learning outcome
                    result = await db.learning_outcomes.insert_one(outcome_dict)
                    print(f"    Created new learning outcome: {outcome_dict['code']} - {outcome_dict['name']}")
    
    print("NSW curriculum import completed successfully.")

async def main():
    """Main function to run the import."""
    try:
        await import_curriculum()
    finally:
        # Close the database connection
        await Database.close_db()

if __name__ == "__main__":
    # Run the import
    asyncio.run(main())
