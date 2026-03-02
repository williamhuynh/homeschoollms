/**
 * Tests for the Redux store configuration and selectors.
 *
 * Covers store creation, selector functions, and dispatch integration.
 */
import { describe, it, expect } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import studentsReducer, { setStudents, clearStudents, addStudent } from './studentsSlice'
import userReducer, { setUser, clearUser } from './userSlice'
import { selectStudents, selectUserProfile } from './store'

function createTestStore(preloadedState) {
  return configureStore({
    reducer: {
      students: studentsReducer,
      user: userReducer,
    },
    preloadedState,
  })
}

describe('Redux store', () => {
  describe('store creation', () => {
    it('should initialise with correct default state', () => {
      const store = createTestStore()
      const state = store.getState()
      expect(state.students.items).toEqual([])
      expect(state.students.status).toBe('idle')
      expect(state.user.profile).toBeNull()
      expect(state.user.status).toBe('idle')
    })
  })

  describe('selectStudents', () => {
    it('should return student items from state', () => {
      const students = [{ _id: '1', first_name: 'Alice' }]
      const store = createTestStore()
      store.dispatch(setStudents(students))
      expect(selectStudents(store.getState())).toEqual(students)
    })

    it('should return empty array when no students', () => {
      const store = createTestStore()
      expect(selectStudents(store.getState())).toEqual([])
    })
  })

  describe('selectUserProfile', () => {
    it('should return user profile from state', () => {
      const user = { email: 'test@test.com', role: 'parent' }
      const store = createTestStore()
      store.dispatch(setUser(user))
      expect(selectUserProfile(store.getState())).toEqual(user)
    })

    it('should return null when no user', () => {
      const store = createTestStore()
      expect(selectUserProfile(store.getState())).toBeNull()
    })
  })

  describe('cross-slice operations', () => {
    it('should maintain independent state between slices', () => {
      const store = createTestStore()
      store.dispatch(setStudents([{ _id: '1', first_name: 'Alice' }]))
      store.dispatch(setUser({ email: 'test@test.com' }))

      // Clear students should not affect user
      store.dispatch(clearStudents())
      expect(selectStudents(store.getState())).toEqual([])
      expect(selectUserProfile(store.getState())).toEqual({ email: 'test@test.com' })

      // Clear user should not affect students
      store.dispatch(setStudents([{ _id: '2', first_name: 'Bob' }]))
      store.dispatch(clearUser())
      expect(selectStudents(store.getState())).toHaveLength(1)
      expect(selectUserProfile(store.getState())).toBeNull()
    })

    it('should handle multiple dispatches correctly', () => {
      const store = createTestStore()
      store.dispatch(addStudent({ _id: '1', first_name: 'Alice' }))
      store.dispatch(addStudent({ _id: '2', first_name: 'Bob' }))
      store.dispatch(addStudent({ _id: '3', first_name: 'Charlie' }))

      expect(selectStudents(store.getState())).toHaveLength(3)
      expect(selectStudents(store.getState()).map(s => s.first_name)).toEqual([
        'Alice', 'Bob', 'Charlie',
      ])
    })
  })
})
