import type { ReactNode } from 'react'
import type { Entry, EntryKind, Project } from '../lib/types'
import EntryItem from './EntryItem'

export default function Section({
  title,
  kind,
  entries,
  children,
  projectsById,
  readOnly = false,
}: {
  title: string
  /** Drop-target identifier for cross-section drag-reorder. */
  kind: EntryKind
  entries: Entry[]
  children?: ReactNode
  /** When provided (cross-project Status view), each EntryItem renders a
   *  small project tag using `projectsById[entry.projectId]`. Single-project
   *  views omit this so EntryItem renders without project attribution. */
  projectsById?: Record<string, Project>
  readOnly?: boolean
}) {
  return (
    <section
      data-section-kind={kind}
      className="flex flex-col min-h-0"
    >
      <div className="shrink-0 mb-3">
        <h2 className="font-mono uppercase tracking-[0.25em] text-xs flex items-baseline gap-2">
          <span>{title}</span>
          <span className="text-plot-ink/50 dark:text-stone-100/50">
            {entries.length}
          </span>
        </h2>
        <div className="w-8 h-px bg-plot-ink dark:bg-stone-100 mt-2" />
      </div>
      {children && <div className="shrink-0">{children}</div>}
      <ul className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-2">
        {entries.map((e) => (
          <EntryItem
            key={e.id}
            entry={e}
            project={projectsById?.[e.projectId]}
            readOnly={readOnly}
          />
        ))}
      </ul>
    </section>
  )
}
