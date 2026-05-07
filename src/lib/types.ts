export type EntryKind =
  | 'todo'
  | 'delivered'
  | 'backlog'
  | 'decision'
  | 'learning'

export type Entry = {
  id: string
  projectId: string
  kind: EntryKind
  title: string
  /** delivered only — required */
  deliverable?: string
  /** backlog only — optional reason for parking */
  parkedReason?: string
  /** decision/learning only — entry body */
  body?: string
  /** initial creation timestamp (ms since epoch) */
  createdAt: number
  /** last kind-change timestamp; powers "today's" filters */
  movedAt: number
}

export type ProjectColorKey =
  // Row 1 — warm
  | 'terracotta'
  | 'sienna'
  | 'amber'
  | 'mustard'
  | 'wheat'
  | 'cream'
  // Row 2 — purples / pinks
  | 'iris'
  | 'lilac'
  | 'lavender'
  | 'blush'
  | 'rose'
  | 'mauve'
  // Row 3 — blues / teals
  | 'denim'
  | 'chambray'
  | 'sky'
  | 'mist'
  | 'seafoam'
  | 'jade'
  // Row 4 — greens / olives
  | 'forest'
  | 'sage'
  | 'celadon'
  | 'olive'
  | 'moss'
  | 'ochre'
  // Legacy keys — kept so saved projects from earlier palettes still resolve
  // their CSS variable. Not surfaced in PALETTE (user can't pick them again).
  | 'dusty-pink'
  | 'salmon'
  | 'clay'
  | 'rust'
  | 'sand'
  | 'pine'
  | 'slate'
  | 'cool-grey'

/**
 * A project color is either a palette key (rendered via CSS variable) or a
 * raw `#xxxxxx` hex string picked from the custom color input. Use the
 * `colorBg` helper to render either form.
 */
export type ProjectColor = ProjectColorKey | (string & {})

export type Project = {
  id: string
  name: string
  color: ProjectColor
  layout?: { x: number; y: number; w: number; h: number }
  createdAt: number
}

/**
 * Nested split tree describing how the bento landing page is carved up.
 * Leaves point at projects by index into the projects array. Lives in store
 * + persisted to chrome.storage so the user's resize work survives reloads.
 */
export type BentoTree =
  | { kind: 'leaf'; projectIdx: number }
  | {
      kind: 'split'
      dir: 'h' | 'v'
      children: BentoTree[]
      sizes: number[]
    }
