import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useStore } from '../lib/store'
import type { Entry, Project } from '../lib/types'
import { colorBg } from '../lib/palette'
import HitArea from './HitArea'

type Mode = 'idle' | 'editing' | 'commenting'

const KIND_LABEL: Record<string, string> = {
  todo: 'To-do',
  backlog: 'Backlog',
  delivered: 'Delivered',
  decision: 'Decision',
  learning: 'Learning',
}

function Pill({
  onClick,
  variant = 'ghost',
  children,
}: {
  onClick: (e: React.MouseEvent) => void
  variant?: 'ghost' | 'danger'
  children: ReactNode
}) {
  const base =
    'text-[10px] font-mono uppercase tracking-[0.15em] transition-colors whitespace-nowrap'
  const variants: Record<string, string> = {
    ghost:
      'text-plot-ink/60 hover:text-plot-ink dark:text-stone-100/60 dark:hover:text-stone-100',
    danger:
      'text-plot-ink/60 hover:text-red-900 dark:text-stone-100/60 dark:hover:text-red-300',
  }
  return (
    <HitArea onClick={onClick}>
      <span className={`${base} ${variants[variant]}`}>{children}</span>
    </HitArea>
  )
}

/** 2×3 dot pattern — universal drag-handle convention, kept small to match the
 *  page's compact typography. */
function DragHandle({
  onPointerDown,
}: {
  onPointerDown: (e: React.PointerEvent) => void
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
      aria-label="Drag to move section"
      className="cursor-grab active:cursor-grabbing p-[5px] -m-[5px] touch-none"
    >
      <div className="grid grid-cols-2 gap-[2px]">
        {Array.from({ length: 6 }, (_, i) => (
          <span
            key={i}
            className="block w-[2px] h-[2px] rounded-full bg-plot-ink/60 dark:bg-stone-100/60"
          />
        ))}
      </div>
    </div>
  )
}

/** Left-to-right section order; matches StatusView's grid columns. */
const SECTION_ORDER = ['backlog', 'todo', 'delivered'] as const
type DraggableKind = (typeof SECTION_ORDER)[number]

export default function EntryItem({
  entry,
  project,
}: {
  entry: Entry
  /** When provided (cross-project Status view), renders a small project-color
   *  swatch + project name above the entry's content so users can tell which
   *  project an entry belongs to. Single-project views omit this prop. */
  project?: Project
}) {
  const [mode, setMode] = useState<Mode>('idle')
  // titleDraft: primary text — entry.title for workflow kinds, entry.body for
  // journal kinds, and the comment text in commenting mode.
  // noteDraft: secondary text — deliverable / parkedReason in editing mode.
  const [titleDraft, setTitleDraft] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [autoFocusNote, setAutoFocusNote] = useState(false)

  // Tracks "we've already committed and are exiting"; suppresses the trailing
  // blur from re-firing save (Enter / Esc both flip mode synchronously, then
  // React unmounts the textarea which dispatches a blur on the wrapping <li>).
  const exitingRef = useRef(false)

  const editEntry = useStore((s) => s.editEntry)
  const deleteEntry = useStore((s) => s.deleteEntry)
  const pendingCommentEntryId = useStore((s) => s.pendingCommentEntryId)

  // After a drop into Backlog/Delivered, the store flags this entry id and
  // we auto-open the optional-comment prompt. Skip for To-do (no comment
  // field) and skip if the user is already mid-edit.
  useEffect(() => {
    if (
      pendingCommentEntryId !== entry.id ||
      mode !== 'idle' ||
      (entry.kind !== 'backlog' && entry.kind !== 'delivered')
    ) {
      return
    }
    setTitleDraft(
      entry.kind === 'backlog'
        ? (entry.parkedReason ?? '')
        : (entry.deliverable ?? ''),
    )
    setMode('commenting')
    useStore.getState().setPendingComment(null)
  }, [pendingCommentEntryId, entry.id, entry.kind, mode])

  const enterEdit = (focusNote = false) => {
    exitingRef.current = false
    if (entry.kind === 'decision' || entry.kind === 'learning') {
      setTitleDraft(entry.body ?? '')
    } else {
      setTitleDraft(entry.title ?? '')
    }
    if (entry.kind === 'delivered') {
      setNoteDraft(entry.deliverable ?? '')
    } else if (entry.kind === 'backlog') {
      setNoteDraft(entry.parkedReason ?? '')
    } else {
      setNoteDraft('')
    }
    setAutoFocusNote(focusNote)
    setMode('editing')
  }

  const saveAndExit = () => {
    if (exitingRef.current) return
    exitingRef.current = true
    const t = titleDraft.trim()
    const n = noteDraft.trim()
    if (entry.kind === 'todo') {
      if (t) editEntry(entry.id, { title: t })
    } else if (entry.kind === 'decision' || entry.kind === 'learning') {
      editEntry(entry.id, { body: t || undefined })
    } else if (entry.kind === 'delivered') {
      const patch: Partial<Entry> = { deliverable: n || undefined }
      if (t) patch.title = t
      editEntry(entry.id, patch)
    } else if (entry.kind === 'backlog') {
      const patch: Partial<Entry> = { parkedReason: n || undefined }
      if (t) patch.title = t
      editEntry(entry.id, patch)
    }
    setMode('idle')
  }

  const cancelEdit = () => {
    exitingRef.current = true
    setMode('idle')
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      saveAndExit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
    }
  }

  const handleCardBlur = (e: React.FocusEvent<HTMLLIElement>) => {
    if (exitingRef.current) return
    // Focus moving to another element inside the card (e.g. title → note)
    // doesn't count as leaving — stay in edit mode.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    saveAndExit()
  }

  const startDrag = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()

    /**
     * Horizontal motion past this threshold drags the preview one section
     * over. The preview lives in store as `dragPreview` — purely visual,
     * the entry's real kind only changes on mouseup. Reverse motion past
     * the threshold backs the preview up; if mouseup lands the preview
     * back at the original kind, nothing is committed.
     */
    const THRESHOLD = 8
    const originalKind = entry.kind
    if (!(SECTION_ORDER as readonly string[]).includes(originalKind)) return

    let anchorX = e.clientX
    let previewKind: DraggableKind = originalKind as DraggableKind
    let didMove = false

    const previousCursor = document.body.style.cursor
    const previousSelect = document.body.style.userSelect
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'

    // Use pointer events at the document level: they keep firing across
    // EntryItem unmount/remount (the entry visually jumps sections) and
    // are unaffected by pointerdown.preventDefault, which suppresses compat
    // mouse events on the element.
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - anchorX
      if (Math.abs(dx) < THRESHOLD) return

      const currentIdx = SECTION_ORDER.indexOf(previewKind)
      const nextIdx =
        dx > 0
          ? Math.min(currentIdx + 1, SECTION_ORDER.length - 1)
          : Math.max(currentIdx - 1, 0)
      if (nextIdx === currentIdx) {
        anchorX = ev.clientX
        return
      }
      previewKind = SECTION_ORDER[nextIdx]
      didMove = true
      anchorX = ev.clientX
      useStore.getState().setDragPreview({
        entryId: entry.id,
        previewKind,
      })
    }

    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousSelect
      const store = useStore.getState()
      store.setDragPreview(null)

      if (previewKind !== originalKind) {
        store.moveEntry(entry.id, previewKind)
        if (previewKind === 'backlog' || previewKind === 'delivered') {
          store.setPendingComment(entry.id)
        }
      }

      if (didMove) {
        const suppress = (clickEv: MouseEvent) => {
          clickEv.stopPropagation()
          clickEv.preventDefault()
          window.removeEventListener('click', suppress, true)
        }
        window.addEventListener('click', suppress, true)
      }
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
  }

  // Project-attribution row — only shown in the cross-project Status view, where
  // entries from multiple projects are flattened together. A small swatch in
  // the project's color plus the project name in mono small caps lets users
  // tell at a glance which project each entry belongs to.
  const projectTag = project ? (
    <div className="flex items-center gap-1.5 mb-1.5 font-mono uppercase tracking-[0.15em] text-[10px] text-plot-ink/60 dark:text-stone-100/60">
      <span
        className="block w-2 h-2 rounded-full"
        style={{ background: colorBg(project.color) }}
      />
      <span>{project.name}</span>
    </div>
  ) : null

  // ============== EDITING MODE ==============
  if (mode === 'editing') {
    const hasNote = entry.kind === 'delivered' || entry.kind === 'backlog'
    const titlePlaceholder =
      entry.kind === 'decision' || entry.kind === 'learning'
        ? 'Edit entry'
        : 'Edit title'
    const notePlaceholder =
      entry.kind === 'delivered' ? 'What did you deliver?' : 'Why park this?'
    const textareaBase =
      'w-full bg-transparent outline-none resize-none text-[14px] break-words [field-sizing:content]'

    return (
      <li
        className="border border-plot-ink p-3 bg-white/30 dark:border-stone-100 dark:bg-black/20"
        onBlur={handleCardBlur}
      >
        {projectTag}
        <textarea
          autoFocus={!autoFocusNote}
          rows={1}
          className={textareaBase}
          placeholder={titlePlaceholder}
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onKeyDown={handleEditKeyDown}
        />
        {hasNote && (
          <textarea
            autoFocus={autoFocusNote}
            rows={1}
            className={`mt-2 ${textareaBase} text-plot-ink/60 dark:text-stone-100/60${entry.kind === 'backlog' ? ' italic' : ''}`}
            placeholder={notePlaceholder}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onKeyDown={handleEditKeyDown}
          />
        )}
        <div className="mt-2 font-mono uppercase tracking-[0.2em] text-[10px] text-plot-ink/60 dark:text-stone-100/60">
          ↵ save · ⇧↵ newline · esc cancel
        </div>
      </li>
    )
  }

  // ============== COMMENTING MODE (drop-then-comment) ==============
  if (mode === 'commenting') {
    // Optional comment after a drop into Backlog or Delivered. Empty Enter
    // saves nothing extra (the kind change has already been committed).
    const submitComment = () => {
      const text = titleDraft.trim()
      if (entry.kind === 'backlog') {
        editEntry(entry.id, { parkedReason: text || undefined })
      } else if (entry.kind === 'delivered') {
        editEntry(entry.id, { deliverable: text || undefined })
      }
      setMode('idle')
      setTitleDraft('')
    }

    const cancelComment = () => {
      setMode('idle')
      setTitleDraft('')
    }

    const placeholder =
      entry.kind === 'backlog'
        ? 'Why park this? (optional)'
        : 'What did you deliver? (optional)'

    return (
      <li className="border border-plot-ink/20 dark:border-stone-100/20 px-3 py-2">
        {projectTag}
        <div className="text-[14px] break-words whitespace-pre-wrap">
          {entry.title}
        </div>
        <textarea
          autoFocus
          rows={1}
          className="mt-1.5 w-full bg-transparent outline-none border-b border-plot-ink/40 dark:border-stone-100/40 py-0.5 text-[14px] focus:border-plot-ink dark:focus:border-stone-100 resize-none [field-sizing:content]"
          placeholder={placeholder}
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submitComment()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              cancelComment()
            }
          }}
          onBlur={submitComment}
        />
        <div className="mt-1.5 font-mono uppercase tracking-[0.2em] text-[10px] text-plot-ink/60 dark:text-stone-100/60">
          ↵ save · ⇧↵ newline · esc skip
        </div>
      </li>
    )
  }

  // ============== IDLE MODE ==============
  // Click anywhere on the card body → enter edit mode. Children that should
  // not trigger edit (drag handle, Delete pill) stop propagation themselves.
  // Hover reveals Delete + drag handle simultaneously.
  const renderIdle = (
    body: ReactNode,
    {
      withDrag = true,
      label = KIND_LABEL[entry.kind],
    }: { withDrag?: boolean; label?: string } = {},
  ) => (
    <li
      onClick={() => enterEdit(false)}
      className="relative border border-plot-ink/20 dark:border-stone-100/20 px-3 py-2 group cursor-pointer"
    >
      {projectTag}
      {body}
      {/* Bottom row reserves space so card height doesn't shift on hover. */}
      <div className="mt-1.5 flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <Pill
          variant="danger"
          onClick={(e) => {
            e.stopPropagation()
            deleteEntry(entry.id)
          }}
        >
          Delete
        </Pill>
      </div>
      {withDrag && (
        <div
          className="absolute top-1/2 right-2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label={`Drag to move from ${label}`}
        >
          <DragHandle onPointerDown={startDrag} />
        </div>
      )}
    </li>
  )

  // Clicking the note region routes edit focus to the note textarea instead
  // of the default title focus.
  const noteClickHandler = (e: React.MouseEvent) => {
    e.stopPropagation()
    enterEdit(true)
  }

  if (entry.kind === 'todo') {
    return renderIdle(
      <div className="text-[14px] break-words whitespace-pre-wrap pr-6">
        {entry.title}
      </div>,
    )
  }

  if (entry.kind === 'delivered') {
    return renderIdle(
      <div className="pr-6">
        <div className="text-[14px] break-words whitespace-pre-wrap">
          {entry.title}
        </div>
        {entry.deliverable && (
          <div
            onClick={noteClickHandler}
            className="text-[14px] text-plot-ink/60 dark:text-stone-100/60 mt-1 break-words whitespace-pre-wrap"
          >
            {entry.deliverable}
          </div>
        )}
      </div>,
    )
  }

  if (entry.kind === 'backlog') {
    return renderIdle(
      <div className="pr-6">
        <div className="text-[14px] break-words whitespace-pre-wrap">
          {entry.title}
        </div>
        {entry.parkedReason && (
          <div
            onClick={noteClickHandler}
            className="text-[14px] text-plot-ink/60 dark:text-stone-100/60 mt-1 italic break-words whitespace-pre-wrap"
          >
            {entry.parkedReason}
          </div>
        )}
      </div>,
    )
  }

  if (entry.kind === 'decision' || entry.kind === 'learning') {
    return renderIdle(
      <div className="text-[14px] break-words whitespace-pre-wrap">
        {entry.body}
      </div>,
      { withDrag: false },
    )
  }

  return null
}
