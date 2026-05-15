import { useStore } from './store'
import { todayKey } from './date'
import { projectsForDay } from './projects'
import type { Entry, EntryKind, ProjectColor } from './types'

/**
 * Stats are always computed against a 30-day rolling window ending at the
 * user's currently-viewed day (today by default; the calendar lets them
 * pick a past endpoint to peek at older snapshots). Keeping window size
 * fixed simplifies normalization across views.
 */
export const STATS_WINDOW_DAYS = 30
const MS_PER_DAY = 24 * 60 * 60 * 1000

export type RadarAxis = {
  label: string
  value: number
  detail: string
  tooltip?: string
}

export type StreakRow = {
  projectId: string
  name: string
  color: ProjectColor
  days: number
}

export type HeatmapEntry = {
  id: string
  kind: EntryKind
  activity: 'created' | 'moved'
  /** Best display text for the entry: title for workflow kinds, body
   *  for journal kinds, deliverable / parkedReason for those that have
   *  it. May be empty if the entry was created without content. */
  preview: string
  projectName: string
  projectColor: ProjectColor
}

export type HeatmapDay = {
  dayKey: string
  count: number
  entries: HeatmapEntry[]
}

export type StreamProject = { id: string; name: string; color: ProjectColor }
export type StreamDay = {
  dayKey: string
  perProject: { id: string; count: number }[]
}

export type StatsData = {
  /** Used by the empty-state gate. We unlock the dashboard at >= 10. */
  totalEntriesAllTime: number
  /** Window-ending day in YYYY-MM-DD. Echoed back so the header can show it. */
  windowEndKey: string

  bigDelivered: number
  streaks: StreakRow[]

  heatmap: HeatmapDay[]
  radar: RadarAxis[]
  streamgraph: StreamDay[]
  streamProjects: StreamProject[]
}

/** YYYY-MM-DD at the start of `daysBack` days before `endKey`, oldest
 *  first — i.e. windowDays(today)[0] is 29 days ago and last is today. */
function buildWindowDays(endKey: string, count: number): string[] {
  const [y, m, d] = endKey.split('-').map(Number)
  const endDate = new Date(y, m - 1, d)
  const days: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(endDate.getTime() - i * MS_PER_DAY)
    days.push(todayKey(date.getTime()))
  }
  return days
}

/** Walk back from `startKey` one day at a time as long as `activeDays`
 *  has an entry for the current day. Cap at 365 to avoid pathological
 *  loops if data is somehow corrupt.
 *
 *  Today gets a grace period: if `startKey` itself has no activity,
 *  we don't break the streak right away — we drop the cursor to the
 *  previous day and start counting from there. Rationale: "today" is
 *  still in progress; a user who logged something yesterday but
 *  hasn't yet today should still see a meaningful streak instead of
 *  getting punished mid-day. The streak only truly resets when
 *  TWO consecutive empty days exist at the front. */
function computeStreakFromActiveDays(
  startKey: string,
  activeDays: Set<string>,
  allowFrontGrace: boolean,
): number {
  const [y, m, d] = startKey.split('-').map(Number)
  const cursor = new Date(y, m - 1, d)
  // Skip today if it's empty — fall back to yesterday as the start.
  if (allowFrontGrace && !activeDays.has(todayKey(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1)
  }
  let streak = 0
  while (streak < 365) {
    const key = todayKey(cursor.getTime())
    if (!activeDays.has(key)) break
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/**
 * Compute everything the Stats dashboard needs from the store snapshot
 * + a window-end day key. Pure function of inputs (memoized in the
 * hook below). Each chart receives its slice; nothing in this module
 * touches DOM or React state.
 */
export function computeStats(
  projects: { id: string; name: string; color: ProjectColor }[],
  entriesByProject: Record<string, Entry[]>,
  windowEndKey: string,
): StatsData {
  // Flatten — most computations want a single sweep.
  const allEntries: Entry[] = []
  for (const p of projects) {
    for (const e of entriesByProject[p.id] ?? []) allEntries.push(e)
  }

  const totalEntriesAllTime = allEntries.length

  const windowDays = buildWindowDays(windowEndKey, STATS_WINDOW_DAYS)
  const windowStartKey = windowDays[0]
  const isWindowEndingToday = windowEndKey === todayKey()
  const inWindowKey = (key: string) =>
    key >= windowStartKey && key <= windowEndKey

  // ---- Big number: deliveries that landed inside the window ----
  let bigDelivered = 0
  for (const e of allEntries) {
    if (e.kind === 'delivered' && inWindowKey(todayKey(e.movedAt))) {
      bigDelivered++
    }
  }

  // ---- Per-project streaks (creation or latest move, walks back from
  // window end; uncapped by window so a long-running streak shows
  // its true length even if it pre-dates the 30-day window). ----
  const streaks: StreakRow[] = projects.map((p) => {
    const list = entriesByProject[p.id] ?? []
    const activeDays = new Set<string>()
    for (const e of list) {
      activeDays.add(todayKey(e.createdAt))
      if (e.movedAt !== e.createdAt) activeDays.add(todayKey(e.movedAt))
    }
    return {
      projectId: p.id,
      name: p.name,
      color: p.color,
      days: computeStreakFromActiveDays(
        windowEndKey,
        activeDays,
        isWindowEndingToday,
      ),
    }
  })
  streaks.sort((a, b) => b.days - a.days)

  // ---- Heatmap: counts + per-day entry list (for hover tooltip) ----
  const projectsById = new Map<string, { name: string; color: ProjectColor }>()
  for (const p of projects) projectsById.set(p.id, { name: p.name, color: p.color })

  const dayEntries = new Map<string, HeatmapEntry[]>()
  const addActivity = (e: Entry, activity: HeatmapEntry['activity']) => {
    const ts = activity === 'created' ? e.createdAt : e.movedAt
    const k = todayKey(ts)
    if (!inWindowKey(k)) return
    const proj = projectsById.get(e.projectId)
    if (!proj) return
    if (!dayEntries.has(k)) dayEntries.set(k, [])
    // Pick the most descriptive text the entry has for the tooltip.
    const preview =
      e.title?.trim() ||
      e.body?.trim() ||
      e.deliverable?.trim() ||
      e.parkedReason?.trim() ||
      ''
    dayEntries.get(k)!.push({
      id: e.id,
      kind: e.kind,
      activity,
      preview,
      projectName: proj.name,
      projectColor: proj.color,
    })
  }
  for (const e of allEntries) {
    addActivity(e, 'created')
    if (e.movedAt !== e.createdAt) addActivity(e, 'moved')
  }
  const heatmap: HeatmapDay[] = windowDays.map((k) => ({
    dayKey: k,
    count: dayEntries.get(k)?.length ?? 0,
    entries: dayEntries.get(k) ?? [],
  }))

  // ---- Radar: 6 axes, all normalized to 0-100 ----
  // Completion: percent of 30-day workflow entries that are delivered.
  // A = To-do/Delivered entries created in-window that currently sit in
  // Delivered. B = all To-do/Delivered entries created in-window.
  let workflowInWindow = 0
  let deliveredWorkflowInWindow = 0
  for (const e of allEntries) {
    if (!inWindowKey(todayKey(e.createdAt))) continue
    if (e.kind === 'todo' || e.kind === 'delivered') {
      workflowInWindow++
      if (e.kind === 'delivered') deliveredWorkflowInWindow++
    }
  }
  const completion =
    workflowInWindow === 0
      ? 0
      : Math.min(100, (deliveredWorkflowInWindow / workflowInWindow) * 100)

  // Clarity / Learning: share of created entries in the 30-day window.
  // Clarity pegs at 20% decisions; Learning pegs at 25% learnings.
  let decisionsInWindow = 0
  let learningsInWindow = 0
  let entriesCreatedInWindow = 0
  for (const e of allEntries) {
    if (!inWindowKey(todayKey(e.createdAt))) continue
    entriesCreatedInWindow++
    if (e.kind === 'decision') decisionsInWindow++
    else if (e.kind === 'learning') learningsInWindow++
  }
  const CLARITY_PEG = 0.2
  const LEARNING_PEG = 0.25
  const clarity = Math.min(
    100,
    entriesCreatedInWindow === 0
      ? 0
      : (decisionsInWindow / entriesCreatedInWindow / CLARITY_PEG) * 100,
  )
  const learning = Math.min(
    100,
    entriesCreatedInWindow === 0
      ? 0
      : (learningsInWindow / entriesCreatedInWindow / LEARNING_PEG) * 100,
  )

  // Consistency: active days since the first activity in this window.
  // If someone has only used Plot for two days and both days were active,
  // they should read as fully consistent for their observed usage span.
  const activeDayKeys = new Set(dayEntries.keys())
  const firstActiveIdx = windowDays.findIndex((k) => activeDayKeys.has(k))
  const consistencyDenominator =
    firstActiveIdx === -1 ? STATS_WINDOW_DAYS : windowDays.length - firstActiveIdx
  const consistency =
    consistencyDenominator === 0
      ? 0
      : (activeDayKeys.size / consistencyDenominator) * 100

  // Diversity: avg distinct projects touched per active day, scaled by
  // total project count. Single-project users always score 100 (every
  // active day touches their one project, which is 100% of projects).
  const projectsByDay = new Map<string, Set<string>>()
  const addProjectActivity = (e: Entry, ts: number) => {
    const k = todayKey(ts)
    if (!inWindowKey(k)) return
    if (!projectsByDay.has(k)) projectsByDay.set(k, new Set())
    projectsByDay.get(k)!.add(e.projectId)
  }
  for (const e of allEntries) {
    addProjectActivity(e, e.createdAt)
    if (e.movedAt !== e.createdAt) addProjectActivity(e, e.movedAt)
  }
  const sumProjectsTouched = Array.from(projectsByDay.values()).reduce(
    (s, set) => s + set.size,
    0,
  )
  const avgProjectsPerActiveDay =
    activeDayKeys.size > 0 ? sumProjectsTouched / activeDayKeys.size : 0
  const diversity =
    projects.length > 0
      ? Math.min(100, (avgProjectsPerActiveDay / projects.length) * 100)
      : 0

  // Hygiene: percent of 30-day observable backlog work that flowed out.
  // A = entries moved into To-do/Delivered in-window. B = A plus entries
  // still sitting in Backlog that were created or moved in-window. The data
  // model stores only latest kind/move timestamp, so this is the strongest
  // observable ratio without full transition history.
  let backlogOutflowInWindow = 0
  let backlogStillOpenInWindow = 0
  for (const e of allEntries) {
    const createdInWindow = inWindowKey(todayKey(e.createdAt))
    const movedInWindow = inWindowKey(todayKey(e.movedAt))
    if ((e.kind === 'todo' || e.kind === 'delivered') && movedInWindow) {
      if (e.movedAt !== e.createdAt) backlogOutflowInWindow++
    } else if (e.kind === 'backlog' && (createdInWindow || movedInWindow)) {
      backlogStillOpenInWindow++
    }
  }
  const backlogWorkInWindow = backlogOutflowInWindow + backlogStillOpenInWindow
  const hygiene =
    backlogWorkInWindow === 0
      ? 0
      : Math.min(100, (backlogOutflowInWindow / backlogWorkInWindow) * 100)

  const pct = (value: number) => `${Math.round(value)}%`

  const radar: RadarAxis[] = [
    {
      label: 'Completion',
      value: completion,
      detail: pct(completion),
      tooltip: 'The share of tasks that moved from To-do to Delivered.',
    },
    {
      label: 'Clarity',
      value: clarity,
      detail: pct(clarity),
      tooltip: 'How often you capture clear decisions across your projects.',
    },
    {
      label: 'Learning',
      value: learning,
      detail: pct(learning),
      tooltip: 'How often you capture clear learnings alongside your output.',
    },
    {
      label: 'Consistency',
      value: consistency,
      detail: pct(consistency),
      tooltip: 'How steadily you show up day after day.',
    },
    {
      label: 'Diversity',
      value: diversity,
      detail: pct(diversity),
      tooltip: 'Average project spread on active days.',
    },
    {
      label: 'Hygiene',
      value: hygiene,
      detail: pct(hygiene),
      tooltip: 'How often you move tasks out of Backlog into To-do or Delivered.',
    },
  ]

  // ---- Streamgraph: per-project per-day delivered counts ----
  // Only include projects that had at least one delivery in the window
  // (keeps the band stack from being padded with empty zero-bands for
  // every project the user has ever made).
  const streamProjectIds = new Set<string>()
  for (const e of allEntries) {
    if (
      e.kind === 'delivered' &&
      inWindowKey(todayKey(e.movedAt))
    ) {
      streamProjectIds.add(e.projectId)
    }
  }
  const streamProjects: StreamProject[] = projects
    .filter((p) => streamProjectIds.has(p.id))
    .map((p) => ({ id: p.id, name: p.name, color: p.color }))

  // For O(1) per-day-per-project lookup.
  const streamCounts = new Map<string, Map<string, number>>()
  for (const e of allEntries) {
    if (e.kind !== 'delivered') continue
    const k = todayKey(e.movedAt)
    if (!inWindowKey(k)) continue
    if (!streamCounts.has(k)) streamCounts.set(k, new Map())
    const day = streamCounts.get(k)!
    day.set(e.projectId, (day.get(e.projectId) ?? 0) + 1)
  }
  const streamgraph: StreamDay[] = windowDays.map((dayKey) => {
    const day = streamCounts.get(dayKey)
    return {
      dayKey,
      perProject: streamProjects.map((p) => ({
        id: p.id,
        count: day?.get(p.id) ?? 0,
      })),
    }
  })

  return {
    totalEntriesAllTime,
    windowEndKey,
    bigDelivered,
    streaks,
    heatmap,
    radar,
    streamgraph,
    streamProjects,
  }
}

/** Hook wrapper. Reads the latest store snapshot on every Stats render. */
export function useStats(activeDay: string): StatsData {
  const projects = useStore((s) => s.projects)
  const entriesByProject = useStore((s) => s.entriesByProject)
  return computeStats(
    projectsForDay(projects, activeDay),
    entriesByProject,
    activeDay,
  )
}
