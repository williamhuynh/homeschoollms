export class NSWCurriculum {
  constructor() {
    this.data = null;
  }

  async load() {
    try {
      const response = await fetch('/nsw_curriculum.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      this.data = await response.json();
    } catch (err) {
      throw new Error(`Failed to load curriculum: ${err.message}`);
    }
  }

  getStages() {
    if (!this.data) {
      throw new Error('Curriculum data not loaded');
    }
    return this.data.map(stage => stage.stage);
  }

  getSubjects(stage) {
    if (!this.data) {
      throw new Error('Curriculum data not loaded');
    }
    const stageData = this.data.find(s => s.stage === stage);
    return stageData ? stageData.subjects : [];
  }

  getOutcomes(stage, subjectCode) {
    if (!this.data) {
      throw new Error('Curriculum data not loaded');
    }
    const subject = this.getSubjects(stage).find(s => s.code === subjectCode);
    return subject ? subject.outcomes : [];
  }
}
