import { useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { useTagAutocomplete } from '../lib/useTagAutocomplete'

type AddableKind = 'todo' | 'backlog' | 'delivered' | 'decision' | 'learning'

const PLACEHOLDER: Record<AddableKind, string> = {
  todo: 'Add a to-do…',
  backlog: 'Park an idea…',
  delivered: 'Log what you delivered…',
  decision: 'Log a decision…',
  learning: 'Log a learning…',
}

export default function AddEntry({
  kind,
  projectId,
}: {
  kind: AddableKind
  projectId?: string
}) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const tag = useTagAutocomplete({
    ref: inputRef,
    value: text,
    onValueChange: setText,
  })
  const addTodo = useStore((s) => s.addTodo)
  const addBacklog = useStore((s) => s.addBacklog)
  const addDelivered = useStore((s) => s.addDelivered)
  const addDecision = useStore((s) => s.addDecision)
  const addLearning = useStore((s) => s.addLearning)

  const submit = () => {
    if (!text.trim()) return
    if (kind === 'todo') addTodo(text, projectId)
    else if (kind === 'backlog') addBacklog(text, projectId)
    else if (kind === 'delivered') addDelivered(text, projectId)
    else if (kind === 'decision') addDecision(text, projectId)
    else addLearning(text, projectId)
    setText('')
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        className="w-full bg-transparent outline-none py-2 mb-4 font-sans text-[14px] placeholder:text-[14px] placeholder:text-plot-ink/50"
        placeholder={PLACEHOLDER[kind]}
        value={text}
        onChange={tag.handleChange}
        onKeyDown={(e) => {
          tag.handleKeyDown(e)
          if (tag.intercepted()) return
          // Don't fire submit while the IME is composing — Enter is the
          // candidate-commit key in Chinese/Japanese/Korean input.
          if (e.nativeEvent.isComposing) return
          if (e.key === 'Enter') submit()
        }}
        onKeyUp={tag.handleKeyUp}
        onClick={tag.handleClick}
        onBlur={tag.handleBlur}
      />
      {tag.popover}
    </div>
  )
}
