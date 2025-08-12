const DB_NAME = 'app-state-db'
const DB_VERSION = 1
const STORE_NAME = 'slices'

export function openAppStateDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }

    request.onsuccess = (event) => resolve(event.target.result)
    request.onerror = () => reject(request.error)
  })
}

export async function idbGet(key) {
  const db = await openAppStateDB()
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result ? req.result.value : undefined)
    req.onerror = () => resolve(undefined)
  })
}

export async function idbSet(key, value) {
  const db = await openAppStateDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.put({ key, value })
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}