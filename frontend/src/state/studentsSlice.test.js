/**
 * Tests for the students Redux slice.
 *
 * Covers reducer logic for setting, adding, updating, clearing students
 * and hydration from persisted state.
 */
import { describe, it, expect } from 'vitest'
import studentsReducer, {
  setStudents,
  addStudent,
  updateStudent,
  clearStudents,
  hydrateStudents,
  setLoading,
  setError,
} from './studentsSlice'

const initialState = {
  items: [],
  status: 'idle',
  error: null,
  lastFetchedAt: null,
}

describe('studentsSlice', () => {
  it('should return the initial state', () => {
    const state = studentsReducer(undefined, { type: 'unknown' })
    expect(state.items).toEqual([])
    expect(state.status).toBe('idle')
    expect(state.error).toBeNull()
  })

  describe('setStudents', () => {
    it('should set students array and update status', () => {
      const students = [
        { _id: '1', first_name: 'Alice', last_name: 'Smith' },
        { _id: '2', first_name: 'Bob', last_name: 'Jones' },
      ]
      const state = studentsReducer(initialState, setStudents(students))
      expect(state.items).toHaveLength(2)
      expect(state.items[0].first_name).toBe('Alice')
      expect(state.status).toBe('succeeded')
      expect(state.error).toBeNull()
      expect(state.lastFetchedAt).toBeTruthy()
    })

    it('should handle non-array payload gracefully', () => {
      const state = studentsReducer(initialState, setStudents(null))
      expect(state.items).toEqual([])
    })
  })

  describe('addStudent', () => {
    it('should add a student to the list', () => {
      const existing = { ...initialState, items: [{ _id: '1', first_name: 'Alice' }] }
      const state = studentsReducer(existing, addStudent({ _id: '2', first_name: 'Bob' }))
      expect(state.items).toHaveLength(2)
      expect(state.items[1].first_name).toBe('Bob')
    })

    it('should not add null payload', () => {
      const state = studentsReducer(initialState, addStudent(null))
      expect(state.items).toHaveLength(0)
    })
  })

  describe('updateStudent', () => {
    it('should update a student by _id', () => {
      const existing = {
        ...initialState,
        items: [{ _id: '1', first_name: 'Alice', grade_level: 'Year 3' }],
      }
      const state = studentsReducer(
        existing,
        updateStudent({ _id: '1', grade_level: 'Year 4' })
      )
      expect(state.items[0].grade_level).toBe('Year 4')
      expect(state.items[0].first_name).toBe('Alice')
    })

    it('should update a student by slug', () => {
      const existing = {
        ...initialState,
        items: [{ slug: 'alice-smith', first_name: 'Alice' }],
      }
      const state = studentsReducer(
        existing,
        updateStudent({ slug: 'alice-smith', first_name: 'Alicia' })
      )
      expect(state.items[0].first_name).toBe('Alicia')
    })

    it('should not modify list for non-existent student', () => {
      const existing = {
        ...initialState,
        items: [{ _id: '1', first_name: 'Alice' }],
      }
      const state = studentsReducer(
        existing,
        updateStudent({ _id: 'nonexistent', first_name: 'Nope' })
      )
      expect(state.items[0].first_name).toBe('Alice')
    })
  })

  describe('clearStudents', () => {
    it('should reset to initial state', () => {
      const populated = {
        items: [{ _id: '1' }],
        status: 'succeeded',
        error: null,
        lastFetchedAt: Date.now(),
      }
      const state = studentsReducer(populated, clearStudents())
      expect(state.items).toEqual([])
      expect(state.status).toBe('idle')
      expect(state.lastFetchedAt).toBeNull()
    })
  })

  describe('setLoading', () => {
    it('should set status to loading', () => {
      const state = studentsReducer(initialState, setLoading())
      expect(state.status).toBe('loading')
    })
  })

  describe('setError', () => {
    it('should set status to failed with error message', () => {
      const state = studentsReducer(initialState, setError('Network error'))
      expect(state.status).toBe('failed')
      expect(state.error).toBe('Network error')
    })

    it('should use default message for empty payload', () => {
      const state = studentsReducer(initialState, setError())
      expect(state.status).toBe('failed')
      expect(state.error).toBe('Unknown error')
    })
  })

  describe('hydrateStudents', () => {
    it('should restore persisted state', () => {
      const persisted = {
        items: [{ _id: '1', first_name: 'Alice' }],
        status: 'succeeded',
        lastFetchedAt: 1700000000000,
      }
      const state = studentsReducer(initialState, hydrateStudents(persisted))
      expect(state.items).toHaveLength(1)
      expect(state.status).toBe('succeeded')
      expect(state.lastFetchedAt).toBe(1700000000000)
    })

    it('should handle null payload gracefully', () => {
      const state = studentsReducer(initialState, hydrateStudents(null))
      expect(state).toEqual(initialState)
    })

    it('should handle invalid items in payload', () => {
      const state = studentsReducer(initialState, hydrateStudents({ items: 'not-array' }))
      expect(state.items).toEqual([])
    })
  })
})
