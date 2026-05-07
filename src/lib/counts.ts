import type { Entry } from './types'
import { sameDay, todayKey } from './date'

/**
 * Counts that drive the project rectangle on the treemap.
 * All counts are scoped to a specific day (defaults to today). When the user
 * selects a past day in the bottom-bar calendar, callers pass that dayKey so
 * the landing tiles reflect what was happening on that day.
 *
 * `todoActive` is special: it's the live size of the To-do column right now,
 * regardless of viewing day, since past To-do state isn't persisted.
 */
export type ProjectCounts = {
  todoActive: number
  deliveredToday: number
  totalToday: number
  /** null when totalToday is 0 — UI renders `—`. */
  completionPct: number | null
  backlogToday: number
  decisionToday: number
  learningToday: number
}

export function computeCounts(
  entries: Entry[],
  dayKey: string = todayKey(),
): ProjectCounts {
  const todoActive = entries.filter((e) => e.kind === 'todo').length
  const deliveredToday = entries.filter(
    (e) => e.kind === 'delivered' && sameDay(e.movedAt, dayKey),
  ).length
  const totalToday = todoActive + deliveredToday
  const completionPct =
    totalToday === 0 ? null : Math.round((deliveredToday / totalToday) * 100)
  const backlogToday = entries.filter(
    (e) => e.kind === 'backlog' && sameDay(e.movedAt, dayKey),
  ).length
  const decisionToday = entries.filter(
    (e) => e.kind === 'decision' && sameDay(e.createdAt, dayKey),
  ).length
  const learningToday = entries.filter(
    (e) => e.kind === 'learning' && sameDay(e.createdAt, dayKey),
  ).length
  return {
    todoActive,
    deliveredToday,
    totalToday,
    completionPct,
    backlogToday,
    decisionToday,
    learningToday,
  }
}
