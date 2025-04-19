let curriculumInstance = null;

export class NSWCurriculum {
  constructor() {
    if (!curriculumInstance) {
      this.data = {};  // Changed from null to an object to store multiple stages
      this.isLoading = {};  // Track loading status per stage
      curriculumInstance = this;
    }
    return curriculumInstance;
  }

  getFilePath(stage) {
    // Convert stage name to filename format
    const stageKey = stage.toLowerCase().replace(/\s+/g, '-');
    return `/curriculum/${stageKey}-curriculum.json`;
  }

  async load(stage) {
    // If no stage provided, return
    if (!stage) return;
    
    // If data for this stage is already loaded or currently loading, return
    if (this.data[stage] || this.isLoading[stage]) return;
    
    this.isLoading[stage] = true;
    try {
      const filePath = this.getFilePath(stage);
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const stageData = await response.json();
      
      // Store the stage data
      this.data[stage] = stageData;
    } catch (err) {
      console.error(`Failed to load curriculum for ${stage}: ${err.message}`);
      throw new Error(`Failed to load curriculum for ${stage}: ${err.message}`);
    } finally {
      this.isLoading[stage] = false;
    }
  }

  // Legacy method to support transition - loads all currently known stages
  async loadAll() {
    const knownStages = [
      'Early Stage 1'
      // Add other stages as they become available
    ];
    
    for (const stage of knownStages) {
      await this.load(stage);
    }
  }

  getStages() {
    const knownStages = [
      'Early Stage 1',
      'Stage 1',
      'Stage 2',
      'Stage 3',
      'Stage 4',
      'Stage 5',
      'Stage 6'
    ];
    
    // Return all known stages, not just loaded ones
    return knownStages;
  }

  getStageForGrade(grade) {
    const gradeMapping = {
      'K': 'Early Stage 1',
      'Kindergarten': 'Early Stage 1',
      'Year 1': 'Stage 1',
      'Year 2': 'Stage 1',
      'Year 3': 'Stage 2',
      'Year 4': 'Stage 2',
      'Year 5': 'Stage 3',
      'Year 6': 'Stage 3',
      'Year 7': 'Stage 4',
      'Year 8': 'Stage 4',
      'Year 9': 'Stage 5',
      'Year 10': 'Stage 5',
      'Year 11': 'Stage 6',
      'Year 12': 'Stage 6'
    };
    return gradeMapping[grade] || null;
  }

  async getSubjects(grade) {
    const stage = this.getStageForGrade(grade);
    if (!stage) {
      return [];
    }
    
    // Ensure stage data is loaded
    await this.load(stage);
    
    if (!this.data[stage]) {
      return [];
    }
    
    return this.data[stage].subjects || [];
  }

  async getOutcomes(stage, subjectCode) {
    // Ensure stage data is loaded
    await this.load(stage);
    
    if (!this.data[stage]) {
      return [];
    }
    
    const subject = this.data[stage].subjects.find(s => s.code === subjectCode);
    return subject ? subject.outcomes : [];
  }
}

export const curriculumService = new NSWCurriculum();
