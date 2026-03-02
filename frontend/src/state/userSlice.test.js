/**
 * Tests for the user Redux slice.
 *
 * Covers reducer logic for setting, clearing, and hydrating user profile state.
 */
import { describe, it, expect } from 'vitest'
import userReducer, {
  setUser,
  clearUser,
  hydrateUser,
  setUserLoading,
  setUserError,
} from './userSlice'

const initialState = {
  profile: null,
  status: 'idle',
  error: null,
}

describe('userSlice', () => {
  it('should return the initial state', () => {
    const state = userReducer(undefined, { type: 'unknown' })
    expect(state.profile).toBeNull()
    expect(state.status).toBe('idle')
    expect(state.error).toBeNull()
  })

  describe('setUser', () => {
    it('should set user profile', () => {
      const user = { email: 'test@test.com', first_name: 'Test', role: 'parent' }
      const state = userReducer(initialState, setUser(user))
      expect(state.profile).toEqual(user)
      expect(state.status).toBe('succeeded')
      expect(state.error).toBeNull()
    })

    it('should handle null payload', () => {
      const state = userReducer(initialState, setUser(null))
      expect(state.profile).toBeNull()
      expect(state.status).toBe('succeeded')
    })
  })

  describe('clearUser', () => {
    it('should reset user state', () => {
      const populated = {
        profile: { email: 'test@test.com' },
        status: 'succeeded',
        error: null,
      }
      const state = userReducer(populated, clearUser())
      expect(state.profile).toBeNull()
      expect(state.status).toBe('idle')
      expect(state.error).toBeNull()
    })
  })

  describe('setUserLoading', () => {
    it('should set status to loading', () => {
      const state = userReducer(initialState, setUserLoading())
      expect(state.status).toBe('loading')
    })
  })

  describe('setUserError', () => {
    it('should set status to failed with error', () => {
      const state = userReducer(initialState, setUserError('Auth failed'))
      expect(state.status).toBe('failed')
      expect(state.error).toBe('Auth failed')
    })

    it('should use default message for empty payload', () => {
      const state = userReducer(initialState, setUserError())
      expect(state.error).toBe('Unknown error')
    })
  })

  describe('hydrateUser', () => {
    it('should restore persisted state', () => {
      const persisted = {
        profile: { email: 'test@test.com', role: 'parent' },
        status: 'succeeded',
      }
      const state = userReducer(initialState, hydrateUser(persisted))
      expect(state.profile.email).toBe('test@test.com')
      expect(state.status).toBe('succeeded')
    })

    it('should handle null payload gracefully', () => {
      const state = userReducer(initialState, hydrateUser(null))
      expect(state).toEqual(initialState)
    })

    it('should preserve existing profile if not in payload', () => {
      const existing = {
        profile: { email: 'existing@test.com' },
        status: 'succeeded',
        error: null,
      }
      const state = userReducer(existing, hydrateUser({ status: 'idle' }))
      expect(state.profile.email).toBe('existing@test.com')
      expect(state.status).toBe('idle')
    })
  })
})
