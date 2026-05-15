import type { StreakRow } from '../../lib/stats'
import { colorBg } from '../../lib/palette'

/**
 * Per-project current streak as a clean number list — no bars. Each
 * row is independent, so users don't read length-comparisons into
 * what's really just a count of consecutive active days.
 *
 *   12  DAYS  ●  FIGTREE
 *    8  DAYS  ●  PLOT
 *    1  DAY   ●  KAFKA
 *
 * Projects with no current streak (0 days) are filtered out — they'd
 * just be dead rows. If every project is at zero, an empty-state line
 * takes the place of the list instead.
 *
 * Streak semantics (mirroring `lib/stats.ts`): only when the window ends
 * today, an empty today gets a grace period and the streak can start from
 * yesterday. Past-day windows are evaluated exactly at that selected day.
 */
export default function StreakBars({ rows }: { rows: StreakRow[] }) {
  const active = rows.filter((r) => r.days > 0)

  if (active.length === 0) {
    return (
      <div>
        <div className="font-mono uppercase tracking-[0.25em] text-[10px] text-plot-ink/60 dark:text-stone-100/60 mb-3">
          day streaks
        </div>
        <div className="font-mono uppercase tracking-[0.2em] text-[10px] text-plot-ink/40 dark:text-stone-100/40">
          no recent streaks
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[350px]">
      <div className="font-mono uppercase tracking-[0.25em] text-[10px] text-plot-ink/60 dark:text-stone-100/60 mb-3">
        day streaks
      </div>
      <ul className="space-y-2 font-mono">
        {active.map((row) => (
          <li
            key={row.projectId}
            className="flex items-center gap-3"
          >
            <span className="w-8 text-right text-[18px] tabular-nums">
              {row.days}
            </span>
            <span className="uppercase tracking-[0.2em] text-[10px] text-plot-ink/55 dark:text-stone-100/55 w-12">
              {row.days === 1 ? 'day' : 'days'}
            </span>
            <span
              className="block w-2 h-2 rounded-full shrink-0"
              style={{ background: colorBg(row.color) }}
            />
            <span className="uppercase tracking-[0.2em] text-[10px] text-plot-ink/80 dark:text-stone-100/80 truncate">
              {row.name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
