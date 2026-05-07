import { useEffect, useState } from 'react'
import { useStore } from './lib/store'
import { formatDayLabel, todayKey } from './lib/date'
import {
  exportAllAsJson,
  hasPermission,
  writeBackupFile,
} from './lib/backup'
import EmptyState from './components/EmptyState'
import CreateProject from './components/CreateProject'
import ProjectsLanding from './components/ProjectsLanding'
import StatusView from './components/StatusView'
import OverviewView from './components/OverviewView'
import BottomBar from './components/BottomBar'

export default function App() {
  const load = useStore((s) => s.load)
  const loaded = useStore((s) => s.loaded)
  const projects = useStore((s) => s.projects)
  const currentProjectId = useStore((s) => s.currentProjectId)
  const viewingDay = useStore((s) => s.viewingDay)
  const viewMode = useStore((s) => s.viewMode)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    load()
  }, [load])

  // Auto-write to the chosen backup folder whenever the persistent slices
  // (projects / entries) change. Debounced so a burst of edits collapses
  // into a single file write. Only fires after `loaded` flips true so we
  // don't overwrite the user's backup with the empty initial state during
  // boot.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const writeBackup = () => {
      const { backupHandle, loaded } = useStore.getState()
      if (!backupHandle || !loaded) return
      // Pure query — never request permission here. Auto-writes run far
      // from any user gesture and Chrome rejects `requestPermission`
      // outside user-activation. If the saved handle's permission has
      // lapsed, surface a hint so the user can re-grant via the gear
      // popover (clicking re-pick fires a fresh gesture).
      hasPermission(backupHandle)
        .then((ok) => {
          if (!ok) {
            useStore.setState({
              backupError:
                'Backup folder access has expired. Click the gear icon to re-pick the folder.',
            })
            return null
          }
          return exportAllAsJson()
        })
        .then((json) => {
          if (json === null || json === undefined) return
          return writeBackupFile(backupHandle, json).then(() => {
            useStore.setState({ backupError: null })
          })
        })
        .catch((err: unknown) => {
          useStore.setState({
            backupError: err instanceof Error ? err.message : 'Backup failed.',
          })
        })
    }
    const unsub = useStore.subscribe((state, prev) => {
      if (
        state.projects === prev.projects &&
        state.entriesByProject === prev.entriesByProject &&
        state.bentoTree === prev.bentoTree
      ) {
        return
      }
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(writeBackup, 1000)
    })
    return () => {
      if (timer !== null) clearTimeout(timer)
      unsub()
    }
  }, [])

  if (!loaded) return null

  if (creating) {
    return (
      <CreateProject
        onCancel={() => setCreating(false)}
        onCreated={() => setCreating(false)}
      />
    )
  }

  // Routing decisions are made against the projects that *existed* on the
  // viewed day. On today this is the full list; on a past day, projects
  // created later are filtered out so the user can't browse a project that
  // didn't exist yet.
  const today = todayKey()
  const activeDay = viewingDay ?? today
  const isOnToday = activeDay === today
  const historicalProjects = isOnToday
    ? projects
    : projects.filter((p) => todayKey(p.createdAt) <= activeDay)

  // Defensive: a stale currentProjectId could point to a project that was
  // created after the viewed day. Treat as "no current project" so we route
  // to landing instead of an impossible detail view.
  const currentExistsOnActiveDay =
    currentProjectId !== null &&
    historicalProjects.some((p) => p.id === currentProjectId)

  if (historicalProjects.length === 0) {
    return (
      <>
        <EmptyState
          onCreate={() => setCreating(true)}
          historicalDayLabel={
            isOnToday ? undefined : formatDayLabel(activeDay)
          }
        />
        <BottomBar onCreate={() => setCreating(true)} />
      </>
    )
  }

  // Status mode = cross-project rollup. Aggregates entries from every project
  // into the same five sections, day-filtered like single-project Status,
  // with a per-entry project tag (color swatch + name).
  if (viewMode === 'status') {
    return (
      <>
        <OverviewView />
        <BottomBar onCreate={() => setCreating(true)} />
      </>
    )
  }

  // 2+ projects with nothing valid selected → edge-to-edge split landing.
  if (!currentExistsOnActiveDay && historicalProjects.length > 1) {
    return (
      <>
        <ProjectsLanding onCreate={() => setCreating(true)} />
        <BottomBar onCreate={() => setCreating(true)} />
      </>
    )
  }

  // 1 historical project, or a specific selection that did exist on activeDay.
  return (
    <>
      <StatusView onCreate={() => setCreating(true)} />
      <BottomBar onCreate={() => setCreating(true)} />
    </>
  )
}
