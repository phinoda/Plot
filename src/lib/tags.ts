import { useMemo } from 'react'
import { useStore } from './store'

/**
 * Tag detection. A tag is `#` followed by one or more "tag chars": ASCII
 * word chars (alphanumerics + underscore), CJK ideographs (so Chinese tags
 * work), or hyphen.
 *
 * Tags live inline in the text fields of an entry — there's no separate
 * `tags` column on Entry. Listing all tags ever used means walking every
 * entry's text fields and pulling matches out.
 */
export const TAG_GLOBAL_REGEX = /#[\w一-鿿-]+/g
export const TAG_FULL_MATCH_REGEX = /^#[\w一-鿿-]+$/
export const TAG_CHAR_REGEX = /[\w一-鿿-]/

/** Pull every tag (without the leading `#`) from a single text blob. */
export function extractTagsFromText(text: string | undefined): string[] {
  if (!text) return []
  const matches = text.match(TAG_GLOBAL_REGEX) ?? []
  return matches.map((m) => m.slice(1))
}

/** Collect every unique tag the user has ever typed across all projects.
 *  Used to populate the autocomplete suggestion list. Sorted alpha. */
export function useAllTags(): string[] {
  const projects = useStore((s) => s.projects)
  const entriesByProject = useStore((s) => s.entriesByProject)
  return useMemo(() => {
    const tags = new Set<string>()
    for (const p of projects) {
      const list = entriesByProject[p.id] ?? []
      for (const e of list) {
        for (const t of extractTagsFromText(e.title)) tags.add(t)
        for (const t of extractTagsFromText(e.body)) tags.add(t)
        for (const t of extractTagsFromText(e.deliverable)) tags.add(t)
        for (const t of extractTagsFromText(e.parkedReason)) tags.add(t)
      }
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b))
  }, [projects, entriesByProject])
}
