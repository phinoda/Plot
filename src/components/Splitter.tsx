import { useRef } from 'react'

/**
 * 1.5px black line that lives between two flex siblings. Hover-reveal a pill
 * grip in the middle. Drag to redistribute flex space between the two
 * neighbors — they always sum to the same total, so there's never any gap.
 *
 * The Splitter is `direction='h'` when it sits inside a row container (so the
 * line is vertical between two horizontally-laid neighbors); `direction='v'`
 * when it sits inside a column container (horizontal line between vertically-
 * stacked neighbors).
 */
export default function Splitter({
  direction,
  onResize,
  readOnly = false,
}: {
  direction: 'h' | 'v'
  onResize: (deltaPx: number, containerPx: number) => void
  /** Render the divider as a non-interactive line (no drag, no grip, no
   *  resize cursor). Used for historical/snapshot views where the layout
   *  is frozen. */
  readOnly?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const lastPosRef = useRef<number>(0)
  const containerSizeRef = useRef<number>(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    if (readOnly) return
    e.preventDefault()
    const parent = ref.current?.parentElement
    if (!parent) return
    containerSizeRef.current =
      direction === 'h' ? parent.offsetWidth : parent.offsetHeight
    lastPosRef.current = direction === 'h' ? e.clientX : e.clientY

    const previousCursor = document.body.style.cursor
    const previousSelect = document.body.style.userSelect
    document.body.style.cursor = direction === 'h' ? 'ew-resize' : 'ns-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      const pos = direction === 'h' ? ev.clientX : ev.clientY
      const delta = pos - lastPosRef.current
      lastPosRef.current = pos
      if (delta !== 0) onResize(delta, containerSizeRef.current)
    }
    const onUp = () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousSelect
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const isH = direction === 'h'
  const cursorCls = readOnly
    ? ''
    : isH
      ? 'cursor-ew-resize'
      : 'cursor-ns-resize'
  return (
    <div
      ref={ref}
      onMouseDown={handleMouseDown}
      style={{
        flex: isH ? '0 0 2px' : '0 0 2px',
      }}
      className={`relative bg-plot-ink z-10 group ${
        isH ? 'w-0.5' : 'h-0.5'
      } ${cursorCls}`}
    >
      {!readOnly && (
        <>
          {/* Wider invisible hit area straddling the line — easier to grab. */}
          <div
            className={`absolute ${
              isH
                ? '-inset-x-2 inset-y-0 cursor-ew-resize'
                : '-inset-y-2 inset-x-0 cursor-ns-resize'
            }`}
          />
          {/* Pill grip, hover-revealed, sits in the middle of the splitter. */}
          <div
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-stone-100 border-2 border-plot-ink opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${
              isH ? 'w-2 h-12' : 'w-12 h-2'
            }`}
          />
        </>
      )}
    </div>
  )
}
