import { create } from 'zustand'
import type {
  BentoTree,
  Entry,
  Project,
  ProjectColor,
} from './types'
import {
  loadEntries,
  loadMeta,
  loadProjects,
  removeEntries,
  saveEntries,
  saveMeta,
  saveProjects,
} from './storage'
import {
  ensurePermission,
  exportAllAsJson,
  getStoredHandle,
  importAllFromJson,
  pickBackupFolder,
  readBackupFile,
  setStoredHandle,
  writeBackupFile,
} from './backup'
import { todayKey } from './date'

type LayoutItem = { i: string; x: number; y: number; w: number; h: number }

export type ViewMode = 'project' | 'status'
export type StatusTheme = 'light' | 'dark'

export type DragPreview = {
  entryId: string
  previewKind: 'todo' | 'backlog' | 'delivered'
} | null

/** Best-effort error message extraction for backup write failures —
 *  surfaces in the UI so the user knows the folder may have moved. */
function backupErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Backup write failed.'
}

/** Locate the project that owns a given entry id. Used by mutators that
 *  must work in cross-project views (Status mode) where there's no
 *  currentProjectId to fall back on. */
function findEntryProject(
  entriesByProject: Record<string, Entry[]>,
  entryId: string,
): { projectId: string; entries: Entry[] } | null {
  for (const [projectId, entries] of Object.entries(entriesByProject)) {
    if (entries.some((e) => e.id === entryId)) {
      return { projectId, entries }
    }
  }
  return null
}

type Store = {
  loaded: boolean
  projects: Project[]
  entriesByProject: Record<string, Entry[]>
  currentProjectId: string | null

  /** YYYY-MM-DD the user is currently viewing; null = today. Not persisted. */
  viewingDay: string | null
  /** Bottom-bar mode toggle. Persisted via meta so a chosen mode survives reload. */
  viewMode: ViewMode
  /** Light/dark theme for the cross-project Status view. Persisted. */
  statusTheme: StatusTheme
  /**
   * Current bento split tree. Lives in the store (not in component state) so
   * that drag-resize state survives navigating into a project's detail view
   * and back. Null until first paint of ProjectsLanding builds it from the
   * project count.
   */
  bentoTree: BentoTree | null
  /**
   * Active task drag preview. While set, StatusView renders the entry in
   * `previewKind`'s section instead of its real kind — purely visual. The
   * actual kind only changes if `moveEntry` runs on mouseup.
   */
  dragPreview: DragPreview
  /**
   * After a drop into Backlog or Delivered, this points at the entry that
   * should auto-open its inline comment prompt. EntryItem watches it and
   * clears it after handling.
   */
  pendingCommentEntryId: string | null

  /** File System Access handle to the user's chosen backup folder.
   *  Null means auto-backup hasn't been set up yet. Populated on load() if
   *  a handle was previously stored in IndexedDB. */
  backupHandle: FileSystemDirectoryHandle | null
  /** Display-only folder name (e.g. "PlotBackup"). Comes from `handle.name`. */
  backupFolderName: string | null
  /** Last write error, if any. UI surfaces this so the user knows the folder
   *  may have moved / lost permission and they should re-pick. Cleared on
   *  successful write. */
  backupError: string | null

  setViewingDay: (day: string | null) => void
  setViewMode: (mode: ViewMode) => void
  setStatusTheme: (theme: StatusTheme) => void
  setBentoTree: (tree: BentoTree) => void
  setDragPreview: (preview: DragPreview) => void
  setPendingComment: (id: string | null) => void

  /** Open the system folder picker, save the chosen handle, and (if the
   *  folder already contains a Plot backup) offer to restore it. Returns
   *  true if a folder was successfully attached, false on user-cancel or
   *  unsupported browser. */
  setupBackupFolder: () => Promise<boolean>

  load: () => Promise<void>
  setCurrentProject: (id: string | null) => void

  addProject: (name: string, color: ProjectColor) => void
  renameProject: (id: string, name: string) => void
  recolorProject: (id: string, color: ProjectColor) => void
  reorderProjects: (sourceId: string, targetId: string) => void
  /** Swap two projects' positions in the array — used for live drag-reorder. */
  swapProjects: (idA: string, idB: string) => void
  deleteProject: (id: string) => Promise<void>
  setLayouts: (newLayouts: LayoutItem[]) => void

  addTodo: (title: string) => void
  addBacklog: (title: string) => void
  /** Journal entry: a decision logged today (kind='decision', body=text). */
  addDecision: (body: string) => void
  /** Journal entry: a learning logged today (kind='learning', body=text). */
  addLearning: (body: string) => void
  markDelivered: (id: string, deliverable: string) => void
  parkToBacklog: (id: string, reason?: string) => void
  /**
   * Cross-section move triggered by drag. Handles all transitions between
   * todo/backlog/delivered and rewrites kind-specific metadata as needed.
   */
  moveEntry: (id: string, newKind: 'todo' | 'backlog' | 'delivered') => void
  editEntry: (id: string, patch: Partial<Entry>) => void
  deleteEntry: (id: string) => void
}

export const useStore = create<Store>((set, get) => ({
  loaded: false,
  projects: [],
  entriesByProject: {},
  currentProjectId: null,
  viewingDay: null,
  viewMode: 'project',
  statusTheme: 'light',
  bentoTree: null,
  dragPreview: null,
  pendingCommentEntryId: null,
  backupHandle: null,
  backupFolderName: null,
  backupError: null,

  setViewingDay: (day) => set({ viewingDay: day }),
  setDragPreview: (preview) => set({ dragPreview: preview }),
  setPendingComment: (id) => set({ pendingCommentEntryId: id }),
  setViewMode: (mode) => {
    set({ viewMode: mode })
    // Persist alongside lastOpenedDay so it survives reload.
    loadMeta().then((meta) => saveMeta({ ...meta, viewMode: mode }))
  },
  setStatusTheme: (theme) => {
    set({ statusTheme: theme })
    loadMeta().then((meta) => saveMeta({ ...meta, statusTheme: theme }))
  },
  setBentoTree: (tree) => {
    set({ bentoTree: tree })
    // Persist alongside meta so the layout survives tab close/reopen.
    loadMeta().then((meta) => saveMeta({ ...meta, bentoTree: tree }))
  },

  setupBackupFolder: async () => {
    const handle = await pickBackupFolder()
    if (!handle) return false

    // Verify (or request) read+write permission on the chosen folder.
    const ok = await ensurePermission(handle)
    if (!ok) return false

    // If the folder already has a Plot backup AND local storage is empty
    // (fresh install or post-uninstall), offer to restore. This is the
    // "I reinstalled, recover my data" path.
    let didRestore = false
    const projectsEmpty = get().projects.length === 0
    if (projectsEmpty) {
      try {
        const existing = await readBackupFile(handle)
        if (existing) {
          const ok = window.confirm(
            'Found a Plot backup in this folder. Restore your data from it?',
          )
          if (ok) {
            await importAllFromJson(existing)
            didRestore = true
          }
        }
      } catch (err) {
        console.warn('Failed to read existing backup:', err)
      }
    }

    await setStoredHandle(handle)
    set({
      backupHandle: handle,
      backupFolderName: handle.name,
      backupError: null,
    })

    // After a successful restore, the in-memory store is stale (we wrote
    // straight into chrome.storage.local). A full page reload is the
    // simplest way to reseed every selector cleanly.
    if (didRestore) {
      window.location.reload()
      return true
    }

    // Not a restore — just attach the folder, then write the current
    // state to it so the user has a baseline backup file right away.
    try {
      const json = await exportAllAsJson()
      await writeBackupFile(handle, json)
    } catch (err) {
      set({ backupError: backupErrorMessage(err) })
    }
    return true
  },

  load: async () => {
    const projects = await loadProjects()
    const meta = await loadMeta()
    const today = todayKey()
    const isNewDay =
      meta.lastOpenedDay !== undefined && meta.lastOpenedDay !== today

    const entriesByProject: Record<string, Entry[]> = {}
    for (const p of projects) {
      let entries = await loadEntries(p.id)
      // On a new day, auto-park yesterday's leftover todos into Backlog.
      if (isNewDay) {
        const now = Date.now()
        let mutated = false
        entries = entries.map((e) => {
          if (e.kind === 'todo') {
            mutated = true
            return { ...e, kind: 'backlog' as const, movedAt: now }
          }
          return e
        })
        if (mutated) await saveEntries(p.id, entries)
      }
      entriesByProject[p.id] = entries
    }

    await saveMeta({ ...meta, lastOpenedDay: today })

    // Restore the backup folder handle saved in IndexedDB across reloads.
    // We don't auto-prompt for permission here — that requires a user
    // gesture; we'll request it lazily on the next write attempt.
    let backupHandle: FileSystemDirectoryHandle | null = null
    let backupFolderName: string | null = null
    try {
      const handle = await getStoredHandle()
      if (handle) {
        backupHandle = handle
        backupFolderName = handle.name
      }
    } catch {
      // IDB unavailable / corrupt — non-fatal; user can re-pick.
    }

    set({
      projects,
      entriesByProject,
      loaded: true,
      viewMode: meta.viewMode ?? 'project',
      statusTheme: meta.statusTheme ?? 'light',
      bentoTree: meta.bentoTree ?? null,
      backupHandle,
      backupFolderName,
    })
    // currentProjectId stays at its default (null) so that fresh tab opens
    // with 2+ projects land on ProjectsLanding. StatusView falls back to
    // projects[0] when there's only one project anyway.
  },

  setCurrentProject: (id) => set({ currentProjectId: id }),

  addProject: (name, color) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const project: Project = {
      id: crypto.randomUUID(),
      name: trimmed,
      color,
      createdAt: Date.now(),
    }
    const projects = [...get().projects, project]
    const entriesByProject = {
      ...get().entriesByProject,
      [project.id]: [],
    }
    set({ projects, entriesByProject, currentProjectId: project.id })
    saveProjects(projects)
  },

  renameProject: (id, name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const projects = get().projects.map((p) =>
      p.id === id ? { ...p, name: trimmed } : p,
    )
    set({ projects })
    saveProjects(projects)
  },

  recolorProject: (id, color) => {
    const projects = get().projects.map((p) =>
      p.id === id ? { ...p, color } : p,
    )
    set({ projects })
    saveProjects(projects)
  },

  reorderProjects: (sourceId, targetId) => {
    const projects = get().projects
    const sourceIdx = projects.findIndex((p) => p.id === sourceId)
    const targetIdx = projects.findIndex((p) => p.id === targetId)
    if (sourceIdx === -1 || targetIdx === -1 || sourceIdx === targetIdx) return
    const next = [...projects]
    const [moved] = next.splice(sourceIdx, 1)
    next.splice(targetIdx, 0, moved)
    set({ projects: next })
    saveProjects(next)
  },

  swapProjects: (idA, idB) => {
    if (idA === idB) return
    const projects = get().projects
    const aIdx = projects.findIndex((p) => p.id === idA)
    const bIdx = projects.findIndex((p) => p.id === idB)
    if (aIdx === -1 || bIdx === -1) return
    const next = [...projects]
    ;[next[aIdx], next[bIdx]] = [next[bIdx], next[aIdx]]
    set({ projects: next })
    saveProjects(next)
  },

  deleteProject: async (id) => {
    const projects = get().projects.filter((p) => p.id !== id)
    const { [id]: _removed, ...rest } = get().entriesByProject
    const wasCurrent = get().currentProjectId === id
    set({
      projects,
      entriesByProject: rest,
      // After deleting the current project, drop selection to null. Routing
      // handles where to land: 0 left → EmptyState, 1 left → StatusView (via
      // fallback), 2+ left → ProjectsLanding (so user picks where to go).
      currentProjectId: wasCurrent ? null : get().currentProjectId,
    })
    saveProjects(projects)
    await removeEntries(id)
  },

  setLayouts: (newLayouts) => {
    const projects = get().projects.map((p) => {
      const l = newLayouts.find((n) => n.i === p.id)
      if (!l) return p
      return { ...p, layout: { x: l.x, y: l.y, w: l.w, h: l.h } }
    })
    set({ projects })
    saveProjects(projects)
  },

  addTodo: (title) => {
    // Fall back to projects[0] when nothing is explicitly selected — that's
    // the case in the single-project app, where StatusView renders projects[0]
    // even though currentProjectId hasn't been set.
    const projectId = get().currentProjectId ?? get().projects[0]?.id
    if (!projectId) return
    const text = title.trim()
    if (!text) return
    const now = Date.now()
    const entry: Entry = {
      id: crypto.randomUUID(),
      projectId,
      kind: 'todo',
      title: text,
      createdAt: now,
      movedAt: now,
    }
    // Prepend so the freshest task lands at the top of its section.
    const next = [entry, ...(get().entriesByProject[projectId] ?? [])]
    set({
      entriesByProject: { ...get().entriesByProject, [projectId]: next },
    })
    saveEntries(projectId, next)
  },

  addBacklog: (title) => {
    // Fall back to projects[0] when nothing is explicitly selected — that's
    // the case in the single-project app, where StatusView renders projects[0]
    // even though currentProjectId hasn't been set.
    const projectId = get().currentProjectId ?? get().projects[0]?.id
    if (!projectId) return
    const text = title.trim()
    if (!text) return
    const now = Date.now()
    const entry: Entry = {
      id: crypto.randomUUID(),
      projectId,
      kind: 'backlog',
      title: text,
      createdAt: now,
      movedAt: now,
    }
    // Prepend so the freshest item lands at the top of its section.
    const next = [entry, ...(get().entriesByProject[projectId] ?? [])]
    set({
      entriesByProject: { ...get().entriesByProject, [projectId]: next },
    })
    saveEntries(projectId, next)
  },

  addDecision: (body) => {
    const projectId = get().currentProjectId ?? get().projects[0]?.id
    if (!projectId) return
    const text = body.trim()
    if (!text) return
    const now = Date.now()
    const entry: Entry = {
      id: crypto.randomUUID(),
      projectId,
      kind: 'decision',
      // Journal entries don't use `title`; the body field is the content.
      title: '',
      body: text,
      createdAt: now,
      movedAt: now,
    }
    const next = [entry, ...(get().entriesByProject[projectId] ?? [])]
    set({
      entriesByProject: { ...get().entriesByProject, [projectId]: next },
    })
    saveEntries(projectId, next)
  },

  addLearning: (body) => {
    const projectId = get().currentProjectId ?? get().projects[0]?.id
    if (!projectId) return
    const text = body.trim()
    if (!text) return
    const now = Date.now()
    const entry: Entry = {
      id: crypto.randomUUID(),
      projectId,
      kind: 'learning',
      title: '',
      body: text,
      createdAt: now,
      movedAt: now,
    }
    const next = [entry, ...(get().entriesByProject[projectId] ?? [])]
    set({
      entriesByProject: { ...get().entriesByProject, [projectId]: next },
    })
    saveEntries(projectId, next)
  },

  markDelivered: (id, deliverable) => {
    // Fall back to projects[0] when nothing is explicitly selected — that's
    // the case in the single-project app, where StatusView renders projects[0]
    // even though currentProjectId hasn't been set.
    const projectId = get().currentProjectId ?? get().projects[0]?.id
    if (!projectId) return
    const text = deliverable.trim()
    if (!text) return
    const now = Date.now()
    const entries = get().entriesByProject[projectId] ?? []
    const next = entries.map((e) =>
      e.id === id
        ? { ...e, kind: 'delivered' as const, deliverable: text, movedAt: now }
        : e,
    )
    set({
      entriesByProject: { ...get().entriesByProject, [projectId]: next },
    })
    saveEntries(projectId, next)
  },

  parkToBacklog: (id, reason) => {
    // Fall back to projects[0] when nothing is explicitly selected — that's
    // the case in the single-project app, where StatusView renders projects[0]
    // even though currentProjectId hasn't been set.
    const projectId = get().currentProjectId ?? get().projects[0]?.id
    if (!projectId) return
    const now = Date.now()
    const trimmed = reason?.trim()
    const entries = get().entriesByProject[projectId] ?? []
    const next = entries.map((e) =>
      e.id === id
        ? {
            ...e,
            kind: 'backlog' as const,
            parkedReason: trimmed || undefined,
            movedAt: now,
          }
        : e,
    )
    set({
      entriesByProject: { ...get().entriesByProject, [projectId]: next },
    })
    saveEntries(projectId, next)
  },

  moveEntry: (id, newKind) => {
    // Locate by entry id, not currentProjectId — works in cross-project
    // (Status) view too. Drag preserves the entry's project; only kind changes.
    const loc = findEntryProject(get().entriesByProject, id)
    if (!loc) return
    const target = loc.entries.find((e) => e.id === id)
    if (!target || target.kind === newKind) return
    const now = Date.now()
    const next = loc.entries.map((e) => {
      if (e.id !== id) return e
      const updated: Entry = { ...e, kind: newKind, movedAt: now }
      if (newKind !== 'delivered') {
        delete updated.deliverable
      }
      // For delivered, leave any existing deliverable untouched — the drop
      // prompt fills it in afterward (or leaves empty).
      if (newKind !== 'backlog') {
        delete updated.parkedReason
      }
      return updated
    })
    set({
      entriesByProject: { ...get().entriesByProject, [loc.projectId]: next },
    })
    saveEntries(loc.projectId, next)
  },

  editEntry: (id, patch) => {
    const loc = findEntryProject(get().entriesByProject, id)
    if (!loc) return
    const next = loc.entries.map((e) => (e.id === id ? { ...e, ...patch } : e))
    set({
      entriesByProject: { ...get().entriesByProject, [loc.projectId]: next },
    })
    saveEntries(loc.projectId, next)
  },

  deleteEntry: (id) => {
    const loc = findEntryProject(get().entriesByProject, id)
    if (!loc) return
    const next = loc.entries.filter((e) => e.id !== id)
    set({
      entriesByProject: { ...get().entriesByProject, [loc.projectId]: next },
    })
    saveEntries(loc.projectId, next)
  },
}))
