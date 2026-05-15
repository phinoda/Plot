import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { STATS_WINDOW_DAYS } from '../lib/stats'
import { todayKey } from '../lib/date'
import type { Entry, Project } from '../lib/types'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const PLOT_SIZE = 2.18
const BASE_HEIGHT = 0.08
const MIN_FLOOR_HEIGHT = 0.2
const HEIGHT_PER_ACTIVITY = 0.16
const MAX_BUILDING_HEIGHT = 6.4

type ActivityAction = 'created' | 'moved'

type CityActivity = {
  id: string
  kind: Entry['kind']
  action: ActivityAction
  preview: string
}

type FloorSlice = {
  dayKey: string
  count: number
  activities: CityActivity[]
  rawHeight: number
  height: number
  yBase: number
}

type CityPlot = {
  project: Project
  totalActivity: number
  activeDays: number
  longestStreak: number
  kindCounts: Record<Entry['kind'], number>
  floors: FloorSlice[]
  height: number
  x: number
  z: number
}

type HoverInfo = {
  plot: CityPlot
  floor: FloorSlice | null
  x: number
  y: number
}

type HoverTarget = {
  plot: CityPlot
  floor: FloorSlice | null
  mesh: THREE.Mesh | null
}

export default function PlotCityView({
  projects,
  entriesByProject,
  activeDay,
  dayLabel,
  onSelectProject,
}: {
  projects: Project[]
  entriesByProject: Record<string, Entry[]>
  activeDay: string
  dayLabel: string
  onSelectProject: (projectId: string) => void
}) {
  const containerRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hoverRef = useRef<CityPlot | null>(null)
  const [hover, setHover] = useState<HoverInfo | null>(null)
  const [webglFailed, setWebglFailed] = useState(false)
  const [fontsReady, setFontsReady] = useState(() => {
    if (typeof document === 'undefined' || !('fonts' in document)) return true
    return document.fonts.status === 'loaded'
  })

  const cityPlots = useMemo(
    () => buildCityPlots(projects, entriesByProject, activeDay),
    [activeDay, entriesByProject, projects],
  )

  const activePlots = cityPlots.filter((plot) => plot.totalActivity > 0).length
  const totalActivity = cityPlots.reduce(
    (sum, plot) => sum + plot.totalActivity,
    0,
  )
  const tallestPlot = cityPlots.reduce<CityPlot | null>(
    (best, plot) =>
      best === null || plot.totalActivity > best.totalActivity ? plot : best,
    null,
  )

  useEffect(() => {
    if (fontsReady || typeof document === 'undefined' || !('fonts' in document)) {
      return
    }
    let cancelled = false
    Promise.all([
      document.fonts.load('700 88px "Hubot Sans Variable"'),
      document.fonts.load('500 128px "Inconsolata Variable"'),
    ])
      .then(() => document.fonts.ready)
      .then(() => {
        if (!cancelled) setFontsReady(true)
      })
      .catch(() => {
        if (!cancelled) setFontsReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [fontsReady])

  useEffect(() => {
    if (!fontsReady) return
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || cityPlots.length === 0) return

    let frame = 0
    const scene = new THREE.Scene()
    const interactive: THREE.Object3D[] = []
    const plotById = new Map(cityPlots.map((plot) => [plot.project.id, plot]))
    const maxHeight = Math.max(BASE_HEIGHT, ...cityPlots.map((plot) => plot.height))

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
      })
    } catch (err) {
      console.warn('Plot city WebGL renderer failed:', err)
      setWebglFailed(true)
      return
    }

    setWebglFailed(false)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setClearColor(new THREE.Color('#eee8df'), 1)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const span = measureCitySpan(cityPlots)
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
    const cameraTarget = new THREE.Vector3(0, maxHeight * 0.34, 0)
    const cameraDirection = new THREE.Vector3(0.78, 0.58, 0.86).normalize()

    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = true
    controls.minDistance = 4
    controls.maxDistance = 40
    controls.minPolarAngle = 0.22
    controls.maxPolarAngle = 1.38
    controls.target.copy(cameraTarget)
    controls.update()

    scene.background = new THREE.Color('#eee8df')

    const city = new THREE.Group()
    city.rotation.y = -0.18
    scene.add(city)
    const projectGroups = buildScene(city, interactive, cityPlots, renderer)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let highlighted: {
      mesh: THREE.Mesh
      color: THREE.Color
    } | null = null

    const resize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      renderer.setSize(width, height, false)
      const aspect = width / Math.max(1, height)
      const neededWidth = span * 2.05
      const neededHeight = Math.max(span * 1.72, maxHeight + 5.8)
      const verticalFov = THREE.MathUtils.degToRad(camera.fov)
      const horizontalFov =
        2 * Math.atan(Math.tan(verticalFov / 2) * aspect)
      const distanceForHeight =
        (neededHeight / 2) / Math.tan(verticalFov / 2)
      const distanceForWidth =
        (neededWidth / 2) / Math.tan(horizontalFov / 2)
      const distance = Math.max(distanceForHeight, distanceForWidth) * 1.05
      camera.aspect = aspect
      camera.near = 0.1
      camera.far = distance + maxHeight + span * 4
      camera.position.copy(
        cameraTarget.clone().add(cameraDirection.clone().multiplyScalar(distance)),
      )
      camera.lookAt(cameraTarget)
      camera.updateProjectionMatrix()
      controls.minDistance = distance * 0.38
      controls.maxDistance = distance * 2.4
      controls.target.copy(cameraTarget)
      controls.update()
    }

    const restoreHighlight = () => {
      if (!highlighted) return
      const material = highlighted.mesh.material
      if (material instanceof THREE.MeshBasicMaterial) {
        material.color.copy(highlighted.color)
      }
      highlighted = null
    }

    const setHighlight = (mesh: THREE.Mesh | null) => {
      if (highlighted?.mesh === mesh) return
      restoreHighlight()
      if (!mesh || !(mesh.material instanceof THREE.MeshBasicMaterial)) return
      highlighted = {
        mesh,
        color: mesh.material.color.clone(),
      }
      mesh.material.color.set('#f8ecd2')
    }

    const findTarget = (object: THREE.Object3D): HoverTarget | null => {
      let current: THREE.Object3D | null = object
      let floorIndex =
        typeof object.userData.floorIndex === 'number'
          ? (object.userData.floorIndex as number)
          : null

      while (current) {
        if (floorIndex === null && typeof current.userData.floorIndex === 'number') {
          floorIndex = current.userData.floorIndex as number
        }
        const id = current.userData.plotId as string | undefined
        if (id) {
          const plot = plotById.get(id)
          if (!plot) return null
          const floor =
            floorIndex === null ? null : plot.floors[floorIndex] ?? null
          return {
            plot,
            floor,
            mesh: floor ? (object as THREE.Mesh) : null,
          }
        }
        current = current.parent
      }
      return null
    }

    let pointerStart: { x: number; y: number } | null = null
    let suppressClick = false

    const setHoverTarget = (target: HoverTarget | null, x = 0, y = 0) => {
      hoverRef.current = target?.plot ?? null
      canvas.style.cursor = target ? 'pointer' : 'grab'
      setHighlight(target?.floor ? target.mesh : null)
      setHover(
        target
          ? {
              plot: target.plot,
              floor: target.floor,
              x,
              y,
            }
          : null,
      )
    }

    const onPointerMove = (event: PointerEvent) => {
      if (pointerStart) {
        const dx = event.clientX - pointerStart.x
        const dy = event.clientY - pointerStart.y
        if (Math.hypot(dx, dy) > 5) suppressClick = true
      }
      const rect = canvas.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(interactive, false)[0]
      const target = hit ? findTarget(hit.object) : null
      setHoverTarget(target, event.clientX + 14, event.clientY + 14)
    }

    const onPointerDown = (event: PointerEvent) => {
      pointerStart = { x: event.clientX, y: event.clientY }
      suppressClick = false
    }
    const onPointerUp = () => {
      pointerStart = null
    }
    const onPointerLeave = () => setHoverTarget(null)
    const onClick = () => {
      if (suppressClick) return
      if (hoverRef.current) onSelectProject(hoverRef.current.project.id)
    }

    resize()
    window.addEventListener('resize', resize)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointerleave', onPointerLeave)
    canvas.addEventListener('click', onClick)

    const startedAt = performance.now()
    const animate = (now = performance.now()) => {
      frame = window.requestAnimationFrame(animate)
      const elapsed = now - startedAt
      projectGroups.forEach((group, index) => {
        const t = clamp((elapsed - index * 65) / 720, 0, 1)
        group.scale.y = Math.max(0.001, easeOutCubic(t))
      })
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas.removeEventListener('click', onClick)
      restoreHighlight()
      controls.dispose()
      disposeObject(scene)
      renderer.dispose()
      hoverRef.current = null
    }
  }, [cityPlots, fontsReady, onSelectProject])

  return (
    <section
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[#eee8df]"
      aria-label="3D Plots activity city"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between px-6 pt-5 sm:px-8">
        <div>
          <div className="font-display text-3xl font-black uppercase leading-none tracking-normal text-plot-ink sm:text-5xl">
            Plots
          </div>
          <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-plot-ink/60">
            City / {STATS_WINDOW_DAYS}d / {dayLabel}
          </div>
        </div>
        <div className="max-w-[46vw] text-right font-mono uppercase tracking-[0.18em] text-plot-ink/70">
          <div className="text-[10px]">Activity</div>
          <div className="mt-1 text-lg leading-none text-plot-ink sm:text-2xl">
            {totalActivity}
          </div>
          <div className="mt-2 hidden text-[10px] text-plot-ink/55 sm:block">
            {activePlots}/{cityPlots.length} active plots
          </div>
          {tallestPlot && (
            <div className="mt-2 hidden max-w-48 text-[10px] leading-snug text-plot-ink/55 md:block">
              Tallest: {tallestPlot.project.name}
            </div>
          )}
        </div>
      </div>

      {webglFailed ? (
        <PlotCityFallback plots={cityPlots} />
      ) : (
        <canvas
          ref={canvasRef}
          className="block h-full w-full cursor-grab touch-none active:cursor-grabbing"
        />
      )}

      {hover && !webglFailed && <PlotCityTooltip hover={hover} />}
    </section>
  )
}

function PlotCityTooltip({ hover }: { hover: HoverInfo }) {
  const { plot, floor } = hover
  return (
    <div
      data-plot-city-tooltip={floor ? 'floor' : 'plot'}
      className="pointer-events-none fixed z-[70] max-w-80 border border-plot-ink/20 bg-[#fffaf0]/95 px-3 py-2 font-mono text-plot-ink shadow-lg backdrop-blur"
      style={{ left: hover.x, top: hover.y }}
    >
      <div className="font-display text-base font-black uppercase leading-none tracking-normal">
        {plot.project.name}
      </div>
      {floor ? (
        <>
          <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-plot-ink/55">
            {formatShortDay(floor.dayKey)} / {floor.count} activity
            {floor.count === 1 ? '' : 's'}
          </div>
          <div className="mt-2 space-y-1.5 text-xs leading-snug">
            {floor.activities.slice(0, 6).map((activity, index) => (
              <div key={`${activity.id}-${activity.action}-${index}`}>
                <span className="uppercase tracking-[0.12em] text-plot-ink/45">
                  {activity.action} {activity.kind}
                </span>
                {activity.preview && (
                  <span className="text-plot-ink/80"> / {activity.preview}</span>
                )}
              </div>
            ))}
            {floor.activities.length > 6 && (
              <div className="uppercase tracking-[0.12em] text-plot-ink/45">
                +{floor.activities.length - 6} more
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-3 text-[10px] uppercase tracking-[0.16em] text-plot-ink/55">
          <div>
            <div>Streak</div>
            <div className="mt-1 text-lg leading-none text-plot-ink">
              {plot.longestStreak}
            </div>
          </div>
          <div>
            <div>Todo</div>
            <div className="mt-1 text-lg leading-none text-plot-ink">
              {plot.kindCounts.todo}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function buildCityPlots(
  projects: Project[],
  entriesByProject: Record<string, Entry[]>,
  activeDay: string,
): CityPlot[] {
  const windowDays = buildWindowDays(activeDay, STATS_WINDOW_DAYS)
  const firstDay = windowDays[0]
  const inWindowKey = (key: string) => key >= firstDay && key <= activeDay

  const raw = projects.map((project) => {
    const entries = entriesByProject[project.id] ?? []
    const dayActivities = new Map<string, CityActivity[]>()
    const kindCounts = countKinds(entries)

    const addActivity = (
      entry: Entry,
      action: ActivityAction,
      timestamp: number,
    ) => {
      const key = todayKey(timestamp)
      if (!inWindowKey(key)) return
      if (!dayActivities.has(key)) dayActivities.set(key, [])
      dayActivities.get(key)!.push({
        id: entry.id,
        kind: entry.kind,
        action,
        preview: activityPreview(entry),
      })
    }

    for (const entry of entries) {
      addActivity(entry, 'created', entry.createdAt)
      if (entry.movedAt !== entry.createdAt) {
        addActivity(entry, 'moved', entry.movedAt)
      }
    }

    const activeDayKeys = new Set(dayActivities.keys())
    return {
      project,
      dayActivities,
      activeDayKeys,
      totalActivity: Array.from(dayActivities.values()).reduce(
        (sum, activities) => sum + activities.length,
        0,
      ),
      activeDays: activeDayKeys.size,
      longestStreak: computeLongestStreak(windowDays, activeDayKeys),
      kindCounts,
    }
  })

  const rawPlots = raw.map((plot) => {
    let rawStackHeight = 0
    const floors = windowDays
      .map((dayKey) => {
        const activities = plot.dayActivities.get(dayKey) ?? []
        if (activities.length === 0) return null
        const rawHeight =
          MIN_FLOOR_HEIGHT + activities.length * HEIGHT_PER_ACTIVITY
        rawStackHeight += rawHeight
        return {
          dayKey,
          count: activities.length,
          activities,
          rawHeight,
          height: rawHeight,
          yBase: 0,
        }
      })
      .filter((floor): floor is FloorSlice => floor !== null)
    return { ...plot, floors, rawStackHeight }
  })

  const maxRawHeight = Math.max(
    1,
    ...rawPlots.map((plot) => BASE_HEIGHT + plot.rawStackHeight),
  )
  const heightScale = Math.min(1, MAX_BUILDING_HEIGHT / maxRawHeight)
  const cols = Math.ceil(Math.sqrt(Math.max(1, rawPlots.length)))
  const rows = Math.ceil(rawPlots.length / cols)
  const spacing = PLOT_SIZE

  return rawPlots.map((plot, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    let y = BASE_HEIGHT
    const floors = plot.floors.map((floor) => {
      const height = floor.rawHeight * heightScale
      const next = {
        ...floor,
        height,
        yBase: y,
      }
      y += height
      return next
    })
    return {
      project: plot.project,
      totalActivity: plot.totalActivity,
      activeDays: plot.activeDays,
      longestStreak: plot.longestStreak,
      kindCounts: plot.kindCounts,
      floors,
      height: y,
      x: (col - (cols - 1) / 2) * spacing,
      z: (row - (rows - 1) / 2) * spacing,
    }
  })
}

function buildWindowDays(endKey: string, count: number): string[] {
  const [y, m, d] = endKey.split('-').map(Number)
  const endDate = new Date(y, m - 1, d)
  const days: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    days.push(todayKey(endDate.getTime() - i * MS_PER_DAY))
  }
  return days
}

function computeLongestStreak(
  windowDays: string[],
  activeDayKeys: Set<string>,
): number {
  let longest = 0
  let current = 0
  for (const day of windowDays) {
    if (activeDayKeys.has(day)) {
      current++
      longest = Math.max(longest, current)
    } else {
      current = 0
    }
  }
  return longest
}

function countKinds(entries: Entry[]): Record<Entry['kind'], number> {
  return entries.reduce<Record<Entry['kind'], number>>(
    (counts, entry) => {
      counts[entry.kind] += 1
      return counts
    },
    {
      backlog: 0,
      todo: 0,
      delivered: 0,
      decision: 0,
      learning: 0,
    },
  )
}

function measureCitySpan(plots: CityPlot[]): number {
  let max = PLOT_SIZE
  for (const plot of plots) {
    max = Math.max(
      max,
      Math.abs(plot.x) + PLOT_SIZE / 2,
      Math.abs(plot.z) + PLOT_SIZE / 2,
    )
  }
  return max + 2.6
}

function buildScene(
  root: THREE.Group,
  interactive: THREE.Object3D[],
  plots: CityPlot[],
  renderer: THREE.WebGLRenderer,
): THREE.Group[] {
  const ink = new THREE.Color('#2a1f18')
  const groups: THREE.Group[] = []

  for (const plot of plots) {
    const group = new THREE.Group()
    group.position.set(plot.x, 0, plot.z)
    group.scale.y = 0.001
    group.userData.plotId = plot.project.id
    root.add(group)
    groups.push(group)

    const color = resolveProjectColor(plot.project.color)
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(PLOT_SIZE, BASE_HEIGHT, PLOT_SIZE),
      new THREE.MeshBasicMaterial({
        color,
      }),
    )
    base.position.y = BASE_HEIGHT / 2
    base.userData.plotId = plot.project.id
    group.add(base)
    interactive.push(base)
    addEdges(group, base, ink, 0.38)

    plot.floors.forEach((floor, index) => {
      const floorMesh = new THREE.Mesh(
        new THREE.BoxGeometry(PLOT_SIZE, floor.height, PLOT_SIZE),
        new THREE.MeshBasicMaterial({
          color,
        }),
      )
      floorMesh.position.y = floor.yBase + floor.height / 2
      floorMesh.userData.plotId = plot.project.id
      floorMesh.userData.floorIndex = index
      group.add(floorMesh)
      interactive.push(floorMesh)
      addEdges(group, floorMesh, ink, 0.56)
    })

    const label = createCoverMesh(renderer, plot, PLOT_SIZE * 0.94)
    label.position.set(0, plot.height + 0.006, 0)
    label.userData.plotId = plot.project.id
    group.add(label)
    interactive.push(label)
  }

  return groups
}

function addEdges(
  group: THREE.Group,
  mesh: THREE.Mesh,
  color: THREE.Color,
  opacity: number,
) {
  const edgeGeometry = new THREE.EdgesGeometry(mesh.geometry)
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
  })
  const edges = new THREE.LineSegments(edgeGeometry, material)
  edges.position.copy(mesh.position)
  group.add(edges)

  const edgeEcho = new THREE.LineSegments(edgeGeometry.clone(), material.clone())
  edgeEcho.position.set(
    mesh.position.x + 0.002,
    mesh.position.y + 0.002,
    mesh.position.z + 0.002,
  )
  group.add(edgeEcho)
}

function createCoverMesh(
  renderer: THREE.WebGLRenderer,
  plot: CityPlot,
  size: number,
): THREE.Mesh {
  const canvas = document.createElement('canvas')
  const scale = 2
  canvas.width = 768 * scale
  canvas.height = 768 * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return new THREE.Mesh(new THREE.PlaneGeometry(size, size))
  }

  ctx.scale(scale, scale)
  ctx.clearRect(0, 0, 768, 768)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  const ink = '#2a1f18'
  const muted = 'rgba(42, 31, 24, 0.44)'

  ctx.fillStyle = ink
  ctx.font = computedCanvasFont(
    'font-display font-bold text-5xl uppercase tracking-tight leading-none',
    88,
    '"Hubot Sans Variable", ui-sans-serif, system-ui, sans-serif',
  )
  drawWrappedText(ctx, plot.project.name.toUpperCase(), 58, 58, 652, 96, 2)

  ctx.font = '500 30px "Geist Mono Variable", ui-monospace'
  ctx.letterSpacing = '6px'
  ctx.fillStyle = muted
  ctx.fillText('LONGEST', 62, 320)
  ctx.fillText('STREAK', 62, 365)

  ctx.letterSpacing = '0px'
  ctx.font = '500 128px "Inconsolata Variable", ui-monospace'
  ctx.fillStyle = ink
  ctx.fillText(String(plot.longestStreak), 62, 462)
  ctx.font = '500 34px "Geist Mono Variable", ui-monospace'
  ctx.letterSpacing = '6px'
  ctx.fillStyle = muted
  ctx.fillText('DAYS', 190, 535)

  const rows: Array<[number, string]> = [
    [plot.kindCounts.backlog, 'BACKLOG'],
    [plot.kindCounts.todo, 'TODO'],
    [plot.kindCounts.delivered, 'DELIVERED'],
    [plot.kindCounts.decision, 'DECISION'],
    [plot.kindCounts.learning, 'LEARNING'],
  ]
  rows.forEach(([count, label], index) => {
    const y = 294 + index * 66
    ctx.letterSpacing = '0px'
    ctx.font = '500 44px "Inconsolata Variable", ui-monospace'
    ctx.fillStyle = ink
    const countText = String(count)
    ctx.fillText(countText, 368, y)
    const countWidth = ctx.measureText(countText).width
    ctx.font = '500 34px "Geist Mono Variable", ui-monospace'
    ctx.letterSpacing = '5px'
    ctx.fillStyle = muted
    ctx.fillText(label, 368 + countWidth + 22, y + 5)
  })
  ctx.letterSpacing = '0px'

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material)
  mesh.rotation.x = -Math.PI / 2
  return mesh
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = text.trim().split(/\s+/)
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate
      continue
    }
    if (line) lines.push(line)
    line = word
    if (lines.length === maxLines) break
  }
  if (line && lines.length < maxLines) lines.push(line)

  lines.slice(0, maxLines).forEach((item, index) => {
    let textToDraw = item
    if (index === maxLines - 1 && words.join(' ').length > lines.join(' ').length) {
      while (
        textToDraw.length > 3 &&
        ctx.measureText(`${textToDraw}...`).width > maxWidth
      ) {
        textToDraw = textToDraw.slice(0, -1)
      }
      textToDraw = `${textToDraw}...`
    }
    ctx.fillText(textToDraw, x, y + index * lineHeight)
  })
}

function computedCanvasFont(
  className: string,
  sizePx: number,
  fallbackFamily: string,
): string {
  if (typeof document === 'undefined') {
    return `700 ${sizePx}px ${fallbackFamily}`
  }

  const probe = document.createElement('span')
  probe.className = className
  probe.style.position = 'fixed'
  probe.style.left = '-9999px'
  probe.style.top = '-9999px'
  probe.style.fontSize = `${sizePx}px`
  probe.textContent = 'Plot'
  document.body.appendChild(probe)
  const style = getComputedStyle(probe)
  const weight = style.fontWeight || '700'
  const family = style.fontFamily || fallbackFamily
  document.body.removeChild(probe)
  return `${weight} ${sizePx}px ${family}`
}

function activityPreview(entry: Entry): string {
  return (
    entry.title?.trim() ||
    entry.body?.trim() ||
    entry.deliverable?.trim() ||
    entry.parkedReason?.trim() ||
    ''
  )
}

function formatShortDay(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3)
}

function resolveProjectColor(color: Project['color']): string {
  if (color.startsWith('#')) return color
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--color-plot-${color}`)
    .trim()
  return value || '#e3cca7'
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    const material = mesh.material
    if (Array.isArray(material)) {
      for (const item of material) disposeMaterial(item)
    } else if (material) {
      disposeMaterial(material)
    }
  })
}

function disposeMaterial(material: THREE.Material) {
  const mapped = material as THREE.Material & { map?: THREE.Texture }
  if (mapped.map) mapped.map.dispose()
  material.dispose()
}

function PlotCityFallback({ plots }: { plots: CityPlot[] }) {
  const max = Math.max(1, ...plots.map((plot) => plot.totalActivity))
  return (
    <div className="grid h-full w-full grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] items-end gap-0 px-8 pb-20 pt-32">
      {plots.map((plot) => (
        <div
          key={plot.project.id}
          className="flex h-full min-h-32 flex-col justify-end border border-plot-ink/20 bg-white/25 p-3"
        >
          <div
            className="min-h-1 bg-plot-ink/80"
            style={{
              height: `${Math.max(2, (plot.totalActivity / max) * 100)}%`,
            }}
          />
          <div className="mt-2 truncate font-display text-sm font-black uppercase">
            {plot.project.name}
          </div>
        </div>
      ))}
    </div>
  )
}
