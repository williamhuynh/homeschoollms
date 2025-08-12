import { configureStore } from '@reduxjs/toolkit'
import studentsReducer, { hydrateStudents } from './studentsSlice'
import userReducer, { hydrateUser } from './userSlice'
import { idbGet, idbSet } from './db'

const PERSIST_KEYS = {
  students: 'students:v1',
  user: 'user:v1',
}

export const store = configureStore({
  reducer: {
    students: studentsReducer,
    user: userReducer,
  },
})

// Async rehydration from IndexedDB
export async function rehydrateStore() {
  try {
    const [studentsState, userState] = await Promise.all([
      idbGet(PERSIST_KEYS.students),
      idbGet(PERSIST_KEYS.user),
    ])
    if (studentsState) {
      store.dispatch(hydrateStudents(studentsState))
    }
    if (userState) {
      store.dispatch(hydrateUser(userState))
    }
  } catch (e) {
    console.warn('Rehydration failed', e)
  }
}

// Persist to IndexedDB (debounced)
let saveTimeout = null
store.subscribe(() => {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(async () => {
    const state = store.getState()
    try {
      await Promise.all([
        idbSet(PERSIST_KEYS.students, state.students),
        idbSet(PERSIST_KEYS.user, state.user),
      ])
    } catch (e) {
      console.warn('Persist failed', e)
    }
  }, 500)
})

export const selectStudents = (state) => state.students.items
export const selectUserProfile = (state) => state.user.profile