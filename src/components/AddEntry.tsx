import { useState } from 'react'
import { useStore } from '../lib/store'

type AddableKind = 'todo' | 'backlog' | 'decision' | 'learning'

const PLACEHOLDER: Record<AddableKind, string> = {
  todo: 'Add a to-do…',
  backlog: 'Park an idea…',
  decision: 'Log a decision…',
  learning: 'Log a learning…',
}

export default function AddEntry({ kind }: { kind: AddableKind }) {
  const [text, setText] = useState('')
  const addTodo = useStore((s) => s.addTodo)
  const addBacklog = useStore((s) => s.addBacklog)
  const addDecision = useStore((s) => s.addDecision)
  const addLearning = useStore((s) => s.addLearning)

  const submit = () => {
    if (!text.trim()) return
    if (kind === 'todo') addTodo(text)
    else if (kind === 'backlog') addBacklog(text)
    else if (kind === 'decision') addDecision(text)
    else addLearning(text)
    setText('')
  }

  return (
    <input
      type="text"
      className="w-full bg-transparent outline-none py-2 mb-4 font-sans text-[14px] placeholder:text-[14px] placeholder:text-plot-ink/50"
      placeholder={PLACEHOLDER[kind]}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') submit()
      }}
    />
  )
}
