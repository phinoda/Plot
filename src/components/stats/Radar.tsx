import { useState } from 'react'
import type { RadarAxis } from '../../lib/stats'

/**
 * 6-axis radar chart. Each axis is normalized to 0-100 by `lib/stats`.
 * The grid rings are 25/50/75/100%.
 */
const SIZE = 280
const PADDING = 60
const CX = SIZE / 2
const CY = SIZE / 2
const RADIUS = (SIZE - PADDING * 2) / 2 + 20
const RING_FRACTIONS = [0.25, 0.5, 0.75, 1.0]
const TOOLTIP_W = 220

function pointAt(angleRad: number, r: number): [number, number] {
  return [CX + Math.cos(angleRad) * r, CY + Math.sin(angleRad) * r]
}

export default function Radar({ axes }: { axes: RadarAxis[] }) {
  const n = axes.length
  // -PI/2 puts the first axis at top-12-o'clock instead of 3-o'clock.
  const angle = (i: number) => (i / n) * Math.PI * 2 - Math.PI / 2
  const [hovered, setHovered] = useState<number | null>(null)

  // Concentric grid polygons (one per ring fraction).
  const ringPoints = (rf: number) =>
    axes
      .map((_, i) => {
        const [x, y] = pointAt(angle(i), RADIUS * rf)
        return `${x},${y}`
      })
      .join(' ')

  // The data polygon — value mapped to radius proportionally.
  const dataPoints = axes
    .map((a, i) => {
      const r = (RADIUS * Math.max(0, Math.min(100, a.value))) / 100
      const [x, y] = pointAt(angle(i), r)
      return `${x},${y}`
    })
    .join(' ')

  const tooltipStyle = (() => {
    if (hovered === null) return undefined
    const labelR = RADIUS + 22
    const [x, y] = pointAt(angle(hovered), labelR)
    const left = Math.max(0, Math.min(SIZE - TOOLTIP_W, x - TOOLTIP_W / 2))
    const top = y < CY ? y + 16 : y - 16
    return {
      left,
      top,
      width: TOOLTIP_W,
      transform: y < CY ? 'translateY(0)' : 'translateY(-100%)',
    }
  })()

  return (
    <div className="relative" style={{ width: SIZE }}>
      <div className="font-mono uppercase tracking-[0.25em] text-[10px] text-plot-ink/60 dark:text-stone-100/60 mb-3">
        work shape
      </div>
      <div className="font-mono uppercase tracking-[0.18em] text-[9px] text-plot-ink/35 dark:text-stone-100/35 mb-1">
        rings: 25 / 50 / 75 / 100%
      </div>
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        {hovered !== null && axes[hovered].tooltip && tooltipStyle && (
          <div
            className="absolute z-30 bg-plot-ink dark:bg-stone-100 text-stone-100 dark:text-plot-ink rounded-md shadow-lg p-3 pointer-events-none"
            style={tooltipStyle}
          >
            <div className="font-mono uppercase tracking-[0.2em] text-[10px] mb-1.5 opacity-70">
              {axes[hovered].label.toLowerCase()}
            </div>
            <div className="font-mono uppercase tracking-[0.15em] text-[10px] mb-1 opacity-60">
              {axes[hovered].detail}
            </div>
            <div className="text-[12px] leading-relaxed">
              {axes[hovered].tooltip}
            </div>
          </div>
        )}
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="text-plot-ink dark:text-stone-100"
        >
          {/* Concentric grid */}
          {RING_FRACTIONS.map((rf) => (
            <polygon
              key={rf}
              points={ringPoints(rf)}
              fill="none"
              stroke="currentColor"
              strokeOpacity={rf === 1 ? 0.25 : 0.12}
              strokeWidth={1}
            />
          ))}

          {/* Axis spokes */}
          {axes.map((_, i) => {
            const [x, y] = pointAt(angle(i), RADIUS)
            return (
              <line
                key={i}
                x1={CX}
                y1={CY}
                x2={x}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.15}
                strokeWidth={1}
              />
            )
          })}

          {/* Data polygon (filled) */}
          <polygon
            points={dataPoints}
            fill="currentColor"
            fillOpacity={0.18}
            stroke="currentColor"
            strokeWidth={1.5}
          />

          {/* Vertex dots — also acting as hit targets for hover */}
          {axes.map((a, i) => {
            const r = (RADIUS * Math.max(0, Math.min(100, a.value))) / 100
            const [x, y] = pointAt(angle(i), r)
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={hovered === i ? 5 : 3}
                fill="currentColor"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() =>
                  setHovered((cur) => (cur === i ? null : cur))
                }
                style={{ cursor: 'pointer' }}
              />
            )
          })}

          {/* Axis labels — also hit targets */}
          {axes.map((a, i) => {
            const labelR = RADIUS + 22
            const [lx, ly] = pointAt(angle(i), labelR)
            return (
              <text
                key={i}
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                className="font-mono"
                style={{ letterSpacing: '0.15em', cursor: 'pointer' }}
                fontSize={9}
                fontWeight={hovered === i ? 700 : 500}
                fill="currentColor"
                fillOpacity={hovered === i ? 1 : 0.75}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() =>
                  setHovered((cur) => (cur === i ? null : cur))
                }
              >
                {a.label.toUpperCase()}
              </text>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
