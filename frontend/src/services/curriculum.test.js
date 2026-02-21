/**
 * Tests for the NSWCurriculum service.
 *
 * Covers grade-to-stage mapping, getFilePath, getStages, and the
 * load / getSubjects / getOutcomes data-flow with a mocked fetch.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NSWCurriculum } from './curriculum'

// Reset singleton between tests so each test gets a fresh instance
let curriculum
beforeEach(() => {
  // Break the singleton cache so we get a fresh instance
  // The module caches via curriculumInstance closure variable, but we can
  // work around it by directly constructing and resetting internal state.
  curriculum = new NSWCurriculum()
  curriculum.data = {}
  curriculum.isLoading = {}
  curriculum.db = null
  curriculum.dbReady = Promise.resolve(false) // disable IndexedDB in tests
})

describe('NSWCurriculum', () => {
  describe('getStageForGrade', () => {
    it('should map Kindergarten to Early Stage 1', () => {
      expect(curriculum.getStageForGrade('K')).toBe('Early Stage 1')
      expect(curriculum.getStageForGrade('Kindergarten')).toBe('Early Stage 1')
    })

    it('should map Year 1-2 to Stage 1', () => {
      expect(curriculum.getStageForGrade('Year 1')).toBe('Stage 1')
      expect(curriculum.getStageForGrade('Year 2')).toBe('Stage 1')
      expect(curriculum.getStageForGrade('1')).toBe('Stage 1')
      expect(curriculum.getStageForGrade('2')).toBe('Stage 1')
    })

    it('should map Year 3-4 to Stage 2', () => {
      expect(curriculum.getStageForGrade('Year 3')).toBe('Stage 2')
      expect(curriculum.getStageForGrade('Year 4')).toBe('Stage 2')
    })

    it('should map Year 5-6 to Stage 3', () => {
      expect(curriculum.getStageForGrade('Year 5')).toBe('Stage 3')
      expect(curriculum.getStageForGrade('Year 6')).toBe('Stage 3')
    })

    it('should map Year 7-8 to Stage 4', () => {
      expect(curriculum.getStageForGrade('Year 7')).toBe('Stage 4')
      expect(curriculum.getStageForGrade('Year 8')).toBe('Stage 4')
    })

    it('should map Year 9-10 to Stage 5', () => {
      expect(curriculum.getStageForGrade('Year 9')).toBe('Stage 5')
      expect(curriculum.getStageForGrade('Year 10')).toBe('Stage 5')
    })

    it('should map Year 11-12 to Stage 6', () => {
      expect(curriculum.getStageForGrade('Year 11')).toBe('Stage 6')
      expect(curriculum.getStageForGrade('Year 12')).toBe('Stage 6')
    })

    it('should return null for unknown grade', () => {
      expect(curriculum.getStageForGrade('Year 13')).toBeNull()
      expect(curriculum.getStageForGrade('')).toBeNull()
      expect(curriculum.getStageForGrade(undefined)).toBeNull()
    })
  })

  describe('getFilePath', () => {
    it('should convert stage name to file path', () => {
      expect(curriculum.getFilePath('Early Stage 1')).toBe('/curriculum/early-stage-1-curriculum.json')
      expect(curriculum.getFilePath('Stage 2')).toBe('/curriculum/stage-2-curriculum.json')
      expect(curriculum.getFilePath('Stage 5')).toBe('/curriculum/stage-5-curriculum.json')
    })
  })

  describe('getStages', () => {
    it('should return all known stages', () => {
      const stages = curriculum.getStages()
      expect(stages).toContain('Early Stage 1')
      expect(stages).toContain('Stage 1')
      expect(stages).toContain('Stage 2')
      expect(stages).toContain('Stage 3')
      expect(stages).toContain('Stage 4')
      expect(stages).toContain('Stage 5')
      expect(stages).toContain('Stage 6')
      expect(stages).toHaveLength(7)
    })
  })

  describe('isOffline', () => {
    it('should reflect navigator.onLine status', () => {
      // jsdom sets navigator.onLine to true by default
      expect(curriculum.isOffline()).toBe(false)
    })
  })

  describe('load', () => {
    it('should return cached data if already loaded', async () => {
      const mockData = { subjects: [{ code: 'MA', name: 'Mathematics' }] }
      curriculum.data['Stage 2'] = mockData

      const result = await curriculum.load('Stage 2')
      expect(result).toEqual(mockData)
    })

    it('should fetch from network when not cached', async () => {
      const mockData = { subjects: [{ code: 'EN', name: 'English' }] }
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(mockData),
      })

      const result = await curriculum.load('Stage 3')
      expect(result).toEqual(mockData)
      expect(curriculum.data['Stage 3']).toEqual(mockData)
      expect(globalThis.fetch).toHaveBeenCalledWith('/curriculum/stage-3-curriculum.json')
    })

    it('should throw on HTTP error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: { get: () => 'text/html' },
      })

      await expect(curriculum.load('Stage 99')).rejects.toThrow('Failed to load curriculum')
    })

    it('should throw on non-JSON response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
      })

      await expect(curriculum.load('Stage 1')).rejects.toThrow('Failed to load curriculum')
    })
  })

  describe('getSubjects', () => {
    it('should return subjects for a valid grade', async () => {
      const mockSubjects = [{ code: 'MA', name: 'Mathematics' }]
      curriculum.data['Stage 2'] = { subjects: mockSubjects }

      const result = await curriculum.getSubjects('Year 3')
      expect(result).toEqual(mockSubjects)
    })

    it('should return empty array for unknown grade', async () => {
      const result = await curriculum.getSubjects('Year 99')
      expect(result).toEqual([])
    })
  })

  describe('getOutcomes', () => {
    it('should return outcomes for a valid stage and subject', async () => {
      const mockOutcomes = [{ code: 'MA2-RN-01', name: 'Recognises numbers' }]
      curriculum.data['Stage 2'] = {
        subjects: [{ code: 'MA', outcomes: mockOutcomes }],
      }

      const result = await curriculum.getOutcomes('Stage 2', 'MA')
      expect(result).toEqual(mockOutcomes)
    })

    it('should return empty array for unknown subject', async () => {
      curriculum.data['Stage 2'] = {
        subjects: [{ code: 'MA', outcomes: [] }],
      }

      const result = await curriculum.getOutcomes('Stage 2', 'XX')
      expect(result).toEqual([])
    })
  })
})
