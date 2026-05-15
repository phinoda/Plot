import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { PALETTE, colorBg } from '../lib/palette'
import { sameDay, todayKey } from '../lib/date'
import { activeDayKey, isTodayView, projectForDay } from '../lib/projects'
import type { Entry } from '../lib/types'
import Section from './Section'
import AddEntry from './AddEntry'
import HitArea from './HitArea'

export default function StatusView(_: { onCreate: () => void }) {
  const projects = useStore((s) => s.projects)
  const project = useStore((s) => {
    return projectForDay(
      s.projects,
      s.currentProjectId,
      activeDayKey(s.viewingDay),
    )
  })
  const entries = useStore((s) => {
    const project = projectForDay(
      s.projects,
      s.currentProjectId,
      activeDayKey(s.viewingDay),
    )
    return project ? (s.entriesByProject[project.id] ?? []) : []
  })
  const viewingDay = useStore((s) => s.viewingDay)
  const dragPreview = useStore((s) => s.dragPreview)
  const renameProject = useStore((s) => s.renameProject)
  const recolorProject = useStore((s) => s.recolorProject)
  const deleteProject = useStore((s) => s.deleteProject)
  const setCurrentProject = useStore((s) => s.setCurrentProject)

  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const colorInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (project) setDraftName(project.name)
  }, [project?.name])

  if (!project) return null

  const hasMany = projects.length > 1
  const activeDay = viewingDay ?? todayKey()
  const readOnly = !isTodayView(viewingDay)

  // Visible kind respects an in-flight drag preview so the dragged entry
  // appears in its target section without a real store write yet.
  const visibleKind = (e: Entry) =>
    dragPreview?.entryId === e.id ? dragPreview.previewKind : e.kind

  const backlog = entries.filter((e) => visibleKind(e) === 'backlog')
  const todo = entries.filter((e) => visibleKind(e) === 'todo')
  const delivered = entries.filter((e) => {
    // The previewed entry passes the date filter unconditionally — it'll
    // become "today" the moment the user releases.
    if (dragPreview?.entryId === e.id) {
      return dragPreview.previewKind === 'delivered'
    }
    return e.kind === 'delivered' && sameDay(e.movedAt, activeDay)
  })
  // Journal sections: filter by createdAt (entries don't move between kinds).
  const decision = entries.filter(
    (e) => e.kind === 'decision' && sameDay(e.createdAt, activeDay),
  )
  const learning = entries.filter(
    (e) => e.kind === 'learning' && sameDay(e.createdAt, activeDay),
  )

  const commitName = () => {
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== project.name) {
      renameProject(project.id, trimmed)
    } else {
      setDraftName(project.name)
    }
    setEditingName(false)
    inputRef.current?.blur()
  }

  const cancelEditName = () => {
    setDraftName(project.name)
    setEditingName(false)
    inputRef.current?.blur()
  }

  const beginEditName = () => {
    setEditingName(true)
    // Defer focus so readOnly is cleared before focusing. Place caret at end
    // (instead of selecting all) so typing appends.
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      const len = el.value.length
      el.setSelectionRange(len, len)
    })
  }

  const askDelete = () => {
    const ok = window.confirm(
      `Delete "${project.name}"? This wipes all of its entries and can't be undone.`,
    )
    if (ok) deleteProject(project.id)
  }

  return (
    <main
      className="h-screen overflow-hidden flex flex-col px-12 py-8 pb-20 text-plot-ink"
      style={{ background: colorBg(project.color) }}
    >
      {/* Top utility row: nav-back link (left) and destructive delete-project
          action (right) on the same horizontal line, separated by space. */}
      <div className="flex items-center mb-6 shrink-0">
        {hasMany && (
          <HitArea
            onClick={() => setCurrentProject(null)}
            className="font-mono uppercase tracking-[0.2em] text-[10px] text-plot-ink/75 hover:text-plot-ink transition-colors"
          >
            <span>← all plots</span>
          </HitArea>
        )}
        {!readOnly && (
          <HitArea
            onClick={askDelete}
            className="ml-auto font-mono uppercase tracking-[0.2em] text-[12px] text-plot-ink/75 hover:text-red-900 transition-colors"
          >
            <span>delete project</span>
          </HitArea>
        )}
      </div>

      <header className="mb-6 flex items-start justify-between gap-8 shrink-0">
        <div className="flex-1 min-w-0">
          <input
            ref={inputRef}
            type="text"
            value={editingName ? draftName : project.name}
            readOnly={readOnly || !editingName}
            onChange={(e) => setDraftName(e.target.value)}
            onClick={() => {
              if (!readOnly && !editingName) beginEditName()
            }}
            onKeyDown={(e) => {
              if (!editingName) return
              if (e.nativeEvent.isComposing) return
              if (e.key === 'Enter') commitName()
              else if (e.key === 'Escape') cancelEditName()
            }}
            onBlur={() => {
              if (editingName) commitName()
            }}
            title={editingName ? undefined : 'Click to rename'}
            className={`font-display font-bold text-[8rem] leading-none tracking-tight uppercase w-full bg-transparent outline-none border-b-2 pb-2 p-0 m-0 ${
              editingName
                ? 'border-plot-ink/30 focus:border-plot-ink cursor-text'
                : 'border-transparent cursor-text hover:opacity-90 transition-opacity'
            }`}
          />
        </div>

        {!readOnly && (
          <div className="shrink-0 flex flex-col items-end gap-3 pt-[30px]">
            {/* 6-col grid: keeps the swatch block shorter than the 8rem title
              on its left, so adding swatches never grows the header. */}
            <div className="grid grid-cols-6 gap-1.5 mt-2">
              {PALETTE.map((p) => (
                <HitArea
                  key={p.key}
                  onClick={() => recolorProject(project.id, p.key)}
                  aria-label={p.label}
                  title={p.label}
                >
                  <span
                    className={`block w-4 h-4 rounded-full border transition-transform ${
                      project.color === p.key
                        ? 'border-plot-ink scale-125'
                        : 'border-plot-ink/20 hover:scale-110'
                    }`}
                    style={{ background: `var(--color-plot-${p.key})` }}
                  />
                </HitArea>
              ))}
            </div>
            {/* Custom color: dashed circle opens the native picker. The hidden
              <input type="color"> is what actually shows the dialog when its
              .click() is triggered — sr-only keeps it focusable but invisible. */}
            <div className="mt-1.5">
              <HitArea
                onClick={() => colorInputRef.current?.click()}
                aria-label="Pick a custom color"
                title="Pick a custom color"
              >
                <span
                  className={`block w-4 h-4 rounded-full border border-dashed transition-transform ${
                    project.color.startsWith('#')
                      ? 'border-plot-ink scale-125'
                      : 'border-plot-ink/50 hover:scale-110'
                  }`}
                  style={
                    project.color.startsWith('#')
                      ? { background: project.color }
                      : undefined
                  }
                />
              </HitArea>
              <input
                ref={colorInputRef}
                type="color"
                value={
                  project.color.startsWith('#') ? project.color : '#888888'
                }
                onChange={(e) =>
                  recolorProject(project.id, e.target.value.toLowerCase())
                }
                className="sr-only"
                tabIndex={-1}
                aria-hidden
              />
            </div>
          </div>
        )}
      </header>

      <div className="grid grid-cols-5 gap-10 flex-1 min-h-0">
        <Section
          title="Backlog"
          kind="backlog"
          entries={backlog}
          readOnly={readOnly}
        >
          {!readOnly && <AddEntry kind="backlog" projectId={project.id} />}
        </Section>
        <Section
          title="To-do"
          kind="todo"
          entries={todo}
          readOnly={readOnly}
        >
          {!readOnly && <AddEntry kind="todo" projectId={project.id} />}
        </Section>
        <Section
          title="Delivered"
          kind="delivered"
          entries={delivered}
          readOnly={readOnly}
        >
          {!readOnly && <AddEntry kind="delivered" projectId={project.id} />}
        </Section>
        <Section
          title="Decision"
          kind="decision"
          entries={decision}
          readOnly={readOnly}
        >
          {!readOnly && <AddEntry kind="decision" projectId={project.id} />}
        </Section>
        <Section
          title="Learning"
          kind="learning"
          entries={learning}
          readOnly={readOnly}
        >
          {!readOnly && <AddEntry kind="learning" projectId={project.id} />}
        </Section>
      </div>
    </main>
  )
}
