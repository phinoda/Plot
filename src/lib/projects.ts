import type { Project } from './types'
import { todayKey } from './date'

export function activeDayKey(viewingDay: string | null): string {
  return viewingDay ?? todayKey()
}

export function isTodayView(viewingDay: string | null): boolean {
  return activeDayKey(viewingDay) === todayKey()
}

export function projectsForDay(
  projects: Project[],
  dayKey: string,
): Project[] {
  if (dayKey === todayKey()) return projects
  return projects.filter((p) => todayKey(p.createdAt) <= dayKey)
}

export function projectForDay(
  projects: Project[],
  currentProjectId: string | null,
  dayKey: string,
): Project | null {
  const visibleProjects = projectsForDay(projects, dayKey)
  if (currentProjectId) {
    const found = visibleProjects.find((p) => p.id === currentProjectId)
    if (found) return found
  }
  return visibleProjects[0] ?? null
}
