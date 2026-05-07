import type { ReactNode, ButtonHTMLAttributes } from 'react'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  children: ReactNode
}

/**
 * A clickable parent with a 5px transparent padding ring so small targets are
 * easier to hit. The visual stays the same size — children render at their
 * natural size and the negative margin cancels the padding's layout impact —
 * but pointer events fire on the larger padded area.
 */
export default function HitArea({ children, className = '', ...rest }: Props) {
  return (
    <button
      {...rest}
      className={`p-[5px] -m-[5px] bg-transparent border-0 inline-flex items-center justify-center ${className}`}
    >
      {children}
    </button>
  )
}
