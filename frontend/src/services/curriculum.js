import { logger } from '../utils/logger';

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
      logger.warn('IndexedDB not supported. Offline curriculum will not be available.');
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
          logger.debug('Curriculum IndexedDB initialized');
          resolve(true);
        };
        
        request.onerror = (event) => {
          logger.error('Error initializing curriculum IndexedDB', event.target.error);
          reject(event.target.error);
        };
      });
      
      return await dbPromise;
    } catch (err) {
      logger.error('Failed to initialize IndexedDB', err);
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
          logger.debug(`Loaded ${stage} from IndexedDB`);
          this.data[stage] = stageData;
          this.isLoading[stage] = false;
          return stageData;
        }
      }
      
      // If not in DB or DB not available, fetch from network
      logger.debug(`Fetching ${stage} from network`);
      const filePath = this.getFilePath(stage);
      
      const response = await fetch(filePath);
      const contentType = response.headers.get('content-type');
      
      if (!response.ok) {
        logger.error(`Curriculum fetch failed with status ${response.status}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Check if response is actually JSON
      if (!contentType || !contentType.includes('application/json')) {
        logger.error(`Expected JSON but got ${contentType}`);
        throw new Error(`Invalid response format: expected JSON, got ${contentType || 'unknown type'}`);
      }
      
      stageData = await response.json();
      
      // Store the stage data
      this.data[stage] = stageData;
      
      // Save to IndexedDB if available
      if (dbInitialized && this.db) {
        await this.saveToDB(stage, stageData);
        logger.debug(`Saved ${stage} to IndexedDB`);
      }
      
      return stageData;
    } catch (err) {
      // If network error and we're offline, provide clearer message
      const isOffline = !navigator.onLine;
      const errorMessage = isOffline && !err.message.includes('offline') 
        ? 'You are offline and curriculum data is not available locally' 
        : err.message;
        
      logger.error(`Failed to load curriculum for ${stage}`, { errorMessage });
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
          logger.warn('Error reading from IndexedDB');
          resolve(null); // Resolve with null on error to allow fallback
        };
      } catch (err) {
        logger.warn('Error accessing IndexedDB');
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
          logger.warn('Error writing to IndexedDB');
          resolve(); // Resolve anyway to prevent blocking
        };
      } catch (err) {
        logger.warn('Error accessing IndexedDB for writing');
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
      logger.error(`Error getting subjects for ${grade}`, err);
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
      logger.error(`Error getting outcomes for ${stage}/${subjectCode}`, err);
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
      logger.warn('IndexedDB not ready, cannot clear cache.');
      return;
    }
    const dbInitialized = await this.dbReady;
    if (!dbInitialized || !this.db) {
      logger.warn('IndexedDB not available, cannot clear cache.');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(['stages'], 'readwrite');
        const store = transaction.objectStore('stages');
        const request = store.clear(); // Clear all entries in the store

        request.onsuccess = () => {
          logger.debug('Curriculum IndexedDB cache cleared.');
          // Also clear the in-memory cache
          this.data = {};
          resolve();
        };
        request.onerror = () => {
          logger.error('Error clearing IndexedDB cache', request.error);
          reject(request.error);
        };
      } catch (err) {
        logger.error('Error accessing IndexedDB for clearing', err);
        reject(err);
      }
    });
  }
}

export const curriculumService = new NSWCurriculum();
