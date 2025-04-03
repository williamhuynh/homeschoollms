let curriculumInstance = null;

export class NSWCurriculum {
  constructor() {
    if (!curriculumInstance) {
      this.data = null;
      this.isLoading = false;
      curriculumInstance = this;
    }
    return curriculumInstance;
  }

  async load() {
    if (this.data || this.isLoading) return;
    
    this.isLoading = true;
    try {
      const response = await fetch('/nsw_curriculum.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      this.data = await response.json();
    } catch (err) {
      throw new Error(`Failed to load curriculum: ${err.message}`);
    } finally {
      this.isLoading = false;
    }
  }

  getStages() {
    if (!this.data) {
      throw new Error('Curriculum data not loaded');
    }
    return this.data.map(stage => stage.stage);
  }

  getStageForGrade(grade) {
    const gradeMapping = {
      'K': 'Early Stage 1',
      'Kindergarten': 'Early Stage 1',
      'Year 1': 'Stage 1',
      'Year 2': 'Stage 1',
      'Year 3': 'Stage 2',
      'Year 4': 'Stage 2'
    };
    return gradeMapping[grade] || null;
  }

  getSubjects(grade) {
    if (!this.data) {
      throw new Error('Curriculum data not loaded');
    }
    const stage = this.getStageForGrade(grade);
    if (!stage) {
      return [];
    }
    return this.data.find(s => s.stage === stage)?.subjects || [];
  }

  getOutcomes(stage, subjectCode) {
    if (!this.data) {
      throw new Error('Curriculum data not loaded');
    }
    const stageData = this.data.find(s => s.stage === stage);
    if (!stageData) {
      return [];
    }
    const subject = stageData.subjects.find(s => s.code === subjectCode);
    return subject ? subject.outcomes : [];
  }

}

export const curriculumService = new NSWCurriculum();
