import { useState } from 'react'
import type { HeatmapDay } from '../../lib/stats'
import { colorBg } from '../../lib/palette'

/**
 * 30-day activity heatmap. One cell per day, colored by activity count
 * relative to the busiest day in the window. Activity means entry creation
 * plus each entry's latest move when that move differs from creation.
 * Empty days render as
 * the lightest shade so the grid reads as a cohesive surface.
 *
 * Hovering a cell pops a tooltip above it with the date + the entries
 * that fell on that day (each carrying its source project's color
 * dot, so the user can see at a glance which plots they touched).
 */
export default function Heatmap30({ days }: { days: HeatmapDay[] }) {
  const maxCount = Math.max(1, ...days.map((d) => d.count))
  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <div>
      <div className="font-mono uppercase tracking-[0.25em] text-[10px] text-plot-ink/60 dark:text-stone-100/60 mb-3">
        activity
      </div>
      <div className="grid grid-cols-[repeat(15,1fr)] gap-[5px] max-w-[600px]">
        {days.map((d, i) => {
          // 0.08 floor so empty days are still subtly visible against
          // the page bg; 0.85 ceiling so the busiest day reads as
          // "filled" without going pure black.
          const intensity = d.count / maxCount
          const opacity = d.count === 0 ? 0.08 : 0.2 + intensity * 0.65
          return (
            <div key={d.dayKey} className="relative">
              <div
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered((cur) => (cur === i ? null : cur))}
                className="aspect-square rounded-sm bg-plot-ink dark:bg-stone-100 cursor-default"
                style={{ opacity }}
              />
              {hovered === i && <Tooltip day={d} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Floating tooltip above a hovered cell. Width capped so long entry
 *  titles wrap rather than push the popover off-screen. Always anchors
 *  bottom-of-tooltip to top-of-cell with a small mb gap. */
function Tooltip({ day }: { day: HeatmapDay }) {
  return (
    <div
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 bg-plot-ink dark:bg-stone-100 text-stone-100 dark:text-plot-ink rounded-md shadow-lg p-3 w-64 pointer-events-none"
    >
      <div className="font-mono uppercase tracking-[0.2em] text-[10px] opacity-70 mb-1.5">
        {formatDay(day.dayKey)} · {day.count} activities
      </div>
      {day.entries.length === 0 ? (
        <div className="text-[11px] opacity-60">no entries</div>
      ) : (
        <ul className="space-y-1">
          {day.entries.slice(0, 6).map((e) => (
            <li
              key={e.id}
              className="flex items-start gap-1.5 text-[11px] leading-snug"
            >
              <span
                className="block w-1.5 h-1.5 rounded-full mt-1 shrink-0"
                style={{ background: colorBg(e.projectColor) }}
                title={e.projectName}
              />
              <span className="break-words">
                <span className="font-mono uppercase tracking-[0.15em] opacity-60">
                  {e.activity}{' '}
                </span>
                {e.preview || (
                  <span className="opacity-60 italic">empty {e.kind}</span>
                )}
              </span>
            </li>
          ))}
          {day.entries.length > 6 && (
            <li className="text-[10px] opacity-60 pl-3">
              + {day.entries.length - 6} more
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

function formatDay(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
