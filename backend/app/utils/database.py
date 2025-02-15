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