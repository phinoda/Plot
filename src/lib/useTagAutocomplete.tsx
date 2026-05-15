import { useMemo, useRef, useState } from 'react'
import type {
  ChangeEvent,
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  RefObject,
} from 'react'
import { TAG_CHAR_REGEX, useAllTags } from './tags'

type TagState = {
  /** Position right after the leading `#` in the current text. */
  anchorIdx: number
  /** Whatever's been typed since the `#`. */
  query: string
}

type TaggableElement = HTMLTextAreaElement | HTMLInputElement

export type TagAutocompleteResult<T extends TaggableElement> = {
  handleChange: (e: ChangeEvent<T>) => void
  handleKeyDown: (e: KeyboardEvent<T>) => void
  handleKeyUp: (e: KeyboardEvent<T>) => void
  handleClick: (e: MouseEvent<T>) => void
  handleBlur: (e: FocusEvent<T>) => void
  /** True if `handleKeyDown` just consumed the most recent key —
   *  caller's own onKeyDown should bail. */
  intercepted: () => boolean
  popover: ReactNode
}

/**
 * Wires up `#tag` autocomplete on a `<textarea>` or `<input>`. Returns:
 *  - A set of event handlers to spread onto the element. Each composes
 *    safely with the caller's own handlers (which can still run when
 *    autocomplete isn't active).
 *  - A `popover` ReactNode to render below the element (the suggestion
 *    list). Comes back null when there's nothing to show.
 *  - A boolean indicating whether autocomplete intercepted the most
 *    recent keystroke — used by callers to short-circuit their own
 *    Enter/Esc handling so we don't double-act on it.
 *
 * The element is expected to live inside a `relative`-positioned wrapper
 * so the popover (`absolute top-full`) anchors below it.
 */
export function useTagAutocomplete<T extends TaggableElement>({
  ref,
  value,
  onValueChange,
}: {
  ref: RefObject<T | null>
  value: string
  onValueChange: (next: string) => void
}): TagAutocompleteResult<T> {
  const allTags = useAllTags()
  const [state, setState] = useState<TagState | null>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  // Tracks whether the latest keydown was consumed by the autocomplete
  // (Enter/Tab to accept, Esc to dismiss, arrow keys to navigate). The
  // caller can read this back via `intercepted` and bail their own
  // handler when true.
  const interceptedRef = useRef(false)

  const filtered = useMemo(() => {
    if (!state) return []
    const q = state.query.toLowerCase()
    return allTags.filter((t) => t.toLowerCase().startsWith(q)).slice(0, 8)
  }, [allTags, state])

  /**
   * Walk back from the caret looking for a `#` that starts a tag context.
   * Bail out (no tag mode) if we hit whitespace first, if the `#` is
   * immediately preceded by a tag char (`a#b` is one token, not two), or
   * if there's no `#` between cursor and start of text.
   */
  const detect = (text: string, caret: number) => {
    let i = caret - 1
    while (i >= 0) {
      const ch = text[i]
      if (ch === '#') break
      if (/\s/.test(ch)) {
        setState(null)
        return
      }
      i--
    }
    if (i < 0) {
      setState(null)
      return
    }
    if (i > 0 && TAG_CHAR_REGEX.test(text[i - 1])) {
      setState(null)
      return
    }
    const query = text.substring(i + 1, caret)
    setState({ anchorIdx: i + 1, query })
    setSelectedIdx(0)
  }

  const handleChange = (e: ChangeEvent<T>) => {
    const next = e.target.value
    onValueChange(next)
    detect(next, e.target.selectionStart ?? next.length)
  }

  // Re-evaluate when the user moves the caret without changing text
  // (arrow keys, click). selectionStart is read fresh from the element.
  const handleKeyUp = (e: KeyboardEvent<T>) => {
    const el = e.currentTarget
    detect(el.value, el.selectionStart ?? el.value.length)
  }

  const handleClick = (e: MouseEvent<T>) => {
    const el = e.currentTarget
    detect(el.value, el.selectionStart ?? el.value.length)
  }

  const handleBlur = (_e: FocusEvent<T>) => {
    // Defer hiding so a click on the popover (mousedown) gets to run
    // before the popover unmounts. Inserting a tag itself clears the
    // state synchronously; this is just the safety net.
    setTimeout(() => setState(null), 120)
  }

  const insertSelected = () => {
    if (!state || filtered.length === 0) return
    const tag = filtered[Math.min(selectedIdx, filtered.length - 1)]
    const before = value.substring(0, state.anchorIdx)
    const after = value.substring(state.anchorIdx + state.query.length)
    // Append a trailing space so the user can keep typing without
    // accidentally extending the tag. If the next char is already
    // whitespace, skip the auto-space to avoid double spaces.
    const trailing = after.length > 0 && /\s/.test(after[0]) ? '' : ' '
    const next = before + tag + trailing + after
    const caret = before.length + tag.length + trailing.length
    onValueChange(next)
    setState(null)
    setSelectedIdx(0)
    // Restore focus + caret after React commits the new value.
    setTimeout(() => {
      const el = ref.current
      if (!el) return
      el.focus()
      el.setSelectionRange(caret, caret)
    }, 0)
  }

  const handleKeyDown = (e: KeyboardEvent<T>) => {
    interceptedRef.current = false
    if (!state || filtered.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx((idx) => Math.min(idx + 1, filtered.length - 1))
      interceptedRef.current = true
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx((idx) => Math.max(idx - 1, 0))
      interceptedRef.current = true
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setState(null)
      setSelectedIdx(0)
      interceptedRef.current = true
      return
    }
    if ((e.key === 'Enter' || e.key === 'Tab') && !e.nativeEvent.isComposing) {
      e.preventDefault()
      insertSelected()
      interceptedRef.current = true
      return
    }
  }

  const popover: ReactNode =
    state && filtered.length > 0 ? (
      <ul
        className="absolute top-full left-0 mt-1 z-30 bg-stone-100 dark:bg-plot-ink border border-plot-ink/20 dark:border-stone-100/30 rounded-md shadow-lg min-w-[10rem] max-h-48 overflow-y-auto py-1"
        role="listbox"
      >
        {filtered.map((tag, i) => (
          <li
            key={tag}
            role="option"
            aria-selected={i === selectedIdx}
            onMouseDown={(e) => {
              // Prevent the textarea from blurring (which would tear down
              // the popover before our click can finish).
              e.preventDefault()
              setSelectedIdx(i)
              insertSelected()
            }}
            onMouseEnter={() => setSelectedIdx(i)}
            className={`px-3 py-1 cursor-pointer font-mono text-[12px] ${
              i === selectedIdx
                ? 'bg-plot-ink/10 text-plot-ink dark:bg-stone-100/15 dark:text-stone-100'
                : 'text-plot-ink/80 dark:text-stone-100/80'
            }`}
          >
            #{tag}
          </li>
        ))}
      </ul>
    ) : null

  return {
    handleChange,
    handleKeyDown,
    handleKeyUp,
    handleClick,
    handleBlur,
    /** True if `handleKeyDown` just consumed the most recent key —
     *  caller's own onKeyDown should bail. */
    intercepted: () => interceptedRef.current,
    popover,
  }
}
