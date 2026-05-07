/** YYYY-MM-DD in the user's local timezone. */
export function todayKey(now: number = Date.now()): string {
  const d = new Date(now)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Whether `ts` falls on the same local calendar day as `now`. */
export function isToday(ts: number, now: number = Date.now()): boolean {
  return todayKey(ts) === todayKey(now)
}

/** Whether `ts` falls on the same local calendar day as `dayKey` (YYYY-MM-DD). */
export function sameDay(ts: number, dayKey: string): boolean {
  return todayKey(ts) === dayKey
}

/** Friendly label for the bottom bar: "Today" if today, otherwise "Mon, May 6". */
export function formatDayLabel(
  dayKey: string,
  now: number = Date.now(),
): string {
  if (dayKey === todayKey(now)) return 'Today'
  const [y, m, d] = dayKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
