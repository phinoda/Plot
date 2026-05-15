import { useEffect, useState } from 'react'
import { useStore } from '../lib/store'
import { todayKey } from '../lib/date'
import { useStats } from '../lib/stats'
import EmptyStats from './EmptyStats'
import HitArea from './HitArea'
import BigDelivered from './stats/BigDelivered'
import StreakBars from './stats/StreakBars'
import Heatmap30 from './stats/Heatmap30'
import Radar from './stats/Radar'
import Streamgraph from './stats/Streamgraph'

/** Renders "today ending in Xh Ym". Re-renders each minute via the
 *  ticker hook below so the displayed value stays roughly fresh. */
function formatTimeLeftToday(): string {
  const now = new Date()
  const eod = new Date(now)
  eod.setHours(23, 59, 59, 999)
  const diffMs = Math.max(0, eod.getTime() - now.getTime())
  const hours = Math.floor(diffMs / 3_600_000)
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000)
  return `${hours}h ${minutes}m`
}

/** Force a re-render every minute so the countdown stays current
 *  without the user reloading. */
function useMinuteTick(enabled: boolean) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [enabled])
}

/**
 * Stats dashboard. Cross-project, view-only — never mutates store.
 * Reads `viewingDay` so the calendar in the BottomBar acts as a
 * window-end picker (the 30-day rolling window slides backward to end
 * at whatever day the user picked). Inherits `statusTheme` from the
 * shared OverviewView setting so the user only manages one toggle.
 */
export default function StatsView() {
  const viewingDay = useStore((s) => s.viewingDay)
  const statusTheme = useStore((s) => s.statusTheme)
  const setStatusTheme = useStore((s) => s.setStatusTheme)

  const today = todayKey()
  const activeDay = viewingDay ?? today
  const isOnToday = activeDay === today
  const isDark = statusTheme === 'dark'

  // Tick the clock every minute, but only when we're actually showing
  // the countdown (today view). Past-day views don't need to refresh.
  useMinuteTick(isOnToday)

  const stats = useStats(activeDay)

  // Empty-state gate. Triggers strictly on lifetime entries — once
  // unlocked, the dashboard always renders even if a particular
  // calendar window happens to be sparse.
  if (stats.totalEntriesAllTime < 10) {
    return <EmptyStats count={stats.totalEntriesAllTime} isDark={isDark} />
  }

  return (
    <main
      className={`${isDark ? 'dark ' : ''}min-h-screen overflow-y-auto px-12 py-10 pb-24 bg-stone-100 dark:bg-plot-ink text-plot-ink dark:text-stone-100`}
    >
      {/* Compact header — no big "STATS" wordmark. Just two lines of
          mono small caps, one for the window length and one for either
          the live midnight countdown (today view) or the past-day
          window-end label. */}
      <header className="mb-12 flex items-start justify-between gap-8">
        <div className="flex flex-col gap-1.5">
          <div className="font-mono uppercase tracking-[0.25em] text-[11px] text-plot-ink/70 dark:text-stone-100/70">
            last 30 days
          </div>
          <div className="font-mono uppercase tracking-[0.25em] text-[11px] text-plot-ink/45 dark:text-stone-100/45">
            {isOnToday
              ? `today ending in ${formatTimeLeftToday()}`
              : `ending ${formatPastDay(activeDay)}`}
          </div>
        </div>
        <HitArea
          onClick={() => setStatusTheme(isDark ? 'light' : 'dark')}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="text-plot-ink/75 hover:text-plot-ink dark:text-stone-100/75 dark:hover:text-stone-100 transition-colors shrink-0"
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </HitArea>
      </header>

      {/* Two-column layout:
            LEFT  — hero numbers stack: big delivered count + the
                    per-project streak list right below it (capped
                    height + internal scroll so a 30-plot user
                    doesn't get an endless ladder).
            RIGHT — visual analytics: heatmap on top, then radar
                    and streamgraph side by side underneath.
          This balances the page horizontally — no more empty right
          half forcing a tall vertical scroll. */}
      <div className="grid grid-cols-12 gap-x-12 gap-y-20">
        <div className="col-span-12 md:col-span-5 flex flex-col gap-20">
          <BigDelivered count={stats.bigDelivered} />
          <StreakBars rows={stats.streaks} />
        </div>

        <div className="col-span-12 md:col-span-7 flex flex-col gap-20">
          <Heatmap30 days={stats.heatmap} />
          <Radar axes={stats.radar} />
          <Streamgraph
            days={stats.streamgraph}
            projects={stats.streamProjects}
          />
        </div>
      </div>
    </main>
  )
}

function formatPastDay(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

// Local copies of the sun/moon icons — keeps StatsView from reaching
// into OverviewView for visual primitives.
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
