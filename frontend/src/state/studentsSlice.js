import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  items: [],
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
  lastFetchedAt: null,
}

const studentsSlice = createSlice({
  name: 'students',
  initialState,
  reducers: {
    hydrateStudents(state, action) {
      const next = action.payload
      if (!next || typeof next !== 'object') return state
      return {
        ...state,
        ...next,
        // Ensure required keys exist
        items: Array.isArray(next.items) ? next.items : state.items,
        status: next.status || state.status,
        error: next.error ?? state.error,
        lastFetchedAt: next.lastFetchedAt ?? state.lastFetchedAt,
      }
    },
    setStudents(state, action) {
      state.items = Array.isArray(action.payload) ? action.payload : []
      state.status = 'succeeded'
      state.error = null
      state.lastFetchedAt = Date.now()
    },
    addStudent(state, action) {
      if (action.payload) {
        state.items.push(action.payload)
        state.lastFetchedAt = Date.now()
      }
    },
    updateStudent(state, action) {
      const updated = action.payload
      if (!updated) return
      const updatedId = updated._id || updated.id || updated.slug
      state.items = state.items.map(s => {
        const sid = s._id || s.id || s.slug
        return sid === updatedId ? { ...s, ...updated } : s
      })
      state.lastFetchedAt = Date.now()
    },
    clearStudents(state) {
      state.items = []
      state.status = 'idle'
      state.error = null
      state.lastFetchedAt = null
    },
    setLoading(state) {
      state.status = 'loading'
    },
    setError(state, action) {
      state.status = 'failed'
      state.error = action.payload || 'Unknown error'
    }
  }
})

export const { hydrateStudents, setStudents, addStudent, updateStudent, clearStudents, setLoading, setError } = studentsSlice.actions
export default studentsSlice.reducer