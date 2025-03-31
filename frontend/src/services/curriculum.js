export class NSWCurriculum {
  constructor(jsonFile) {
    this.data = this._loadCurriculum(jsonFile);
  }

  async _loadCurriculum() {
    try {
      const response = await fetch('/nsw_curriculum.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      throw new Error(`Failed to load curriculum: ${err.message}`);
    }
  }

  getStages() {
    return this.data.map(stage => stage.stage);
  }

  getSubjects(stage) {
    const stageData = this.data.find(s => s.stage === stage);
    return stageData ? stageData.subjects : [];
  }

  getOutcomes(stage, subjectCode) {
    const subject = this.getSubjects(stage).find(s => s.code === subjectCode);
    return subject ? subject.outcomes : [];
  }
}
