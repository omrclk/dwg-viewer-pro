import type { FileSource, RecentFileEntry, SupportedFormat } from './fileTypes'

const RECENT_STORAGE_KEY = 'dwg-viewer-recent-files'
const DB_NAME = 'dwg-viewer-file-cache'
const DB_STORE = 'files'
const MAX_RECENT = 20
const MAX_CACHE_BYTES = 15 * 1024 * 1024

type CachedFile = {
  id: string
  buffer: ArrayBuffer
  mimeType: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function readRecentList(): RecentFileEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecentFileEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRecentList(entries: RecentFileEntry[]) {
  localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_RECENT)))
}

export function listRecentFiles() {
  return readRecentList()
}

export async function cacheFileForRecent(id: string, file: File) {
  if (file.size > MAX_CACHE_BYTES) return false

  try {
    const db = await openDb()
    const buffer = await file.arrayBuffer()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite')
      tx.objectStore(DB_STORE).put({ id, buffer, mimeType: file.type || 'application/octet-stream' } satisfies CachedFile)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
    return true
  } catch {
    return false
  }
}

export async function loadCachedFile(id: string): Promise<File | null> {
  try {
    const db = await openDb()
    const record = await new Promise<CachedFile | undefined>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly')
      const request = tx.objectStore(DB_STORE).get(id)
      request.onsuccess = () => resolve(request.result as CachedFile | undefined)
      request.onerror = () => reject(request.error)
    })
    db.close()

    if (!record) return null
    const recent = readRecentList().find((entry) => entry.id === id)
    if (!recent) return null

    const blob = new Blob([record.buffer], { type: record.mimeType })
    return new File([blob], recent.name, { type: record.mimeType })
  } catch {
    return null
  }
}

export async function addRecentFile(file: File, format: SupportedFormat, source: FileSource) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const cached = await cacheFileForRecent(id, file)
  const entry: RecentFileEntry = {
    id,
    name: file.name,
    size: file.size,
    format,
    source,
    openedAt: new Date().toISOString(),
    cached,
  }

  const withoutDuplicate = readRecentList().filter(
    (item) => !(item.name === entry.name && item.size === entry.size && item.source === entry.source),
  )
  writeRecentList([entry, ...withoutDuplicate])
  return entry
}

export function removeRecentFile(id: string) {
  writeRecentList(readRecentList().filter((entry) => entry.id !== id))
  openDb()
    .then((db) => {
      const tx = db.transaction(DB_STORE, 'readwrite')
      tx.objectStore(DB_STORE).delete(id)
      db.close()
    })
    .catch(() => undefined)
}

export function clearRecentFiles() {
  writeRecentList([])
  openDb()
    .then((db) => {
      const tx = db.transaction(DB_STORE, 'readwrite')
      tx.objectStore(DB_STORE).clear()
      db.close()
    })
    .catch(() => undefined)
}

export function formatRecentTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
