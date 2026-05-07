// File System Access API permission methods aren't in TypeScript's lib.dom
// yet (WICG draft). Augment the global types so we can call them without
// ad-hoc casts everywhere.
declare global {
  type PlotPermissionDescriptor = { mode: 'read' | 'readwrite' }
  interface FileSystemDirectoryHandle {
    queryPermission(
      desc: PlotPermissionDescriptor,
    ): Promise<'granted' | 'denied' | 'prompt'>
    requestPermission(
      desc: PlotPermissionDescriptor,
    ): Promise<'granted' | 'denied' | 'prompt'>
  }
}

/**
 * Auto-backup to a user-chosen folder via the File System Access API.
 *
 * The user picks a folder once; the directory handle is persisted in
 * IndexedDB (FileSystemDirectoryHandle is structured-cloneable) so that the
 * choice survives tab reloads. Whenever Plot's persistent state changes, a
 * single `plot-backup.json` is rewritten in that folder.
 *
 * What this protects against: accidental uninstall of the extension, moving
 * to a new machine, or any other event that wipes `chrome.storage.local`.
 * The user re-installs Plot, picks the same folder, and existing data is
 * detected and restored.
 *
 * What it does NOT protect against: corruption of the backup file itself
 * (we overwrite on every change, no rotating snapshots — users can layer
 * Time Machine / iCloud / Dropbox on top of the chosen folder for that).
 */

const DB_NAME = 'plot-backup'
const DB_VERSION = 1
const STORE_NAME = 'handles'
const HANDLE_KEY = 'directoryHandle'
const BACKUP_FILE = 'plot-backup.json'

// ============== IndexedDB helpers ==============

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getStoredHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDb()
    return await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY)
      req.onsuccess = () =>
        resolve((req.result as FileSystemDirectoryHandle) ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

export async function setStoredHandle(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ============== Permission management ==============

/** Pure query — does NOT trigger a permission prompt. Safe to call from
 *  any context (timers, effects, async callbacks far from the originating
 *  user gesture). Returns true only if read+write access is already
 *  granted; in any other state ('prompt' or 'denied') returns false and
 *  callers must surface the issue so the user can re-pick the folder
 *  via a fresh gesture. */
export async function hasPermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  const opts: PlotPermissionDescriptor = { mode: 'readwrite' }
  const state = await handle.queryPermission(opts)
  return state === 'granted'
}

/** Query, and if needed prompt for, read+write access. Calling this
 *  outside a user-gesture context (clicks, keypresses, etc.) will fail —
 *  Chrome rejects `requestPermission` once user-activation has expired.
 *  Use only in handlers reached directly from a user action. */
export async function ensurePermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  const opts: PlotPermissionDescriptor = { mode: 'readwrite' }
  const current = await handle.queryPermission(opts)
  if (current === 'granted') return true
  if (current === 'denied') return false
  const after = await handle.requestPermission(opts)
  return after === 'granted'
}

// ============== Folder picker ==============

/** Prompts the user to choose a directory. Returns the handle, or null if
 *  the user cancelled or the API isn't available in this browser. */
export async function pickBackupFolder(): Promise<FileSystemDirectoryHandle | null> {
  // showDirectoryPicker is on the Window in browsers that support FSAA.
  const w = window as unknown as {
    showDirectoryPicker?: (opts?: {
      mode?: 'read' | 'readwrite'
    }) => Promise<FileSystemDirectoryHandle>
  }
  if (!w.showDirectoryPicker) return null
  try {
    const handle = await w.showDirectoryPicker({ mode: 'readwrite' })
    return handle
  } catch {
    // User pressed cancel in the system dialog — not an error per se.
    return null
  }
}

// ============== Backup file read/write ==============

/** Overwrite (or create) `plot-backup.json` in the given folder with `json`. */
export async function writeBackupFile(
  handle: FileSystemDirectoryHandle,
  json: string,
): Promise<void> {
  const fileHandle = await handle.getFileHandle(BACKUP_FILE, { create: true })
  const writable = await fileHandle.createWritable()
  try {
    await writable.write(json)
  } finally {
    await writable.close()
  }
}

/** Read `plot-backup.json` from the folder. Returns null if the file
 *  doesn't exist (a fresh / empty backup folder). */
export async function readBackupFile(
  handle: FileSystemDirectoryHandle,
): Promise<string | null> {
  try {
    const fileHandle = await handle.getFileHandle(BACKUP_FILE)
    const file = await fileHandle.getFile()
    return await file.text()
  } catch (err) {
    // NotFoundError = file doesn't exist yet; treat as null instead of throw.
    if ((err as DOMException)?.name === 'NotFoundError') return null
    throw err
  }
}

// ============== chrome.storage.local serialization ==============

/** Dumps everything in chrome.storage.local to a JSON string. */
export async function exportAllAsJson(): Promise<string> {
  const all = await chrome.storage.local.get(null)
  return JSON.stringify(all, null, 2)
}

/** Validates and writes a JSON dump back into chrome.storage.local,
 *  replacing all existing data. Throws on shape mismatch so callers can
 *  surface a friendly error instead of silently corrupting state. */
export async function importAllFromJson(json: string): Promise<void> {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Backup file is not valid JSON.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Backup file does not contain a Plot data object.')
  }
  const obj = parsed as Record<string, unknown>
  // Loose sanity check — at minimum, projects key should be present so we
  // know this is a Plot backup and not, say, a random JSON file.
  if (!('plot:projects' in obj)) {
    throw new Error('Backup file is missing plot:projects — not a Plot backup.')
  }
  await chrome.storage.local.clear()
  await chrome.storage.local.set(obj as Record<string, unknown>)
}
