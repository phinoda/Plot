import { lazy, Suspense } from 'react'
import { useStore } from '../lib/store'
import { computeCounts } from '../lib/counts'
import { formatDayLabel } from '../lib/date'
import { activeDayKey, isTodayView, projectsForDay } from '../lib/projects'
import ProjectPane from './ProjectPane'
import Bento from './Bento'

const PlotCityView = lazy(() => import('./PlotCityView'))

/**
 * Find the project ID nearest to `sourceId` in the given cardinal direction,
 * by tile-rect geometry. Used by the drag-reorder pointer handler to pick a
 * swap target without caring about the source's tree position.
 *
 * Distance metric is `(primary-axis distance) + (cross-axis distance)` so
 * that a tile slightly off-axis still wins over one far away on the right
 * line, and vice versa. Tiles in the wrong half-plane are skipped.
 */
function findNeighbor(
  sourceId: string,
  direction: 'l' | 'r' | 'u' | 'd',
): string | null {
  const sourceEl = document.querySelector(
    `[data-project-id="${sourceId}"]`,
  ) as HTMLElement | null
  if (!sourceEl) return null
  const sr = sourceEl.getBoundingClientRect()
  const sx = sr.left + sr.width / 2
  const sy = sr.top + sr.height / 2

  let bestId: string | null = null
  let bestDist = Infinity

  const tiles = document.querySelectorAll<HTMLElement>('[data-project-id]')
  tiles.forEach((tile) => {
    const id = tile.dataset.projectId
    if (!id || id === sourceId) return
    const r = tile.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2

    let qualifies = false
    let dist = 0
    if (direction === 'l' && cx < sx) {
      qualifies = true
      dist = sx - cx + Math.abs(cy - sy)
    } else if (direction === 'r' && cx > sx) {
      qualifies = true
      dist = cx - sx + Math.abs(cy - sy)
    } else if (direction === 'u' && cy < sy) {
      qualifies = true
      dist = sy - cy + Math.abs(cx - sx)
    } else if (direction === 'd' && cy > sy) {
      qualifies = true
      dist = cy - sy + Math.abs(cx - sx)
    }

    if (qualifies && dist < bestDist) {
      bestDist = dist
      bestId = id
    }
  })
  return bestId
}

/**
 * Bento landing surface for 2+ projects. Tiles always sum to 100% of the
 * viewport (see `Bento.tsx`); splitters between siblings let users redistribute
 * space. Each tile carries a hover-revealed grip in the top-right that drives
 * a custom pointer-based drag-reorder: as the cursor crosses into another
 * tile, the two swap live; backtracking restores the prior order.
 */
export default function ProjectsLanding(_: { onCreate: () => void }) {
  const projects = useStore((s) => s.projects)
  const entriesByProject = useStore((s) => s.entriesByProject)
  const setCurrentProject = useStore((s) => s.setCurrentProject)
  const viewingDay = useStore((s) => s.viewingDay)
  const plotsView = useStore((s) => s.plotsView)
  const activeDay = activeDayKey(viewingDay)
  const isOnToday = isTodayView(viewingDay)

  // On a past day, only show projects that already existed by then. The
  // tile layout is also frozen (Bento ephemeral mode) — historical landings
  // are read-only snapshots, no drag-resize / drag-reorder.
  const projectsToShow = projectsForDay(projects, activeDay)

  const dayLabel = isOnToday ? 'today' : formatDayLabel(activeDay)

  const startDragReorder = (e: React.PointerEvent, sourceId: string) => {
    e.stopPropagation()
    e.preventDefault()
    const gripEl = e.currentTarget as HTMLDivElement
    gripEl.setPointerCapture(e.pointerId)

    /**
     * Drag-reorder threshold in CSS pixels. Past this much motion (measured
     * from the original press point, not from a moving anchor) commits one
     * swap. Once swapped, the source stays at its new slot regardless of how
     * far the cursor keeps moving — long drags can no longer chain multiple
     * swaps. To swap further, release and start a fresh drag.
     */
    const THRESHOLD = 30
    const startX = e.clientX
    const startY = e.clientY
    /**
     * Axis lock. Null until first threshold crossing, then fixed to the
     * dominant axis at that moment. Cross-axis motion is ignored for the
     * rest of the drag — diagonal pulls never produce both an h-swap and a
     * v-swap. Re-pressing the grip resets the lock for the next drag.
     */
    let lockedAxis: 'horizontal' | 'vertical' | null = null
    /**
     * State of THIS drag relative to the original source position:
     *   null  → source is at its starting slot (no preview)
     *   <id>  → source has swapped out with this neighbor (preview committed)
     *
     * Transitions happen at threshold boundaries: cross outward → swap, fall
     * back inward → un-swap. This caps the drag at ±1 slot from the start
     * regardless of cursor distance, while still letting the user un-do or
     * change-direction within the same drag.
     */
    let swappedNeighborId: string | null = null
    /** Whether any swap fired during this drag — used to suppress the click
     *  that would otherwise open the tile beneath on release. */
    let didSwap = false

    const previousCursor = document.body.style.cursor
    const previousSelect = document.body.style.userSelect
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      const absX = Math.abs(dx)
      const absY = Math.abs(dy)

      if (lockedAxis === null) {
        // No axis chosen yet — wait for first threshold crossing, then
        // commit the dominant one as the lock for the rest of this drag.
        if (absX < THRESHOLD && absY < THRESHOLD) return
        lockedAxis = absX >= absY ? 'horizontal' : 'vertical'
      }

      const axisDelta = lockedAxis === 'horizontal' ? dx : dy
      const axisAbs = Math.abs(axisDelta)

      if (swappedNeighborId === null) {
        // Source is still at its starting slot. If we've crossed threshold
        // outward in the locked axis, fire one swap with that neighbor.
        if (axisAbs < THRESHOLD) return
        const direction: 'l' | 'r' | 'u' | 'd' =
          lockedAxis === 'horizontal'
            ? axisDelta > 0
              ? 'r'
              : 'l'
            : axisDelta > 0
              ? 'd'
              : 'u'
        const neighborId = findNeighbor(sourceId, direction)
        if (!neighborId) return
        useStore.getState().swapProjects(sourceId, neighborId)
        swappedNeighborId = neighborId
        didSwap = true
      } else {
        // Source has already swapped once; cap reached. Only undo if the
        // cursor falls back inside the starting threshold zone — at which
        // point we swap back (swap is commutative, so the same call
        // restores the original layout).
        if (axisAbs < THRESHOLD) {
          useStore.getState().swapProjects(sourceId, swappedNeighborId)
          swappedNeighborId = null
          // didSwap stays true: the user did move enough to need click
          // suppression on release, even though the net result is unchanged.
        }
      }
    }

    const onUp = () => {
      gripEl.releasePointerCapture(e.pointerId)
      gripEl.removeEventListener('pointermove', onMove)
      gripEl.removeEventListener('pointerup', onUp)
      gripEl.removeEventListener('pointercancel', onUp)
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousSelect
      // If we actually swapped, suppress the click that would otherwise fire
      // on the tile beneath and pull us into its detail view.
      if (didSwap) {
        const suppress = (clickEv: MouseEvent) => {
          clickEv.stopPropagation()
          clickEv.preventDefault()
          window.removeEventListener('click', suppress, true)
        }
        window.addEventListener('click', suppress, true)
      }
    }

    gripEl.addEventListener('pointermove', onMove)
    gripEl.addEventListener('pointerup', onUp)
    gripEl.addEventListener('pointercancel', onUp)
  }

  if (plotsView === 'city') {
    return (
      <main className="h-screen w-screen overflow-hidden text-plot-ink relative pb-12">
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center bg-[#eee8df] font-mono text-[10px] uppercase tracking-[0.2em] text-plot-ink/60">
              Loading city
            </div>
          }
        >
          <PlotCityView
            projects={projectsToShow}
            entriesByProject={entriesByProject}
            activeDay={activeDay}
            dayLabel={dayLabel}
            onSelectProject={setCurrentProject}
          />
        </Suspense>
      </main>
    )
  }

  return (
    <main className="h-screen w-screen overflow-hidden text-plot-ink relative pb-12">
      <Bento
        projectCount={projectsToShow.length}
        ephemeral={!isOnToday}
        renderLeaf={(idx) => {
          const project = projectsToShow[idx]
          if (!project) return null
          const counts = computeCounts(
            entriesByProject[project.id] ?? [],
            activeDay,
          )
          return (
            <div
              data-project-id={project.id}
              className="relative w-full h-full group cursor-pointer"
              onClick={() => setCurrentProject(project.id)}
            >
              <ProjectPane
                project={project}
                counts={counts}
                dayLabel={dayLabel}
              />
              {/* Drag-to-reorder grip: bare 3×3 dots, hover-revealed. Hidden
                  on historical (past-day) snapshots — those are read-only. */}
              {isOnToday && (
                <div
                  onPointerDown={(e) => startDragReorder(e, project.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Drag to reorder"
                  className="absolute top-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-[5px] -m-[5px] touch-none"
                >
                  <div className="grid grid-cols-3 gap-[3px]">
                    {Array.from({ length: 9 }, (_, i) => (
                      <span
                        key={i}
                        className="block w-[3px] h-[3px] rounded-full bg-plot-ink"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        }}
      />
    </main>
  )
}
