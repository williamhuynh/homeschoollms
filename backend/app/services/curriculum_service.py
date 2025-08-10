"""
Curriculum service for loading NSW curriculum data.
"""
import json
import os
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)

class CurriculumService:
    """Service for loading and managing curriculum data."""
    
    _instance = None
    _curriculum_cache = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(CurriculumService, cls).__new__(cls)
        return cls._instance
    
    @staticmethod
    def get_stage_for_grade(grade_level: str) -> str:
        """Map grade level to curriculum stage."""
        grade_to_stage = {
            "Kindergarten": "early-stage-1",
            "K": "early-stage-1",  # Handle K abbreviation
            "Year 1": "stage-1",
            "Year 2": "stage-1", 
            "Year 3": "stage-2",
            "Year 4": "stage-2",
            "Year 5": "stage-3",
            "Year 6": "stage-3",
            "Year 7": "stage-4",
            "Year 8": "stage-4",
            "Year 9": "stage-5",
            "Year 10": "stage-5",
            "Year 11": "stage-6",
            "Year 12": "stage-6",
            "11": "stage-6",
            "12": "stage-6",
        }
        
        stage = grade_to_stage.get(grade_level)
        if not stage:
            # Try a few normalized keys
            normalized = str(grade_level).strip()
            stage = grade_to_stage.get(normalized)
        if not stage:
            logger.warning(f"Unknown grade level '{grade_level}'. Defaulting to 'stage-1'.")
            stage = "stage-1"
        logger.info(f"Mapped grade level '{grade_level}' to stage: {stage}")
        return stage
    
    @staticmethod
    def _find_curriculum_file(stage: str) -> Optional[str]:
        """Find curriculum file with multiple fallback locations."""
        filename = f"{stage}-curriculum.json"
        
        # Possible locations to check (relative to project root)
        possible_paths = [
            f"frontend/public/curriculum/{filename}",  # Original location
            f"../frontend/public/curriculum/{filename}",  # If backend is in subfolder
            f"curriculum/{filename}",  # If copied to backend
            f"app/curriculum/{filename}",  # Backend subfolder
        ]
        
        logger.info(f"Looking for curriculum file: {filename}")
        logger.info(f"Current working directory: {os.getcwd()}")
        
        for path in possible_paths:
            if os.path.exists(path):
                logger.info(f"Found curriculum file at: {path}")
                return path
                
        # Log directory contents for debugging
        logger.error(f"Could not find {filename} in any of these locations:")
        for path in possible_paths:
            directory = os.path.dirname(path)
            if os.path.exists(directory):
                files = os.listdir(directory)
                logger.error(f"  {directory}: {files}")
            else:
                logger.error(f"  {directory}: Directory does not exist")
                
        return None
    
    @staticmethod
    async def load_curriculum(grade_level: str) -> Dict:
        """Load curriculum data for a specific grade level."""
        stage = CurriculumService.get_stage_for_grade(grade_level)
        
        # Check cache first
        if stage in CurriculumService._curriculum_cache:
            logger.info(f"Returning cached curriculum for stage: {stage}")
            return CurriculumService._curriculum_cache[stage]
        
        # Find the curriculum file
        curriculum_path = CurriculumService._find_curriculum_file(stage)
        
        if not curriculum_path:
            logger.error(f"No curriculum file found for stage: {stage}")
            return {
                "stage": stage,
                "subjects": []
            }
        
        try:
            with open(curriculum_path, 'r', encoding='utf-8') as f:
                curriculum_data = json.load(f)
                
            logger.info(f"Successfully loaded curriculum for {stage}: {len(curriculum_data.get('subjects', []))} subjects")
            
            # Cache the data
            CurriculumService._curriculum_cache[stage] = curriculum_data
            
            return curriculum_data
            
        except Exception as e:
            logger.error(f"Failed to load curriculum from {curriculum_path}: {str(e)}", exc_info=True)
            return {
                "stage": stage,
                "subjects": []
            }
    
    @staticmethod
    async def get_subjects(grade_level: str) -> List[Dict]:
        """Get all subjects for a grade level."""
        curriculum = await CurriculumService.load_curriculum(grade_level)
        return curriculum.get("subjects", [])
    
    @staticmethod
    async def get_subject_by_code(grade_level: str, subject_code: str) -> Optional[Dict]:
        """Get a specific subject by code."""
        subjects = await CurriculumService.get_subjects(grade_level)
        for subject in subjects:
            if subject.get("code") == subject_code:
                return subject
        return None 