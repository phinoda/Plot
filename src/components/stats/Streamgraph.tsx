import { useRef, useState } from 'react'
import type { StreamDay, StreamProject } from '../../lib/stats'
import { colorBg } from '../../lib/palette'

/**
 * Stacked-area chart of daily delivered counts by project across the
 * 30-day window. Each project gets a band whose fill is its palette
 * color. Bands stack from the bottom in project-list order, so the
 * total height of the stack at day X = total deliveries that day.
 *
 * Hover anywhere in the chart to see the breakdown for the day under
 * the cursor: a vertical guide-line marks the column, and a tooltip
 * pinned to the top-left of the chart shows the date plus per-project
 * counts (sorted descending). The tooltip is absolute-positioned so
 * it never reshapes the surrounding layout.
 */
const WIDTH = 600
const HEIGHT = 140
const PADDING_X = 4
const PADDING_TOP = 8
const PADDING_BOTTOM = 14

export default function Streamgraph({
  days,
  projects,
}: {
  days: StreamDay[]
  projects: StreamProject[]
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (projects.length === 0 || days.length === 0) {
    return (
      <div>
        <div className="font-mono uppercase tracking-[0.25em] text-[10px] text-plot-ink/60 dark:text-stone-100/60 mb-3">
          delivered by project
        </div>
        <div className="font-mono uppercase tracking-[0.2em] text-[10px] text-plot-ink/40 dark:text-stone-100/40 py-12">
          no deliveries in this window
        </div>
      </div>
    )
  }

  // Total deliveries per day, used to scale the y-axis so the busiest
  // day reaches the top of the chart's drawable area.
  const dayTotals = days.map((d) =>
    d.perProject.reduce((s, p) => s + p.count, 0),
  )
  const maxTotal = Math.max(1, ...dayTotals)

  const innerH = HEIGHT - PADDING_TOP - PADDING_BOTTOM
  const innerW = WIDTH - PADDING_X * 2
  const colWidth = days.length > 1 ? innerW / (days.length - 1) : innerW

  // For each day, accumulate per-project y-stops from bottom to top.
  // stopsByDay[dayIndex][projectIndex] = top-of-band y-coordinate.
  // Same array works for every project's path — we just slice the
  // top/bottom edges out.
  const stopsByDay: number[][] = days.map((d) => {
    let acc = 0
    const stops = [HEIGHT - PADDING_BOTTOM] // baseline (bottom)
    for (const p of projects) {
      const slot = d.perProject.find((pp) => pp.id === p.id)
      acc += slot?.count ?? 0
      const y = HEIGHT - PADDING_BOTTOM - (acc / maxTotal) * innerH
      stops.push(y)
    }
    return stops
  })

  const xAt = (i: number) => PADDING_X + colWidth * i

  const buildBandPath = (projectIdx: number): string => {
    const topIdx = projectIdx + 1
    const botIdx = projectIdx
    let path = ''
    days.forEach((_, i) => {
      const cmd = i === 0 ? 'M' : 'L'
      path += `${cmd}${xAt(i)},${stopsByDay[i][topIdx]} `
    })
    for (let i = days.length - 1; i >= 0; i--) {
      path += `L${xAt(i)},${stopsByDay[i][botIdx]} `
    }
    path += 'Z'
    return path
  }

  // Translate a mouse position over the SVG into a day-index. We map
  // the cursor's pixel x back into viewBox space and snap to the
  // nearest column.
  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const ratio = WIDTH / rect.width
    const vbX = (e.clientX - rect.left) * ratio
    const idx = Math.round((vbX - PADDING_X) / colWidth)
    setHoveredIdx(Math.max(0, Math.min(days.length - 1, idx)))
  }

  // Per-day tooltip data: project rows for the hovered column,
  // sorted by count desc and dropping zero-count projects.
  const hoveredDay = hoveredIdx !== null ? days[hoveredIdx] : null
  const hoveredRows = hoveredDay
    ? hoveredDay.perProject
        .map((pp) => {
          const meta = projects.find((p) => p.id === pp.id)
          return meta ? { ...meta, count: pp.count } : null
        })
        .filter((r): r is StreamProject & { count: number } => r !== null && r.count > 0)
        .sort((a, b) => b.count - a.count)
    : []
  const hoveredTotal = hoveredDay
    ? hoveredDay.perProject.reduce((s, p) => s + p.count, 0)
    : 0

  return (
    <div className="relative max-w-[600px]">
      <div className="font-mono uppercase tracking-[0.25em] text-[10px] text-plot-ink/60 dark:text-stone-100/60 mb-3">
        delivered by project
      </div>

      {/* Tooltip (absolute, pinned top-left over the chart). Renders
          only on hover; doesn't take layout space. */}
      {hoveredDay && (
        <div className="absolute top-7 left-0 z-30 bg-plot-ink dark:bg-stone-100 text-stone-100 dark:text-plot-ink rounded-md shadow-lg p-3 w-[200px] pointer-events-none">
          <div className="font-mono uppercase tracking-[0.2em] text-[10px] mb-1.5 opacity-70">
            {formatDay(hoveredDay.dayKey)} · {hoveredTotal}
          </div>
          {hoveredRows.length === 0 ? (
            <div className="text-[11px] opacity-60">no deliveries</div>
          ) : (
            <ul className="space-y-1">
              {hoveredRows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-1.5 text-[11px]"
                >
                  <span
                    className="block w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: colorBg(r.color) }}
                  />
                  <span className="tabular-nums w-4 text-right">
                    {r.count}
                  </span>
                  <span className="opacity-75 truncate">{r.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="block cursor-crosshair"
        style={{ maxHeight: HEIGHT }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {/* Baseline */}
        <line
          x1={PADDING_X}
          y1={HEIGHT - PADDING_BOTTOM}
          x2={WIDTH - PADDING_X}
          y2={HEIGHT - PADDING_BOTTOM}
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={1}
        />
        {projects.map((p, i) => (
          <path
            key={p.id}
            d={buildBandPath(i)}
            fill={colorBg(p.color)}
            fillOpacity={0.85}
          />
        ))}
        {/* Hover guide line */}
        {hoveredIdx !== null && (
          <line
            x1={xAt(hoveredIdx)}
            y1={PADDING_TOP}
            x2={xAt(hoveredIdx)}
            y2={HEIGHT - PADDING_BOTTOM}
            stroke="currentColor"
            strokeOpacity={0.5}
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        )}
      </svg>

      {/* Legend below the chart — one chip per project, color-coded. */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {projects.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-1.5 font-mono uppercase tracking-[0.2em] text-[10px] text-plot-ink/70 dark:text-stone-100/70"
          >
            <span
              className="block w-2 h-2 rounded-full"
              style={{ background: colorBg(p.color) }}
            />
            <span>{p.name}</span>
          </li>
        ))}
      </ul>
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
