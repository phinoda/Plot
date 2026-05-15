import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useStore } from '../lib/store'
import type { Entry, Project } from '../lib/types'
import { colorBg } from '../lib/palette'
import { useTagAutocomplete } from '../lib/useTagAutocomplete'
import HitArea from './HitArea'
import MarkdownText from './MarkdownText'

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
  readOnly = false,
}: {
  entry: Entry
  /** When provided (cross-project Status view), renders a small project-color
   *  swatch + project name above the entry's content so users can tell which
   *  project an entry belongs to. Single-project views omit this prop. */
  project?: Project
  readOnly?: boolean
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

  // Tag-autocomplete is wired separately for the title-track textarea
  // (used in both editing and commenting modes — they're never rendered
  // simultaneously) and the optional note-track textarea (delivered /
  // backlog editing mode only).
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const titleAutocomplete = useTagAutocomplete({
    ref: titleRef,
    value: titleDraft,
    onValueChange: setTitleDraft,
  })
  const noteAutocomplete = useTagAutocomplete({
    ref: noteRef,
    value: noteDraft,
    onValueChange: setNoteDraft,
  })

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
    // While the IME is composing (Chinese / Japanese / Korean candidate
    // selection), Enter is the IME's commit key — never our save key.
    // Same for Escape which the IME uses to cancel composition.
    if (e.nativeEvent.isComposing) return
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
     * Two-axis drag. Past this threshold (measured from the original press
     * point) the gesture locks to its dominant axis for the rest of the
     * drag, then commits at most one preview-swap step in that axis. To
     * step further, release and start a new drag from the new position.
     *
     *   Horizontal lock → cross-section preview (Backlog ↔ To-do ↔
     *   Delivered). The preview lives in store as `dragPreview` — purely
     *   visual; the entry's real `kind` only changes on mouseup.
     *
     *   Vertical lock → in-section reorder. Multi-step: each THRESHOLD
     *   crossing along the axis swaps the entry one slot in that direction
     *   and resets the per-swap anchor, so a long drag can shuffle the
     *   entry through many positions in one continuous gesture. Reverse
     *   motion past threshold finds the new opposite same-kind neighbor
     *   and swaps back — naturally handling "I went too far" within the
     *   same drag. Skipped in the cross-project Status view (`project`
     *   prop set), where entries are sorted by `createdAt` and an array
     *   swap would be invisible.
     */
    const THRESHOLD = 30
    const originalKind = entry.kind
    if (!(SECTION_ORDER as readonly string[]).includes(originalKind)) return

    const startX = e.clientX
    const startY = e.clientY
    const originalIdx = SECTION_ORDER.indexOf(originalKind as DraggableKind)
    let lockedAxis: 'horizontal' | 'vertical' | null = null
    let previewKind: DraggableKind = originalKind as DraggableKind
    /** Per-swap anchor for vertical multi-step. Resets to the cursor's Y
     *  every time a vertical swap fires so the next THRESHOLD is measured
     *  fresh from the new position. (Horizontal axis stays cap-at-1 and
     *  uses `startY`-relative `dy` instead.) */
    let anchorY = e.clientY
    let didMove = false

    const previousCursor = document.body.style.cursor
    const previousSelect = document.body.style.userSelect
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'

    /** Find the next entry of the same kind in the same project, walking
     *  up or down the entries array (skipping other-kind entries). Returns
     *  null at the boundary of the section. */
    const findSameKindNeighbor = (
      direction: 'up' | 'down',
    ): string | null => {
      const list = useStore.getState().entriesByProject[entry.projectId] ?? []
      const idx = list.findIndex((e) => e.id === entry.id)
      if (idx === -1) return null
      if (direction === 'up') {
        for (let i = idx - 1; i >= 0; i--) {
          if (list[i].kind === entry.kind) return list[i].id
        }
      } else {
        for (let i = idx + 1; i < list.length; i++) {
          if (list[i].kind === entry.kind) return list[i].id
        }
      }
      return null
    }

    // Use pointer events at the document level: they keep firing across
    // EntryItem unmount/remount (the entry visually jumps sections) and
    // are unaffected by pointerdown.preventDefault, which suppresses compat
    // mouse events on the element.
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      const absX = Math.abs(dx)
      const absY = Math.abs(dy)

      if (lockedAxis === null) {
        if (absX < THRESHOLD && absY < THRESHOLD) return
        // In OverviewView (`project` prop set) entries are displayed sorted
        // by createdAt — vertical reorder of the underlying array would be
        // invisible. Force horizontal lock so a vertical drag in that view
        // is a visible no-op rather than a silent state mutation.
        if (project) {
          lockedAxis = 'horizontal'
        } else {
          lockedAxis = absX >= absY ? 'horizontal' : 'vertical'
        }
        // Any past-threshold motion suppresses the click that would
        // otherwise re-fire on release (which would open edit mode on the
        // tile beneath the cursor).
        didMove = true
      }

      if (lockedAxis === 'horizontal') {
        // Cross-section preview, capped at ±1 step from the original kind.
        let targetIdx: number
        if (absX < THRESHOLD) {
          targetIdx = originalIdx
        } else if (dx > 0) {
          targetIdx = Math.min(originalIdx + 1, SECTION_ORDER.length - 1)
        } else {
          targetIdx = Math.max(originalIdx - 1, 0)
        }

        const currentIdx = SECTION_ORDER.indexOf(previewKind)
        if (targetIdx === currentIdx) return

        previewKind = SECTION_ORDER[targetIdx]

        if (previewKind === originalKind) {
          useStore.getState().setDragPreview(null)
        } else {
          useStore.getState().setDragPreview({
            entryId: entry.id,
            previewKind,
          })
        }
      } else {
        // Vertical: in-section reorder, multi-step. Each cumulative
        // THRESHOLD of motion since the last swap (`anchorY`) commits one
        // swap with the same-kind neighbor in that direction; the anchor
        // then resets so the next swap requires another full THRESHOLD.
        // Reverse motion past THRESHOLD finds the now-opposite neighbor —
        // typically the entry we just came from — and swaps back, so the
        // user can undo within a single gesture by dragging back.
        const localDy = ev.clientY - anchorY
        if (Math.abs(localDy) < THRESHOLD) return
        const direction: 'up' | 'down' = localDy < 0 ? 'up' : 'down'
        const neighborId = findSameKindNeighbor(direction)
        if (!neighborId) {
          // Section boundary — nothing to swap with that way. Reset the
          // anchor anyway so cursor pixels accumulated against the wall
          // don't carry over and trigger an immediate swap when the user
          // reverses direction.
          anchorY = ev.clientY
          return
        }
        useStore.getState().swapEntries(entry.id, neighborId)
        anchorY = ev.clientY
      }
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
        <div className="relative">
          <textarea
            ref={titleRef}
            autoFocus={!autoFocusNote}
            rows={1}
            className={textareaBase}
            placeholder={titlePlaceholder}
            value={titleDraft}
            onChange={titleAutocomplete.handleChange}
            onKeyDown={(e) => {
              titleAutocomplete.handleKeyDown(e)
              if (titleAutocomplete.intercepted()) return
              handleEditKeyDown(e)
            }}
            onKeyUp={titleAutocomplete.handleKeyUp}
            onClick={titleAutocomplete.handleClick}
            onBlur={titleAutocomplete.handleBlur}
          />
          {titleAutocomplete.popover}
        </div>
        {hasNote && (
          <div className="relative">
            <textarea
              ref={noteRef}
              autoFocus={autoFocusNote}
              rows={1}
              className={`mt-2 ${textareaBase} text-plot-ink/60 dark:text-stone-100/60${entry.kind === 'backlog' ? ' italic' : ''}`}
              placeholder={notePlaceholder}
              value={noteDraft}
              onChange={noteAutocomplete.handleChange}
              onKeyDown={(e) => {
                noteAutocomplete.handleKeyDown(e)
                if (noteAutocomplete.intercepted()) return
                handleEditKeyDown(e)
              }}
              onKeyUp={noteAutocomplete.handleKeyUp}
              onClick={noteAutocomplete.handleClick}
              onBlur={noteAutocomplete.handleBlur}
            />
            {noteAutocomplete.popover}
          </div>
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
        <MarkdownText className="text-[14px] break-words">
          {entry.title}
        </MarkdownText>
        <div className="relative">
          <textarea
            ref={titleRef}
            autoFocus
            rows={1}
            className="mt-1.5 w-full bg-transparent outline-none border-b border-plot-ink/40 dark:border-stone-100/40 py-0.5 text-[14px] focus:border-plot-ink dark:focus:border-stone-100 resize-none [field-sizing:content]"
            placeholder={placeholder}
            value={titleDraft}
            onChange={titleAutocomplete.handleChange}
            onKeyDown={(e) => {
              titleAutocomplete.handleKeyDown(e)
              if (titleAutocomplete.intercepted()) return
              if (e.nativeEvent.isComposing) return
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submitComment()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                cancelComment()
              }
            }}
            onKeyUp={titleAutocomplete.handleKeyUp}
            onClick={titleAutocomplete.handleClick}
            onBlur={(e) => {
              titleAutocomplete.handleBlur(e)
              submitComment()
            }}
          />
          {titleAutocomplete.popover}
        </div>
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
      onClick={() => {
        if (!readOnly) enterEdit(false)
      }}
      className={`relative border border-plot-ink/20 dark:border-stone-100/20 px-3 py-2 group ${
        readOnly ? '' : 'cursor-pointer'
      }`}
    >
      {projectTag}
      {body}
      {!readOnly && (
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
      )}
      {!readOnly && withDrag && (
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
    if (readOnly) return
    e.stopPropagation()
    enterEdit(true)
  }

  if (entry.kind === 'todo') {
    return renderIdle(
      <MarkdownText className="text-[14px] break-words pr-6">
        {entry.title}
      </MarkdownText>,
    )
  }

  if (entry.kind === 'delivered') {
    return renderIdle(
      <div className="pr-6">
        <MarkdownText className="text-[14px] break-words">
          {entry.title}
        </MarkdownText>
        {entry.deliverable && (
          <div onClick={noteClickHandler}>
            <MarkdownText className="text-[14px] text-plot-ink/60 dark:text-stone-100/60 mt-1 break-words">
              {entry.deliverable}
            </MarkdownText>
          </div>
        )}
      </div>,
    )
  }

  if (entry.kind === 'backlog') {
    return renderIdle(
      <div className="pr-6">
        <MarkdownText className="text-[14px] break-words">
          {entry.title}
        </MarkdownText>
        {entry.parkedReason && (
          <div onClick={noteClickHandler}>
            <MarkdownText className="text-[14px] text-plot-ink/60 dark:text-stone-100/60 mt-1 italic break-words">
              {entry.parkedReason}
            </MarkdownText>
          </div>
        )}
      </div>,
    )
  }

  if (entry.kind === 'decision' || entry.kind === 'learning') {
    return renderIdle(
      <MarkdownText className="text-[14px] break-words">
        {entry.body ?? ''}
      </MarkdownText>,
      { withDrag: false },
    )
  }

  return null
}
