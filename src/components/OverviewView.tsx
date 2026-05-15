import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import type { Entry, Project } from '../lib/types'
import { sameDay, todayKey } from '../lib/date'
import { isTodayView, projectsForDay } from '../lib/projects'
import Section from './Section'
import HitArea from './HitArea'

/**
 * Substring match across every text field on the entry. Tag matches fall
 * out for free — tags live inline as `#name` patterns in the same text
 * fields, so a query starting with `#` naturally narrows to tag hits and
 * a plain query matches both prose and tag text. Case-insensitive.
 */
function entryMatchesQuery(e: Entry, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true
  const fields: (string | undefined)[] = [
    e.title,
    e.body,
    e.deliverable,
    e.parkedReason,
  ]
  for (const f of fields) {
    if (f && f.toLowerCase().includes(normalizedQuery)) return true
  }
  return false
}

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

  // Local search state — not persisted. Empty = no filter.
  // The search input is hidden by default; clicking the magnifier toggles
  // it open and reveals the underline-only input. Closing also clears the
  // query so filter snaps back to "show everything".
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const normalizedQuery = query.trim().toLowerCase()
  const closeSearch = () => {
    setQuery('')
    setSearchOpen(false)
  }

  const today = todayKey()
  const activeDay = viewingDay ?? today
  const readOnly = !isTodayView(viewingDay)
  const visibleProjects = useMemo(
    () => projectsForDay(projects, activeDay),
    [projects, activeDay],
  )

  // Project lookup table powers the per-entry color tag without making each
  // EntryItem do its own scan.
  const projectsById = useMemo(() => {
    const map: Record<string, Project> = {}
    for (const p of visibleProjects) map[p.id] = p
    return map
  }, [visibleProjects])

  // Flatten and bucket. We respect the in-flight `dragPreview` state so a
  // dragged card visually jumps to its preview section, just like in the
  // single-project view.
  const { backlog, todo, delivered, decision, learning } = useMemo(() => {
    const all: Entry[] = []
    for (const p of visibleProjects) {
      const list = entriesByProject[p.id] ?? []
      for (const e of list) all.push(e)
    }

    const visibleKind = (e: Entry) =>
      dragPreview?.entryId === e.id ? dragPreview.previewKind : e.kind

    const matches = (e: Entry) => entryMatchesQuery(e, normalizedQuery)

    const backlog = all.filter(
      (e) => visibleKind(e) === 'backlog' && matches(e),
    )
    const todo = all.filter((e) => visibleKind(e) === 'todo' && matches(e))
    const delivered = all.filter((e) => {
      if (dragPreview?.entryId === e.id) {
        return dragPreview.previewKind === 'delivered' && matches(e)
      }
      return (
        e.kind === 'delivered' &&
        sameDay(e.movedAt, activeDay) &&
        matches(e)
      )
    })
    const decision = all.filter(
      (e) =>
        e.kind === 'decision' &&
        sameDay(e.createdAt, activeDay) &&
        matches(e),
    )
    const learning = all.filter(
      (e) =>
        e.kind === 'learning' &&
        sameDay(e.createdAt, activeDay) &&
        matches(e),
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
  }, [visibleProjects, entriesByProject, dragPreview, activeDay, normalizedQuery])

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

        <div className="shrink-0 flex items-start gap-[40px]">
          {/* Search affordance: collapsed → just the magnifier icon. Click
              expands an underline-only input below it. The magnifier is
              right-aligned within the search column so it stays at the
              same screen position whether the input is open or closed —
              opening just grows the input leftward beneath it, no icon
              jump. Substring match across every text field on entries;
              `#tag` queries naturally narrow to tag matches because tags
              live inline as `#xxx` in the same fields. */}
          <div className="flex flex-col items-end gap-1.5">
            <HitArea
              onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
              aria-label={searchOpen ? 'Close search' : 'Search entries'}
              title={searchOpen ? 'Close search' : 'Search entries'}
              className="text-plot-ink/75 hover:text-plot-ink dark:text-stone-100/75 dark:hover:text-stone-100 transition-colors"
            >
              <SearchIcon />
            </HitArea>
            {searchOpen && (
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return
                  if (e.key === 'Escape') closeSearch()
                }}
                aria-label="Search entries"
                // -mt-5 pulls the input up 20px so the underline sits
                // right beneath the magnifier instead of dropping a tall
                // visual gap between them. The input box overlaps the
                // magnifier on the rightmost ~14px, but the magnifier
                // sits on the right edge while text is left-aligned, so
                // typed content never lands under the icon.
                className="-mt-5 w-48 bg-transparent outline-none border-b border-plot-ink/40 dark:border-stone-100/40 focus:border-plot-ink dark:focus:border-stone-100 text-[12px] py-0.5 transition-colors"
              />
            )}
          </div>
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
          readOnly={readOnly}
        />
        <Section
          title="To-do"
          kind="todo"
          entries={todo}
          projectsById={projectsById}
          readOnly={readOnly}
        />
        <Section
          title="Delivered"
          kind="delivered"
          entries={delivered}
          projectsById={projectsById}
          readOnly={readOnly}
        />
        <Section
          title="Decision"
          kind="decision"
          entries={decision}
          projectsById={projectsById}
          readOnly={readOnly}
        />
        <Section
          title="Learning"
          kind="learning"
          entries={learning}
          projectsById={projectsById}
          readOnly={readOnly}
        />
      </div>
    </main>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="20" y1="20" x2="16" y2="16" />
    </svg>
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
