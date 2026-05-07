# Plot — MVP Plan

> Read `HANDOFF.md` first for full product/UX decisions. This file is the implementation roadmap.

## Why we're building this

Plot exists to do two things, and only two things:

1. **Multi-project visual management.** Open a new tab → see every project I'm tending, all at once, as colored plots of land. The treemap is not decoration; it's the whole reason the extension overrides New Tab. One glance, all projects.

2. **Hold me accountable for deliverables.** The Delivered section is the heart of the app. Moving a To-do → Delivered requires writing what I *actually shipped*, not just ticking a box. The deliverable text is kept alongside the original to-do title so I can see plan-vs-actual. Over time, Delivered becomes a portable record of real movement.

Everything else (Backlog, Decision, Learning, calendar, the editorial visual style) is in service of these two goals. If a feature doesn't push on multi-project visibility or deliverable accountability, it's out of MVP scope.

## Tech stack (most universal options)

| Layer | Choice | Why |
|-------|--------|-----|
| Build | **Vite + @crxjs/vite-plugin** | De facto modern Chrome extension toolchain; HMR, MV3 support out of the box |
| UI | **React 18 + TypeScript** | Most universal stack; abundant copy-paste help |
| Styling | **Tailwind CSS** | Universal; pair with CSS vars for the muted palette |
| State | **zustand** | Lightweight; zero boilerplate vs. Redux |
| Treemap drag | **react-grid-layout** | Standard library for free-grid resize + reposition |
| Card drag | **@dnd-kit** | Modern standard for cross-section drag |
| Dates | **date-fns** | Tree-shakeable, universal |
| Storage | **chrome.storage.local** + thin typed wrapper | Direct; no IndexedDB needed at this scale |
| Fonts | **Hubot Sans Bold** (display) + **Geist** (body) + **Geist Mono** (small caps + numbers) | All free, variable, OFL-licensed; bundle locally in `/public/fonts/` |

## Data model (event-log, no snapshots)

```ts
type EntryKind = 'todo' | 'delivered' | 'backlog' | 'decision' | 'learning'

type Entry = {
  id: string
  projectId: string
  kind: EntryKind
  title: string                // for todo/delivered/backlog: the to-do title
  deliverable?: string         // delivered only — required
  parkedReason?: string        // backlog only — optional
  body?: string                // decision/learning only — the entry text
  createdAt: number            // Date.now()
  movedAt?: number             // last kind-change timestamp (for "today's" filters)
}

type Project = {
  id: string
  name: string
  color: string                // palette key, not raw hex
  layout: { x: number; y: number; w: number; h: number }   // treemap position
  createdAt: number
}
```

Storage keys:
- `plot:projects` → `Project[]`
- `plot:entries:<projectId>` → `Entry[]` (per-project log; sharded so a single project's entries don't bloat one read)
- `plot:meta` → `{ schemaVersion, paletteVersion, ... }`

"Today's count" filters: `movedAt` (or `createdAt` if never moved) falls within local-day window.

## Milestones

Each milestone is a usable checkpoint. After **M2** the extension is daily-useful and treemap-feature-complete; after **M3** all 5 sections + drag are wired up.

### M0 — Bootstrap
- `git init`; `.gitignore` for node_modules / dist
- Vite + React + TS scaffold; add `@crxjs/vite-plugin`
- `manifest.json` (MV3) with `chrome_url_overrides.newtab` pointing at our app
- Tailwind setup; load Anton + Inter locally (`/public/fonts/`)
- "Hello Plot" New Tab renders via unpacked extension
- **Done when**: `chrome://extensions` → load unpacked → opening a new tab shows the placeholder

### M1 — Single-project accountability core
Hardcode one project. Build Status view with **3 sections only**: Backlog, To-do, Delivered.
- Add To-do (input → Enter)
- Click a To-do → inline-expand with deliverable field (prefilled with title) → Enter commits move to Delivered, text **required**
- Drag/click-to-park a To-do → Backlog → inline-expand with optional reason field
- Delivered list: deliverable on primary line, original to-do title as subtitle
- Storage wrapper + `Entry` type wired to `plot:entries:default`
- **Done when**: I can run the accountability loop end-to-end on the hardcoded project

### M2 — Multi-project + free-grid treemap
- Project list CRUD: create / rename / delete / pick color from preset muted palette (10–12 swatches)
- New Tab renders all projects in a **free-grid treemap** via `react-grid-layout`:
  - Drag-reposition + drag-resize
  - Persist `{x, y, w, h}` to `Project.layout`
  - Enforce `minW` / `minH` so cells always fit the count layout
- Each rectangle shows full layout per spec: name + today's progress (To-do count, Delivered count, completion %) + today's counts (Backlog/Decision/Learning today)
- Click rectangle (without dragging) → in-page route to that project's Status view
- New project gets a default position from a "first empty slot" helper so the grid never starts empty-but-broken
- **Done when**: I can manage 3+ real projects, drag-rearrange them, layout persists across reloads, and the treemap shows live counts

### M3 — Decision + Learning + cross-section drag
- Add Decision and Learning sections in Status view (input → Enter, inline-edit, inline-delete)
- @dnd-kit cross-section drag for workflow trio:
  - Backlog ↔ To-do, To-do ↔ Delivered (Delivered → To-do retains deliverable text)
  - Block Backlog ↔ Delivered (no semantics)
  - To-do → Delivered still triggers inline-expand for deliverable
  - To-do → Backlog still triggers optional reason field
- **Done when**: full 5-section Status view works with all the spec'd transitions

### M4 — Calendar / history
- Calendar route (button in app chrome): month grid; click a date → day view
- Day view: filter all projects' entries to that local day; render same Status sections
- Past-day entries are editable in place (consistent with the rest of the app)
- **Done when**: I can flip to any past day and see/edit the state

### M5 — Visual polish + ship-readiness
- Tighten type to JOAT references (size scale, line-height, tracking)
- Empty states: no projects, no entries today, project never had X kind
- Extension icons (16 / 48 / 128) — simple muted-color plot mark
- Keyboard: Cmd+Enter to commit inline expand; Esc to cancel
- Manifest polish: name, description, version, author
- **Done when**: I'd happily install this on a fresh machine

## Out of scope for MVP

- Sync / cloud / multi-device (local-only by design)
- Search across projects
- Tags or cross-project filters
- Notifications, streaks, gamification (accountability comes from the deliverable note, not nags)
- Export / import (defer until first storage-migration need)

## Post-MVP backlog (priority order)

1. JSON export / backup
2. Storage schema versioning + migrations
3. Hover-to-reveal timestamps on Decision / Learning entries
4. Optional weekly view on the calendar
5. Treemap "shuffle to fit" if a layout is broken (e.g., new project with no position)
