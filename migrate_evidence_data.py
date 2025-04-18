from pymongo import MongoClient
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def migrate_evidence_data():
    """
    Migrate data from the 'evidence' collection to the 'student_evidence' collection.
    This script will:
    1. Connect to MongoDB
    2. Count documents in both collections
    3. Copy documents from 'evidence' to 'student_evidence' if they don't already exist
    4. Report results
    """
    try:
        # Connect to MongoDB
        client = MongoClient()
        db = client['homeschool-lms']
        
        # Count documents in both collections
        evidence_count = db.evidence.count_documents({})
        student_evidence_count = db.student_evidence.count_documents({})
        
        logger.info(f"Found {evidence_count} documents in 'evidence' collection")
        logger.info(f"Found {student_evidence_count} documents in 'student_evidence' collection")
        
        if evidence_count == 0:
            logger.info("No documents to migrate. Exiting.")
            return
        
        # Get all documents from 'evidence' collection
        evidence_docs = list(db.evidence.find({}))
        logger.info(f"Retrieved {len(evidence_docs)} documents from 'evidence' collection")
        
        # Track migration statistics
        migrated_count = 0
        already_exists_count = 0
        error_count = 0
        
        # Migrate each document
        for doc in evidence_docs:
            try:
                # Check if document already exists in 'student_evidence'
                existing_doc = db.student_evidence.find_one({
                    "student_id": doc.get("student_id"),
                    "file_path": doc.get("file_path")
                })
                
                if existing_doc:
                    logger.info(f"Document already exists in 'student_evidence': {doc.get('_id')}")
                    already_exists_count += 1
                    continue
                
                # Insert document into 'student_evidence'
                result = db.student_evidence.insert_one(doc)
                logger.info(f"Migrated document with ID: {result.inserted_id}")
                migrated_count += 1
                
            except Exception as e:
                logger.error(f"Error migrating document {doc.get('_id')}: {str(e)}")
                error_count += 1
        
        # Report results
        logger.info(f"Migration completed.")
        logger.info(f"Total documents: {len(evidence_docs)}")
        logger.info(f"Successfully migrated: {migrated_count}")
        logger.info(f"Already existed: {already_exists_count}")
        logger.info(f"Failed to migrate: {error_count}")
        
    except Exception as e:
        logger.error(f"Error in migration: {str(e)}")

if __name__ == "__main__":
    migrate_evidence_data() 