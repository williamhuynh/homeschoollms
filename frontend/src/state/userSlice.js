import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  profile: null,
  status: 'idle',
  error: null,
}

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    hydrateUser(state, action) {
      const next = action.payload
      if (!next || typeof next !== 'object') return state
      return {
        ...state,
        ...next,
        profile: next.profile ?? state.profile,
        status: next.status || state.status,
        error: next.error ?? state.error,
      }
    },
    setUser(state, action) {
      state.profile = action.payload || null
      state.status = 'succeeded'
      state.error = null
    },
    clearUser(state) {
      state.profile = null
      state.status = 'idle'
      state.error = null
    },
    setUserLoading(state) {
      state.status = 'loading'
    },
    setUserError(state, action) {
      state.status = 'failed'
      state.error = action.payload || 'Unknown error'
    }
  }
})

export const { hydrateUser, setUser, clearUser, setUserLoading, setUserError } = userSlice.actions
export default userSlice.reducer