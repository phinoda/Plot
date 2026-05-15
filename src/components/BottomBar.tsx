import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { formatDayLabel, todayKey } from '../lib/date'
import { projectsForDay } from '../lib/projects'
import BackupSettings from './BackupSettings'
import HitArea from './HitArea'

export default function BottomBar({ onCreate }: { onCreate: () => void }) {
  const viewingDay = useStore((s) => s.viewingDay)
  const setViewingDay = useStore((s) => s.setViewingDay)
  const setCurrentProject = useStore((s) => s.setCurrentProject)
  const viewMode = useStore((s) => s.viewMode)
  const setViewMode = useStore((s) => s.setViewMode)
  const projects = useStore((s) => s.projects)
  const plotsView = useStore((s) => s.plotsView)
  const setPlotsView = useStore((s) => s.setPlotsView)

  const today = todayKey()
  const activeDay = viewingDay ?? today
  const isOnToday = viewingDay === null || viewingDay === today
  const showPlotsViewToggle =
    viewMode === 'project' && projectsForDay(projects, activeDay).length > 1

  const [calendarOpen, setCalendarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const backupError = useStore((s) => s.backupError)

  // "May 6" — short, no weekday — for the snapshot banner. Parses the
  // YYYY-MM-DD activeDay key in the local timezone (matches `todayKey`).
  const snapshotDate = (() => {
    const [y, m, d] = activeDay.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  })()

  // Picking a past day always pops the user out of any open detail view —
  // the project they were on may not have existed on that day, and even if
  // it did, the user explicitly opted into "browse the historical landing".
  const pickDay = (day: string) => {
    if (day === today) {
      setViewingDay(null)
    } else {
      setViewingDay(day)
      setCurrentProject(null)
    }
  }

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 h-12 text-stone-100 flex items-center justify-between px-3 sm:px-4 font-mono text-[10px] sm:text-xs transition-colors ${
        isOnToday ? 'bg-plot-ink' : 'bg-red-900'
      }`}
    >
      <div className="flex items-center gap-2 sm:gap-3 relative">
        <HitArea
          aria-label="Backup settings"
          onClick={() => setSettingsOpen((o) => !o)}
          className={`${
            backupError
              ? 'text-red-300 hover:text-red-200'
              : 'text-stone-100/70 hover:text-stone-100'
          } transition-colors`}
        >
          <GearIcon />
        </HitArea>
        {settingsOpen && (
          <BackupSettings onClose={() => setSettingsOpen(false)} />
        )}
        <span className="hidden sm:inline uppercase tracking-[0.2em]">
          {formatDayLabel(activeDay)}
        </span>
        <HitArea
          aria-label="Pick a date"
          onClick={() => setCalendarOpen((o) => !o)}
          className="text-stone-100 hover:text-white"
        >
          <CalendarIcon />
        </HitArea>
        {calendarOpen && (
          <CalendarPopover
            selectedDay={activeDay}
            onPick={(day) => {
              pickDay(day)
              setCalendarOpen(false)
            }}
            onClose={() => setCalendarOpen(false)}
          />
        )}
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <ModeButton
            active={viewMode === 'project'}
            onClick={() => setViewMode('project')}
          >
            Plots
          </ModeButton>
          {showPlotsViewToggle && (
            <PlotsViewToggle
              active={plotsView === 'city'}
              onClick={() =>
                setPlotsView(plotsView === 'city' ? 'bento' : 'city')
              }
            />
          )}
        </div>
        <span className="text-stone-100/30">/</span>
        <ModeButton
          active={viewMode === 'status'}
          onClick={() => setViewMode('status')}
        >
          Status
        </ModeButton>
        <span className="text-stone-100/30">/</span>
        <ModeButton
          active={viewMode === 'stats'}
          onClick={() => setViewMode('stats')}
        >
          Analyze
        </ModeButton>
      </div>

      <div className="flex items-center gap-4">
        {isOnToday ? (
          <HitArea
            onClick={onCreate}
            className="text-stone-100 hover:text-white uppercase tracking-[0.2em]"
          >
            <span className="hidden sm:inline">+ Add New Plot</span>
            <span className="sm:hidden text-base leading-none">+</span>
          </HitArea>
        ) : (
          <div className="flex items-center gap-4">
            <span className="uppercase tracking-[0.2em] text-stone-100/55">
              you are viewing a snapshot of {snapshotDate}
            </span>
            <HitArea
              onClick={() => setViewingDay(null)}
              className="uppercase tracking-[0.2em]"
            >
              <span className="bg-stone-100 text-plot-ink rounded-full px-3 py-1">
                Go to today
              </span>
            </HitArea>
          </div>
        )}
      </div>
    </div>
  )
}

function PlotsViewToggle({
  active,
  onClick,
}: {
  active: boolean
  onClick: () => void
}) {
  return (
    <HitArea
      role="switch"
      aria-checked={active}
      aria-label="Toggle 3D Plots view"
      title="3D Plots"
      onClick={onClick}
      className="text-stone-100/75 hover:text-white uppercase tracking-[0.18em] gap-1.5"
    >
      <span
        className={`relative block h-[18px] w-9 rounded-full border transition-colors duration-200 ease-out ${
          active
            ? 'bg-stone-100 border-stone-100'
            : 'bg-transparent border-stone-100/45'
        }`}
      >
        <span
          className={`absolute left-[3px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full transition-[transform,background-color] duration-200 ease-out will-change-transform ${
            active
              ? 'translate-x-[18px] bg-plot-ink'
              : 'translate-x-0 bg-stone-100/75'
          }`}
        />
      </span>
      <span className="text-[10px] leading-none">3D</span>
    </HitArea>
  )
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <HitArea
      onClick={onClick}
      className={`uppercase tracking-[0.2em] transition-colors ${
        active
          ? 'text-stone-100'
          : 'text-stone-100/40 hover:text-stone-100/70'
      }`}
    >
      <span>{children}</span>
    </HitArea>
  )
}

function GearIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function dayKeyOf(year: number, monthIdx: number, day: number): string {
  return `${year}-${pad(monthIdx + 1)}-${pad(day)}`
}

function CalendarPopover({
  selectedDay,
  onPick,
  onClose,
}: {
  selectedDay: string
  onPick: (day: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const today = todayKey()
  const [year, monthIdx] = parseDayKey(selectedDay)
  const [viewYear, setViewYear] = useState(year)
  const [viewMonth, setViewMonth] = useState(monthIdx)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const firstOfMonth = new Date(viewYear, viewMonth, 1)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  // Monday-first grid: Mon=0, Sun=6.
  const startOffset = (firstOfMonth.getDay() + 6) % 7

  const monthLabel = firstOfMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  const stepMonth = (delta: number) => {
    let m = viewMonth + delta
    let y = viewYear
    if (m < 0) {
      m = 11
      y -= 1
    } else if (m > 11) {
      m = 0
      y += 1
    }
    setViewMonth(m)
    setViewYear(y)
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-2 bg-plot-ink text-stone-100 border border-stone-100/20 rounded-md p-3 shadow-lg w-64"
    >
      <div className="flex items-center justify-between mb-2">
        <HitArea
          onClick={() => stepMonth(-1)}
          className="text-stone-100/70 hover:text-stone-100"
          aria-label="Previous month"
        >
          <span>‹</span>
        </HitArea>
        <span className="uppercase tracking-[0.2em] text-[10px]">
          {monthLabel}
        </span>
        <HitArea
          onClick={() => stepMonth(1)}
          className="text-stone-100/70 hover:text-stone-100"
          aria-label="Next month"
        >
          <span>›</span>
        </HitArea>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-[10px] uppercase tracking-[0.15em] text-stone-100/50 mb-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-center py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-xs">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />
          const key = dayKeyOf(viewYear, viewMonth, d)
          const isFuture = key > today
          const isSelected = key === selectedDay
          const isToday = key === today
          return (
            <HitArea
              key={i}
              disabled={isFuture}
              onClick={() => !isFuture && onPick(key)}
              className={`w-8 h-8 rounded-full ${
                isFuture
                  ? 'text-stone-100/25 cursor-not-allowed'
                  : isSelected
                    ? '!bg-stone-100 text-plot-ink'
                    : isToday
                      ? 'text-stone-100 ring-1 ring-stone-100/40'
                      : 'text-stone-100/80 hover:bg-stone-100/10'
              }`}
            >
              <span>{d}</span>
            </HitArea>
          )
        })}
      </div>
    </div>
  )
}

function parseDayKey(key: string): [number, number] {
  const [y, m] = key.split('-').map(Number)
  return [y, m - 1]
}
