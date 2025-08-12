import { configureStore } from '@reduxjs/toolkit'
import studentsReducer from './studentsSlice'
import userReducer from './userSlice'

const PERSIST_KEY = 'appState:v1'

function loadState() {
  try {
    const serialized = localStorage.getItem(PERSIST_KEY)
    if (!serialized) return undefined
    const parsed = JSON.parse(serialized)
    const preloaded = {}
    if (parsed.students) preloaded.students = parsed.students
    if (parsed.user) preloaded.user = parsed.user
    return preloaded
  } catch (e) {
    console.warn('Failed to load persisted state', e)
    return undefined
  }
}

function saveState(state) {
  try {
    const subset = {
      students: state.students,
      user: state.user,
    }
    localStorage.setItem(PERSIST_KEY, JSON.stringify(subset))
  } catch (e) {
    console.warn('Failed to save state', e)
  }
}

export const store = configureStore({
  reducer: {
    students: studentsReducer,
    user: userReducer,
  },
  preloadedState: typeof window !== 'undefined' ? loadState() : undefined,
})

let saveTimeout = null
store.subscribe(() => {
  if (typeof window === 'undefined') return
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    saveState(store.getState())
  }, 500)
})

export const selectStudents = (state) => state.students.items
export const selectUserProfile = (state) => state.user.profile