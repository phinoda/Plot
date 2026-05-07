import type { Project } from '../lib/types'
import type { ProjectCounts } from '../lib/counts'
import { colorBg } from '../lib/palette'

/**
 * Edge-to-edge fill of a single resizable panel on the landing page.
 * No rounded corners, no padding margin — designed to butt up against its
 * sibling panes with only the resize handle line between them.
 */
export default function ProjectPane({
  project,
  counts,
  dayLabel = 'today',
}: {
  project: Project
  counts: ProjectCounts
  /** Heading for the daily-progress block. Defaults to "today"; pass a
   *  formatted date label when rendering a historical snapshot. */
  dayLabel?: string
}) {
  return (
    <div
      className="w-full h-full p-10 flex flex-col text-plot-ink overflow-hidden"
      style={{ background: colorBg(project.color) }}
    >
      <h2 className="font-display font-bold text-5xl uppercase tracking-tight leading-none break-words">
        {project.name}
      </h2>

      <div className="mt-auto space-y-5">
        <div>
          <div className="font-mono uppercase tracking-[0.25em] text-[10px] text-plot-ink/60">
            {dayLabel}
          </div>
          <div className="font-mono mt-1 flex items-baseline gap-3">
            <span className="text-3xl">
              {counts.deliveredToday}
              <span className="text-plot-ink/40"> / {counts.totalToday}</span>
            </span>
            {counts.completionPct !== null && (
              <span className="text-base text-plot-ink/70">
                {counts.completionPct}%
              </span>
            )}
          </div>
        </div>

        <div className="font-mono grid grid-cols-3 gap-3">
          <div>
            <div className="uppercase tracking-[0.2em] text-[10px] text-plot-ink/60">
              backlog
            </div>
            <div className="text-lg mt-0.5">{counts.backlogToday}</div>
          </div>
          <div>
            <div className="uppercase tracking-[0.2em] text-[10px] text-plot-ink/60">
              decisions
            </div>
            <div className="text-lg mt-0.5">{counts.decisionToday}</div>
          </div>
          <div>
            <div className="uppercase tracking-[0.2em] text-[10px] text-plot-ink/60">
              learnings
            </div>
            <div className="text-lg mt-0.5">{counts.learningToday}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
