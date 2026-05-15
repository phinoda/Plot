import React from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import { TAG_FULL_MATCH_REGEX, TAG_GLOBAL_REGEX } from '../lib/tags'

/**
 * Leading `!` characters at the start of an entry act as a priority
 * marker — `!` = 1, `!!` = 2, `!!!` = 3. The marker is stripped from
 * the rendered text and replaced with a row of flag icons. Anything
 * after 3 `!`s (e.g. `!!!!`) doesn't match and falls through as plain
 * text. Optional whitespace between the marker and the actual content
 * is also consumed.
 */
const PRIORITY_REGEX = /^(!{1,3})\s*/

/** Solid flag icon. `currentColor` so it inherits text color from
 *  the wrapper (plot-ink on light, stone-100 on dark). */
function FlagIcon() {
  return (
    <svg
      width="12"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  )
}

/**
 * Renders markdown text inside an entry card. Supports the common
 * commonmark subset (bold/italic/lists/links/code/headings), inline
 * `#tag` highlighting, and a leading `!`-based priority marker. Block
 * elements get tightened margins so cards stay visually compact.
 *
 * Click handlers on the parent `<li>` (the click-to-edit affordance)
 * still take precedence — links inside the markdown render with link
 * styling but clicking opens the edit flow rather than navigating.
 */
export default function MarkdownText({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  const match = children.match(PRIORITY_REGEX)
  const priority = match ? match[1].length : 0
  const body = match ? children.slice(match[0].length) : children

  return (
    <div className={className}>
      {priority > 0 && (
        <div className="flex gap-0.5 mb-1 text-plot-ink dark:text-stone-100">
          {Array.from({ length: priority }).map((_, i) => (
            <FlagIcon key={i} />
          ))}
        </div>
      )}
      <ReactMarkdown
        components={MARKDOWN_COMPONENTS}
        remarkPlugins={REMARK_PLUGINS}
      >
        {body}
      </ReactMarkdown>
    </div>
  )
}

// Walk a node tree and replace bare-string children that contain `#tag`
// patterns with a mix of plain text and styled tag spans. Recurses into
// React elements so tags inside e.g. `<strong>` still get highlighted.
function withTagHighlights(node: React.ReactNode): React.ReactNode {
  if (typeof node === 'string') {
    if (!TAG_GLOBAL_REGEX.test(node)) return node
    // Reset the regex's lastIndex for `split` (not strictly required for
    // split, but be defensive across runs).
    const parts = node.split(TAG_GLOBAL_REGEX)
    const matches = node.match(TAG_GLOBAL_REGEX) ?? []
    const out: React.ReactNode[] = []
    parts.forEach((p, i) => {
      if (p) out.push(p)
      if (matches[i] && TAG_FULL_MATCH_REGEX.test(matches[i])) {
        out.push(
          <span
            key={`tag-${i}-${matches[i]}`}
            className="inline-block px-1 rounded bg-plot-ink/10 text-plot-ink dark:bg-stone-100/15 dark:text-stone-100 font-mono text-[12px]"
          >
            {matches[i]}
          </span>,
        )
      }
    })
    return out
  }
  if (Array.isArray(node)) {
    return node.map((c, i) => (
      <React.Fragment key={i}>{withTagHighlights(c)}</React.Fragment>
    ))
  }
  if (React.isValidElement(node)) {
    const el = node as React.ReactElement<{ children?: React.ReactNode }>
    return React.cloneElement(
      el,
      undefined,
      withTagHighlights(el.props.children),
    )
  }
  return node
}

// Treat single newlines as hard breaks (`<br>`) — matches the way users
// type entries with Shift+Enter and the prior `whitespace-pre-wrap`
// rendering. CommonMark default would collapse single newlines to spaces.
const REMARK_PLUGINS = [remarkBreaks]

// Markdown component overrides. Each one tightens default margins (cards
// are small) and runs its children through tag highlighting.
const MARKDOWN_COMPONENTS: Components = {
  p: ({ children, ...props }) => (
    <p {...props} className="mb-2 last:mb-0">
      {withTagHighlights(children)}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul {...props} className="list-disc pl-5 mb-2 last:mb-0">
      {withTagHighlights(children)}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol {...props} className="list-decimal pl-5 mb-2 last:mb-0">
      {withTagHighlights(children)}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li {...props}>{withTagHighlights(children)}</li>
  ),
  h1: ({ children, ...props }) => (
    <h1 {...props} className="text-[16px] font-bold mb-2 last:mb-0">
      {withTagHighlights(children)}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 {...props} className="text-[15px] font-bold mb-2 last:mb-0">
      {withTagHighlights(children)}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 {...props} className="text-[14px] font-bold mb-2 last:mb-0">
      {withTagHighlights(children)}
    </h3>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      {...props}
      className="border-l-2 border-plot-ink/30 dark:border-stone-100/30 pl-3 mb-2 last:mb-0"
    >
      {withTagHighlights(children)}
    </blockquote>
  ),
  code: ({ children, ...props }) => (
    <code
      {...props}
      className="font-mono text-[12px] bg-plot-ink/10 dark:bg-stone-100/15 px-1 rounded"
    >
      {children}
    </code>
  ),
  strong: ({ children, ...props }) => (
    <strong {...props}>{withTagHighlights(children)}</strong>
  ),
  em: ({ children, ...props }) => (
    <em {...props}>{withTagHighlights(children)}</em>
  ),
  a: ({ children, ...props }) => (
    <a {...props} className="underline">
      {withTagHighlights(children)}
    </a>
  ),
}
