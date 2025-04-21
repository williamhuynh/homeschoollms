let curriculumInstance = null;

export class NSWCurriculum {
  constructor() {
    if (!curriculumInstance) {
      this.data = {};  // Store loaded stages
      this.isLoading = {};  // Track loading status per stage
      this.db = null;  // IndexedDB instance
      this.dbReady = this.initializeDB();  // Promise for DB initialization
      curriculumInstance = this;
    }
    return curriculumInstance;
  }

  async initializeDB() {
    if (!window.indexedDB) {
      console.warn('IndexedDB not supported. Offline curriculum will not be available.');
      return false;
    }

    try {
      // Open (or create) the curriculum database
      const dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open('curriculum-db', 1);
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('stages')) {
            // Create object store for curriculum stages
            db.createObjectStore('stages', { keyPath: 'stage' });
          }
        };
        
        request.onsuccess = (event) => {
          this.db = event.target.result;
          console.log('Curriculum IndexedDB initialized');
          resolve(true);
        };
        
        request.onerror = (event) => {
          console.error('Error initializing curriculum IndexedDB:', event.target.error);
          reject(event.target.error);
        };
      });
      
      return await dbPromise;
    } catch (err) {
      console.error('Failed to initialize IndexedDB:', err);
      return false;
    }
  }

  getFilePath(stage) {
    // Convert stage name to filename format
    const stageKey = stage.toLowerCase().replace(/\s+/g, '-');
    return `/curriculum/${stageKey}-curriculum.json`;
  }

  async load(stage) {
    // If no stage provided, load known stages for backward compatibility
    if (!stage) {
      return this.loadAll();
    }
    
    // If data for this stage is already loaded or currently loading, return
    if (this.data[stage] || this.isLoading[stage]) {
      return this.data[stage];
    }
    
    this.isLoading[stage] = true;
    
    try {
      // First try to get data from IndexedDB
      let stageData = null;
      
      // Wait for DB to be ready
      const dbInitialized = await this.dbReady;
      
      if (dbInitialized && this.db) {
        stageData = await this.getFromDB(stage);
        
        if (stageData) {
          console.log(`Loaded ${stage} from IndexedDB`);
          this.data[stage] = stageData;
          this.isLoading[stage] = false;
          return stageData;
        }
      }
      
      // If not in DB or DB not available, fetch from network
      console.log(`Fetching ${stage} from network`);
      const filePath = this.getFilePath(stage);
      console.log(`Curriculum URL: ${new URL(filePath, window.location.origin).href}`);
      
      const response = await fetch(filePath);
      const contentType = response.headers.get('content-type');
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HTTP error ${response.status}. First 100 chars: ${errorText.substring(0, 100)}...`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Check if response is actually JSON
      if (!contentType || !contentType.includes('application/json')) {
        const errorText = await response.text();
        console.error(`Expected JSON but got ${contentType}. First 100 chars: ${errorText.substring(0, 100)}...`);
        throw new Error(`Invalid response format: expected JSON, got ${contentType || 'unknown type'}`);
      }
      
      stageData = await response.json();
      
      // Store the stage data
      this.data[stage] = stageData;
      
      // Save to IndexedDB if available
      if (dbInitialized && this.db) {
        await this.saveToDB(stage, stageData);
        console.log(`Saved ${stage} to IndexedDB`);
      }
      
      return stageData;
    } catch (err) {
      // If network error and we're offline, provide clearer message
      const isOffline = !navigator.onLine;
      const errorMessage = isOffline && !err.message.includes('offline') 
        ? 'You are offline and curriculum data is not available locally' 
        : err.message;
        
      console.error(`Failed to load curriculum for ${stage}:`, errorMessage);
      throw new Error(`Failed to load curriculum for ${stage}: ${errorMessage}`);
    } finally {
      this.isLoading[stage] = false;
    }
  }

  async getFromDB(stage) {
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(['stages'], 'readonly');
        const store = transaction.objectStore('stages');
        const request = store.get(stage);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          console.error('Error reading from IndexedDB:', request.error);
          resolve(null); // Resolve with null on error to allow fallback
        };
      } catch (err) {
        console.error('Error accessing IndexedDB:', err);
        resolve(null); // Resolve with null on error to allow fallback
      }
    });
  }

  async saveToDB(stage, data) {
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(['stages'], 'readwrite');
        const store = transaction.objectStore('stages');
        const request = store.put(data);
        
        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error('Error writing to IndexedDB:', request.error);
          resolve(); // Resolve anyway to prevent blocking
        };
      } catch (err) {
        console.error('Error accessing IndexedDB for writing:', err);
        resolve(); // Resolve anyway to prevent blocking
      }
    });
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
    
    return Object.values(this.data);
  }

  getStages() {
    // Return all known stages, not just loaded ones
    return [
      'Early Stage 1',
      'Stage 1',
      'Stage 2',
      'Stage 3',
      'Stage 4',
      'Stage 5',
      'Stage 6'
    ];
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
      'Year 12': 'Stage 6',
      '1': 'Stage 1',
      '2': 'Stage 1',
      '3': 'Stage 2',
      '4': 'Stage 2',
      '5': 'Stage 3',
      '6': 'Stage 3',
      '7': 'Stage 4',
      '8': 'Stage 4',
      '9': 'Stage 5',
      '10': 'Stage 5',
      '11': 'Stage 6',
      '12': 'Stage 6'
    };
    return gradeMapping[grade] || null;
  }

  // Hybrid implementation - works both synchronously (backward compatible) and asynchronously
  async getSubjects(grade) {
    const stage = this.getStageForGrade(grade);
    if (!stage) {
      return [];
    }
    
    // If data is already loaded, return immediately
    if (this.data[stage]) {
      return this.data[stage].subjects || [];
    }
    
    // Try to load data
    try {
      const stageData = await this.load(stage);
      return stageData.subjects || [];
    } catch (err) {
      console.error(`Error getting subjects for ${grade}:`, err);
      return []; // Return empty array on error
    }
  }

  // Hybrid implementation - works both synchronously (backward compatible) and asynchronously
  async getOutcomes(stage, subjectCode) {
    // If data is already loaded, return immediately
    if (this.data[stage]) {
      const subject = this.data[stage].subjects.find(s => s.code === subjectCode);
      return subject ? subject.outcomes : [];
    }
    
    // Try to load data
    try {
      const stageData = await this.load(stage);
      const subject = stageData.subjects.find(s => s.code === subjectCode);
      return subject ? subject.outcomes : [];
    } catch (err) {
      console.error(`Error getting outcomes for ${stage}/${subjectCode}:`, err);
      return []; // Return empty array on error
    }
  }
  
  // Check if we're offline
  isOffline() {
    return !navigator.onLine;
  }
  
  // Clear all cached data (useful for development/testing)
  async clearCache() {
    if (!this.dbReady) {
      console.warn('IndexedDB not ready, cannot clear cache.');
      return;
    }
    const dbInitialized = await this.dbReady;
    if (!dbInitialized || !this.db) {
      console.warn('IndexedDB not available, cannot clear cache.');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(['stages'], 'readwrite');
        const store = transaction.objectStore('stages');
        const request = store.clear(); // Clear all entries in the store

        request.onsuccess = () => {
          console.log('Curriculum IndexedDB cache cleared.');
          // Also clear the in-memory cache
          this.data = {};
          resolve();
        };
        request.onerror = () => {
          console.error('Error clearing IndexedDB cache:', request.error);
          reject(request.error);
        };
      } catch (err) {
        console.error('Error accessing IndexedDB for clearing:', err);
        reject(err);
      }
    });
  }
}

export const curriculumService = new NSWCurriculum();
