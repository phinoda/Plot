import type { BentoTree, Entry, Project } from './types'

const PROJECTS_KEY = 'plot:projects'
const META_KEY = 'plot:meta'
const entriesKey = (projectId: string) => `plot:entries:${projectId}`

export type Meta = {
  /** YYYY-MM-DD of the last time the app was opened; powers day-rollover logic. */
  lastOpenedDay?: string
  /** Last selected bottom-bar mode. */
  viewMode?: 'project' | 'status' | 'stats'
  /** Presentation style for the multi-project Plots landing. */
  plotsView?: 'bento' | 'city'
  /** Persisted bento landing layout — survives tab close/reopen. */
  bentoTree?: BentoTree
  /** Light/dark theme for the cross-project Status view. Single-project views
   *  inherit each project's color and don't honor this. */
  statusTheme?: 'light' | 'dark'
}

export async function loadMeta(): Promise<Meta> {
  const result = await chrome.storage.local.get(META_KEY)
  return (result[META_KEY] as Meta | undefined) ?? {}
}

export async function saveMeta(meta: Meta): Promise<void> {
  await chrome.storage.local.set({ [META_KEY]: meta })
}

export async function loadProjects(): Promise<Project[]> {
  const result = await chrome.storage.local.get(PROJECTS_KEY)
  return (result[PROJECTS_KEY] as Project[] | undefined) ?? []
}

export async function saveProjects(projects: Project[]): Promise<void> {
  await chrome.storage.local.set({ [PROJECTS_KEY]: projects })
}

export async function loadEntries(projectId: string): Promise<Entry[]> {
  const key = entriesKey(projectId)
  const result = await chrome.storage.local.get(key)
  return (result[key] as Entry[] | undefined) ?? []
}

export async function saveEntries(
  projectId: string,
  entries: Entry[],
): Promise<void> {
  await chrome.storage.local.set({ [entriesKey(projectId)]: entries })
}

export async function removeEntries(projectId: string): Promise<void> {
  await chrome.storage.local.remove(entriesKey(projectId))
}
