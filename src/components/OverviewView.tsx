import { useMemo } from 'react'
import { useStore } from '../lib/store'
import type { Entry, Project } from '../lib/types'
import { sameDay, todayKey } from '../lib/date'
import Section from './Section'
import HitArea from './HitArea'

/**
 * Cross-project Status view. Flattens entries from every project into the
 * same five sections that single-project Status uses, with a project-color
 * tag on each card so users can tell which project it came from.
 *
 * Filter rules per section (mirrored from single-project StatusView):
 *  - Backlog / To-do: ALL entries of that kind, no day filter (these
 *    persist across midnight; rolling list across days)
 *  - Delivered: filtered by `movedAt` falling on activeDay
 *  - Decision / Learning: filtered by `createdAt` falling on activeDay
 *
 * Sort: newest-first by createdAt within each section. No project grouping —
 * cross-project entries interleave naturally, distinguished by color tag.
 *
 * No AddEntry inputs here — the cross-project view is for reviewing /
 * editing existing entries. Drag (todo ↔ backlog ↔ delivered) is preserved
 * because it preserves the entry's project; only kind changes.
 */
export default function OverviewView() {
  const projects = useStore((s) => s.projects)
  const entriesByProject = useStore((s) => s.entriesByProject)
  const viewingDay = useStore((s) => s.viewingDay)
  const dragPreview = useStore((s) => s.dragPreview)
  const statusTheme = useStore((s) => s.statusTheme)
  const setStatusTheme = useStore((s) => s.setStatusTheme)

  const today = todayKey()
  const activeDay = viewingDay ?? today

  // Project lookup table powers the per-entry color tag without making each
  // EntryItem do its own scan.
  const projectsById = useMemo(() => {
    const map: Record<string, Project> = {}
    for (const p of projects) map[p.id] = p
    return map
  }, [projects])

  // Flatten and bucket. We respect the in-flight `dragPreview` state so a
  // dragged card visually jumps to its preview section, just like in the
  // single-project view.
  const { backlog, todo, delivered, decision, learning } = useMemo(() => {
    const all: Entry[] = []
    for (const p of projects) {
      const list = entriesByProject[p.id] ?? []
      for (const e of list) all.push(e)
    }

    const visibleKind = (e: Entry) =>
      dragPreview?.entryId === e.id ? dragPreview.previewKind : e.kind

    const backlog = all.filter((e) => visibleKind(e) === 'backlog')
    const todo = all.filter((e) => visibleKind(e) === 'todo')
    const delivered = all.filter((e) => {
      if (dragPreview?.entryId === e.id) {
        return dragPreview.previewKind === 'delivered'
      }
      return e.kind === 'delivered' && sameDay(e.movedAt, activeDay)
    })
    const decision = all.filter(
      (e) => e.kind === 'decision' && sameDay(e.createdAt, activeDay),
    )
    const learning = all.filter(
      (e) => e.kind === 'learning' && sameDay(e.createdAt, activeDay),
    )

    // Newest-first within each section. Stable sort keeps drop-in order
    // amongst entries with identical createdAt (rare, but possible if two
    // were typed in the same millisecond).
    const byNewest = (a: Entry, b: Entry) => b.createdAt - a.createdAt
    backlog.sort(byNewest)
    todo.sort(byNewest)
    delivered.sort(byNewest)
    decision.sort(byNewest)
    learning.sort(byNewest)

    return { backlog, todo, delivered, decision, learning }
  }, [projects, entriesByProject, dragPreview, activeDay])

  const isDark = statusTheme === 'dark'
  const toggleTheme = () => setStatusTheme(isDark ? 'light' : 'dark')

  // Header label mirrors the BottomBar snapshot copy: "Today" or "Mon, May 6".
  const headerDate = (() => {
    if (activeDay === today) return 'Today'
    const [y, m, d] = activeDay.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  })()

  return (
    <main
      className={`${isDark ? 'dark ' : ''}h-screen overflow-hidden flex flex-col px-12 py-8 pb-20 bg-stone-100 dark:bg-plot-ink text-plot-ink dark:text-stone-100`}
    >
      <header className="mb-6 flex items-start justify-between gap-8 shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-[5rem] leading-none tracking-tight uppercase">
            Status
          </h1>
          <div className="mt-3 font-mono uppercase tracking-[0.25em] text-[10px] text-plot-ink/60 dark:text-stone-100/60">
            {headerDate} · across all plots
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-3">
          <HitArea
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="text-plot-ink/75 hover:text-plot-ink dark:text-stone-100/75 dark:hover:text-stone-100 transition-colors"
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </HitArea>
        </div>
      </header>

      <div className="grid grid-cols-5 gap-10 flex-1 min-h-0">
        <Section
          title="Backlog"
          kind="backlog"
          entries={backlog}
          projectsById={projectsById}
        />
        <Section
          title="To-do"
          kind="todo"
          entries={todo}
          projectsById={projectsById}
        />
        <Section
          title="Delivered"
          kind="delivered"
          entries={delivered}
          projectsById={projectsById}
        />
        <Section
          title="Decision"
          kind="decision"
          entries={decision}
          projectsById={projectsById}
        />
        <Section
          title="Learning"
          kind="learning"
          entries={learning}
          projectsById={projectsById}
        />
      </div>
    </main>
  )
}

function SunIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}
