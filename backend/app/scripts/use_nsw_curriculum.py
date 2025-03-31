import json
from typing import Dict, List

class NSWCurriculum:
    def __init__(self, json_file: str):
        self.data = self._load_curriculum(json_file)
        
    def _load_curriculum(self, json_file: str) -> List[Dict]:
        """Load the curriculum data from JSON file"""
        try:
            with open(json_file, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            raise FileNotFoundError(f"Curriculum file '{json_file}' not found")
        except json.JSONDecodeError:
            raise ValueError(f"Invalid JSON in curriculum file '{json_file}'")

    def get_stages(self) -> List[str]:
        """Get list of all stages in the curriculum"""
        return [stage['stage'] for stage in self.data]

    def get_subjects(self, stage: str) -> List[Dict]:
        """Get subjects for a specific stage"""
        for stage_data in self.data:
            if stage_data['stage'] == stage:
                return stage_data['subjects']
        return []

    def get_outcomes(self, stage: str, subject_code: str) -> List[Dict]:
        """Get learning outcomes for a specific subject in a stage"""
        subjects = self.get_subjects(stage)
        for subject in subjects:
            if subject['code'] == subject_code:
                return subject['outcomes']
        return []

# Example usage
if __name__ == "__main__":
    curriculum = NSWCurriculum("backend/nsw_curriculum.json")
    print("Stages:", curriculum.get_stages())
    print("Early Stage 1 Subjects:", [s['name'] for s in curriculum.get_subjects("Early Stage 1")])
