import { useRef, useState } from 'react'
import { useStore } from '../lib/store'
import type { ProjectColor } from '../lib/types'
import { PALETTE, colorBg } from '../lib/palette'

export default function CreateProject({
  onCancel,
  onCreated,
}: {
  onCancel: () => void
  onCreated?: () => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<ProjectColor>('terracotta')
  const addProject = useStore((s) => s.addProject)
  const colorInputRef = useRef<HTMLInputElement>(null)

  const canSubmit = name.trim().length > 0
  const submit = () => {
    if (!canSubmit) return
    addProject(name, color)
    onCreated?.()
  }

  return (
    <main
      className="min-h-screen px-12 py-12 text-plot-ink transition-colors duration-500"
      style={{ background: colorBg(color) }}
    >
      <div className="max-w-2xl mx-auto pt-20">
        <p className="font-mono uppercase tracking-[0.25em] text-xs text-plot-ink/70 mb-4">
          new plot
        </p>
        <input
          autoFocus
          type="text"
          placeholder="name your plot…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            else if (e.key === 'Escape') onCancel()
          }}
          className="font-display font-bold text-[6rem] leading-none tracking-tight uppercase w-full bg-transparent outline-none placeholder:text-plot-ink/30 border-b-2 border-plot-ink/30 focus:border-plot-ink pb-3"
        />

        <div className="mt-14">
          <p className="font-mono uppercase tracking-[0.25em] text-xs text-plot-ink/70 mb-4">
            color
          </p>
          <div className="flex flex-wrap gap-3 items-center">
            {PALETTE.map((p) => (
              <button
                key={p.key}
                onClick={() => setColor(p.key)}
                aria-label={p.label}
                title={p.label}
                className={`w-12 h-12 rounded-full border-2 transition-transform ${
                  color === p.key
                    ? 'border-plot-ink scale-110'
                    : 'border-plot-ink/20 hover:scale-105'
                }`}
                style={{ background: `var(--color-plot-${p.key})` }}
              />
            ))}
            <button
              onClick={() => colorInputRef.current?.click()}
              aria-label="Pick a custom color"
              title="Pick a custom color"
              className={`w-12 h-12 rounded-full border-2 border-dashed transition-transform ${
                color.startsWith('#')
                  ? 'border-plot-ink scale-110'
                  : 'border-plot-ink/40 hover:scale-105'
              }`}
              style={
                color.startsWith('#') ? { background: color } : undefined
              }
            />
            <input
              ref={colorInputRef}
              type="color"
              value={color.startsWith('#') ? color : '#888888'}
              onChange={(e) => setColor(e.target.value.toLowerCase())}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
            />
          </div>
        </div>

        <div className="mt-14 flex items-center gap-6">
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="font-mono uppercase tracking-[0.2em] text-sm bg-plot-ink text-stone-100 px-8 py-4 rounded-full disabled:opacity-30 hover:bg-black transition-colors"
          >
            create plot
          </button>
          <button
            onClick={onCancel}
            className="font-mono uppercase tracking-[0.2em] text-xs text-plot-ink/60 hover:text-plot-ink"
          >
            cancel
          </button>
        </div>
      </div>
    </main>
  )
}
