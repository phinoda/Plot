# Plot — Handoff from initial discussion

> This doc captures the brainstorm session that kicked off the project, plus the follow-up Q&A that resolved the original 6 open questions. All product/UX questions are now answered. **Implementation roadmap lives in `PLAN.md`** — read this for the *what*, read PLAN.md for the *how*.

## What Plot is

A **Chrome extension task manager** that takes over the New Tab page. Organized around the metaphor of "我的一亩三分地" — each project is a colored plot of land you tend daily.

**Name rationale:** "Plot" = a plot of land (the treemap visual) + a plan/scheme (the task management). Short, double-meaning, and the colored rectangles in the grid literally are "plots."

## Form factor & storage

- **Surface:** Chrome extension that overrides the New Tab page
- **Storage:** `chrome.storage.local` only (no backend, no sync)
- **Day boundary:** local midnight (00:00)

## Two views (only)

### 1. Project view
- Treemap-style grid of colored rectangles filling the whole tab
- **Free-grid layout** — user drags to resize and position; size is NOT auto-computed from data
- Each rectangle = one project, with a user-chosen color
- Click a rectangle → enter Status view for that project

### 2. Status view (per project)
Five sections, each appendable:

| Section   | Purpose |
|-----------|---------|
| Backlog   | Stuff parked for later |
| To-do     | What I'm working on now (checkable) |
| Delivered | Completed work with verifiable deliverables |
| Decision  | Decisions made today |
| Learning  | What I learned today |

### Project rectangle (treemap cells)
- **Color**: preset muted palette only (no free color picker). Curated low-saturation set; exact palette TBD with the visual direction.
- **Content layout** (top → bottom):
  1. Project name — heavy condensed display type, dark on color
  2. **Today's progress** block:
     - Today's To-do count + today's Delivered count
     - Completion percentage = `delivered_today / (to-do remaining + delivered_today)` (show `—` when both are zero)
  3. **Counts** block (all today-scoped, parallel to the today's-progress block):
     - Backlog count = items added to Backlog today
     - Decision count = decisions logged today
     - Learning count = learnings logged today
- **Minimum cell size**: every rectangle has a minimum width and height that guarantees the full layout above stays legible. Drag-resize in the free grid is bounded — user cannot shrink a cell below the minimum. (Exact dimensions TBD when implementing.)

### Cross-section drag rules
- **Workflow trio** (To-do / Delivered / Backlog): any-to-any drag, both directions.
  - Backlog → To-do: promote ("ready to do this now")
  - Delivered → To-do: undo / correction; the deliverable text is **retained** with the item (useful when re-delivering)
  - Backlog ↔ Delivered: not allowed (skips the "doing" step — no meaningful semantics)
- **Decision / Learning**: do NOT participate in drag. They're journal entries, not workflow items.

### Decision / Learning behavior
- **Always editable, always deletable** — no midnight lock. User can edit any entry on any day, including past days. (Goes against the "freeze after snapshot" instinct; user explicitly chose flexibility over historical immutability.)
- **Timestamps**: store minute precision (or finer — `Date.now()` is essentially free at this scale) in the data model. UI does **not** surface timestamps by default; entries display in insertion order. Reserved for future use (hover, time-of-day sort, etc.) without a data migration.

### To-do flow (confirmed behaviors)
- **To-do → Delivered:** card expands inline with a field below for the verifiable deliverable. (No modal/popup.)
  - Deliverable text is **required**, but the field is **prefilled with the to-do title** so a user can accept-as-is by hitting enter for trivial cases.
  - In the Delivered list, render two lines: deliverable text as the primary line, original to-do title as a smaller subtitle. (Captures plan-vs-actual distance.)
- **To-do → Backlog:** card expands inline with a field below for why it's being parked. (No modal/popup.)
  - Note is **optional** — Backlog is a parking lot; "not now" is a valid state without explanation. Inline expansion is invitation enough; user can leave it blank.

## Calendar / history (event-log model)

No snapshots. The data model is a single **event log per project** — every entry (To-do, Delivered, Backlog, Decision, Learning) carries its own timestamp(s) (`created_at`, `delivered_at`, `parked_at`, etc., minute-precision via `Date.now()`).

The calendar / day-view is a **derived view**: "show me 5 May 2026" filters the log to entries whose relevant date falls on that day. Nothing is frozen, nothing is duplicated.

**Always editable**: any entry on any day can be edited or deleted at any time. There is no immutable copy to fight; the log is the only source of truth. Editing yesterday's Learning, or correcting a Delivered note from last week, just mutates the entry in place.

This eliminates a whole class of complexity from the original plan: no midnight cron / next-open catch-up, no daily storage bloat, no snapshot-vs-live divergence.

## Confirmed decisions

**Foundation**
- [x] Name: **Plot**
- [x] Location: `/Users/phinoda/Phi/Projects/Plot/` (sibling of Figtree, independent repo)
- [x] Surface: Chrome extension, New Tab override (not popup, not side panel)
- [x] Storage: `chrome.storage.local` only — no backend, no sync
- [x] Day boundary: local midnight

**Structure**
- [x] Two views only: Project (treemap) + Status (per-project)
- [x] Status has 5 sections: Backlog / To-do / Delivered / Decision / Learning
- [x] Treemap = free user-controlled grid (not data-driven sizing); cells have a minimum width/height to keep their content legible

**Behavior**
- [x] To-do → Delivered: inline card expansion (no modal); deliverable text required, prefilled with to-do title; Delivered list shows deliverable as primary line + original to-do title as subtitle
- [x] To-do → Backlog: inline card expansion (no modal); reason note is optional
- [x] Cross-section drag: workflow trio (To-do / Delivered / Backlog) is any-to-any except Backlog ↔ Delivered (skips "doing"); Decision and Learning don't participate in drag
- [x] All entries are always editable and deletable, including past days — no midnight lock

**Data model**
- [x] Event log per project (timestamps on every entry, minute precision); no daily snapshots; calendar views are derived

**Visual**
- [x] Project rectangle = preset muted-color palette (no free picker); content layout = name, today's progress, today's counts; minimum cell size enforced
- [x] Aesthetic direction = low-saturation pastels + linear elements + editorial type (see Visual direction below)

## Visual direction

Reference images live in `references/style/` (3 frames from a project called "JOAT MASTERY / Deliberate Practice v1.0"):
- `joat-terracotta.png` — warm burnt-orange ground, cream-filled pills with thin dark stroke
- `joat-cool-grey.png` — cool grey-lavender ground, very subtle pill fill with thin stroke
- `joat-dusty-pink.png` — pale dusty pink ground, transparent pills with thin dark outline only

**Palette**: low-saturation muted pastels — terracotta, dusty pink, cool grey, sage, etc. Flat color fields. No gradients, no drop shadows.

**Type stack** (decided — all free, variable, OFL-licensed, bundled locally):
- **Hubot Sans Bold** — display headings (project names, page titles). Wide and characterful; gives poster gravity without going JOAT-industrial.
- **Geist** — body / UI text. Neutral geometric sans, Anthropic-adjacent feel.
- **Geist Mono** — tracked small-caps tertiary labels (footer marks, section subtitles) and **numerical readouts** in the project rectangle (today's counts, percentages — uses tabular figures so digits align cleanly across cells).

Note: type direction shifted from the JOAT references' condensed-industrial display toward Anthropic-adjacent geometric (Geist) + a characterful wide display (Hubot Sans). The JOAT references still inform **palette** and **linear forms**, not type.

**Forms**: linear/line-based — pill chips with 1px dark stroke (filled or transparent), underline-only inputs (single bottom rule, no box). Generous whitespace, editorial / poster feel rather than dashboard.

**Application to Plot**:
- Each project rectangle in the treemap is a flat field of its chosen muted color; project name set in Hubot Sans Bold; today's-progress and counts blocks set in Geist Mono with tabular figures
- Status view inherits the project's color as the page ground; section headings in Hubot Sans Bold (smaller scale than treemap), entries in Geist
- Dark text on light/muted ground; preserve the editorial breathing room rather than packing the UI

## Tech notes (open — to decide as part of the MVP plan)

- Build tooling for the extension (Vite + CRX plugin? Plasmo? Plain manifest v3?)
- Framework (React? Svelte? Vanilla?)
- Concrete shape of the per-project event log + project list in `chrome.storage.local`
- Migration / schema versioning strategy for `chrome.storage.local`
- Drag implementation for both the treemap (resize + reposition cells) and the in-section card drag (cross-section moves)
- Type stack: which heavy-condensed display + humanist/grotesque body fonts to ship with the extension

## Pending challenges raised but not yet pushed back on

- Free-grid drag for the treemap is more work than a fixed grid — worth confirming the user really wants drag-to-resize vs. just drag-to-reorder with auto-sized cells. (Currently committed to free-grid; revisit if the implementation effort balloons.)
