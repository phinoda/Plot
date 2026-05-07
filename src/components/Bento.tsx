import { Fragment, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useStore } from '../lib/store'
import type { BentoTree as Tree } from '../lib/types'
import Splitter from './Splitter'

export type { BentoTree as Tree } from '../lib/types'

/**
 * Bento layout primitives.
 *
 * The landing surface is a tree of flex containers (`split` nodes) with
 * project tiles at the leaves. Every level sums its children's `sizes` to
 * 100% — children render with `flex: <size>` so the parent stays exactly
 * filled, always. Splitters between siblings let the user redistribute space
 * between two neighbors without ever opening a gap.
 */

const leaf = (projectIdx: number): Tree => ({ kind: 'leaf', projectIdx })
const split = (
  dir: 'h' | 'v',
  sizes: number[],
  children: Tree[],
): Tree => ({ kind: 'split', dir, sizes, children })

const T3 = [33.34, 33.33, 33.33]
const T4 = [25, 25, 25, 25]
const HALF = [50, 50]

const TEMPLATES: Record<number, Tree> = {
  2: split('h', HALF, [leaf(0), leaf(1)]),
  3: split('v', HALF, [
    split('h', HALF, [leaf(0), leaf(1)]),
    leaf(2),
  ]),
  4: split('v', HALF, [
    split('h', HALF, [leaf(0), leaf(1)]),
    split('h', HALF, [leaf(2), leaf(3)]),
  ]),
  5: split('h', [40, 60], [
    leaf(0),
    split('v', HALF, [
      split('h', HALF, [leaf(1), leaf(2)]),
      split('h', HALF, [leaf(3), leaf(4)]),
    ]),
  ]),
  6: split('v', HALF, [
    split('h', T3, [leaf(0), leaf(1), leaf(2)]),
    split('h', T3, [leaf(3), leaf(4), leaf(5)]),
  ]),
  7: split('v', HALF, [
    split('h', T3, [leaf(0), leaf(1), leaf(2)]),
    split('h', T4, [leaf(3), leaf(4), leaf(5), leaf(6)]),
  ]),
  8: split('v', HALF, [
    split('h', T4, [leaf(0), leaf(1), leaf(2), leaf(3)]),
    split('h', T4, [leaf(4), leaf(5), leaf(6), leaf(7)]),
  ]),
  9: split('v', T3, [
    split('h', T3, [leaf(0), leaf(1), leaf(2)]),
    split('h', T3, [leaf(3), leaf(4), leaf(5)]),
    split('h', T3, [leaf(6), leaf(7), leaf(8)]),
  ]),
  10: split('v', T3, [
    split('h', T4, [leaf(0), leaf(1), leaf(2), leaf(3)]),
    split('h', T4, [leaf(4), leaf(5), leaf(6), leaf(7)]),
    split('h', HALF, [leaf(8), leaf(9)]),
  ]),
  11: split('v', T3, [
    split('h', T4, [leaf(0), leaf(1), leaf(2), leaf(3)]),
    split('h', T4, [leaf(4), leaf(5), leaf(6), leaf(7)]),
    split('h', T3, [leaf(8), leaf(9), leaf(10)]),
  ]),
  12: split('v', T3, [
    split('h', T4, [leaf(0), leaf(1), leaf(2), leaf(3)]),
    split('h', T4, [leaf(4), leaf(5), leaf(6), leaf(7)]),
    split('h', T4, [leaf(8), leaf(9), leaf(10), leaf(11)]),
  ]),
}

function fallbackTree(n: number): Tree {
  // 4 cols × ceil(n/4) rows, last row stretches its items to fill width.
  const cols = 4
  const rows = Math.ceil(n / cols)
  const rowSizes = Array(rows).fill(100 / rows)
  const rowChildren: Tree[] = []
  for (let r = 0; r < rows; r++) {
    const start = r * cols
    const end = Math.min(start + cols, n)
    const inRow = end - start
    const leaves: Tree[] = []
    for (let i = start; i < end; i++) leaves.push(leaf(i))
    rowChildren.push(split('h', Array(inRow).fill(100 / inRow), leaves))
  }
  return split('v', rowSizes, rowChildren)
}

export function buildTree(n: number): Tree {
  return TEMPLATES[n] ?? fallbackTree(n)
}

function updateAtPath(
  node: Tree,
  path: number[],
  updater: (n: Tree) => Tree,
): Tree {
  if (path.length === 0) return updater(node)
  if (node.kind === 'leaf') return node
  const [head, ...rest] = path
  return {
    ...node,
    children: node.children.map((c, i) =>
      i === head ? updateAtPath(c, rest, updater) : c,
    ),
  }
}

function leafCount(node: Tree): number {
  if (node.kind === 'leaf') return 1
  return node.children.reduce((acc, c) => acc + leafCount(c), 0)
}

const MIN_PERCENT = 5

export default function Bento({
  projectCount,
  renderLeaf,
  ephemeral = false,
}: {
  projectCount: number
  renderLeaf: (projectIdx: number) => ReactNode
  /** When true (e.g. past-day historical view), use a freshly-built tree
   *  per render and never write to the persisted layout in store. Splitters
   *  are also hidden — historical layouts are read-only snapshots. */
  ephemeral?: boolean
}) {
  const storeTree = useStore((s) => s.bentoTree)
  const setTreeInStore = useStore((s) => s.setBentoTree)

  const ephemeralTree = useMemo(
    () => (ephemeral ? buildTree(projectCount) : null),
    [ephemeral, projectCount],
  )

  const tree = ephemeral ? ephemeralTree : storeTree

  // Initialize / rebuild when the project count changes (e.g., add or delete).
  // Reorder keeps the same leaf count so the existing tree stays valid.
  useEffect(() => {
    if (ephemeral) return
    if (!storeTree || leafCount(storeTree) !== projectCount) {
      setTreeInStore(buildTree(projectCount))
    }
  }, [ephemeral, storeTree, projectCount, setTreeInStore])

  if (!tree || leafCount(tree) !== projectCount) return null

  const resize = (
    splitPath: number[],
    childIdx: number,
    deltaPx: number,
    containerPx: number,
  ) => {
    // Read latest from store to avoid stale closure during a long mousemove.
    const current = useStore.getState().bentoTree
    if (!current) return
    const next = updateAtPath(current, splitPath, (node) => {
      if (node.kind !== 'split') return node
      const sizes = [...node.sizes]
      const total = sizes[childIdx] + sizes[childIdx + 1]
      const deltaPercent = (deltaPx / containerPx) * 100
      let a = sizes[childIdx] + deltaPercent
      let b = sizes[childIdx + 1] - deltaPercent
      if (a < MIN_PERCENT) {
        a = MIN_PERCENT
        b = total - MIN_PERCENT
      }
      if (b < MIN_PERCENT) {
        b = MIN_PERCENT
        a = total - MIN_PERCENT
      }
      sizes[childIdx] = a
      sizes[childIdx + 1] = b
      return { ...node, sizes }
    })
    setTreeInStore(next)
  }

  const renderNode = (node: Tree, path: number[]): ReactNode => {
    if (node.kind === 'leaf') {
      return (
        <div className="w-full h-full overflow-hidden">
          {renderLeaf(node.projectIdx)}
        </div>
      )
    }
    const isRow = node.dir === 'h'
    return (
      <div
        className={`flex w-full h-full ${isRow ? 'flex-row' : 'flex-col'}`}
      >
        {node.children.map((child, i) => (
          <Fragment key={i}>
            <div
              className="overflow-hidden min-w-0 min-h-0"
              style={{ flex: `${node.sizes[i]} ${node.sizes[i]} 0%` }}
            >
              {renderNode(child, [...path, i])}
            </div>
            {i < node.children.length - 1 && (
              <Splitter
                direction={node.dir}
                readOnly={ephemeral}
                onResize={(deltaPx, containerPx) =>
                  resize(path, i, deltaPx, containerPx)
                }
              />
            )}
          </Fragment>
        ))}
      </div>
    )
  }

  return <>{renderNode(tree, [])}</>
}
