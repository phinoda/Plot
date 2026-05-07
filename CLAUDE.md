# Plot — Working with Claude

> Project-scoped instructions for Claude Code. Read together with `HANDOFF.md` (product/UX) and `PLAN.md` (implementation roadmap).

## Workflow: confirm → plan → execute

When the user gives feedback or a new request, **do not jump to implementation**. Follow this three-step loop, every time:

1. **Echo back understanding.** Restate the request in your own words — list each change as a discrete bullet. Surface ambiguities and ask. Stop and wait for the user to confirm alignment.
2. **Propose a plan.** Once aligned on *what*, propose *how*: which files/components change, the order, and any open questions. Stop and wait for plan approval.
3. **Execute.** Only after plan approval, start editing.

Skipping straight to step 3 — even when the request feels clear — is not allowed. The user has explicitly said: "先跟我确认一下你的理解，只有当我跟你 aligned 了，你才进行到下一步。"

## Asking questions / proposing options

When you list options for the user to pick from, **use plain labels**: `A / B / C` or `1 / 2 / 3`. No Greek letters (`α / β / γ`), no math symbols (`Δ` for "delta"), no decorative markers. The user finds these noisy and hard to refer back to.

**Avoid internet jargon / shorthand** even when it feels natural. Specifically: don't use `一刀` / `两刀` for "one-step" / "two-step" — write `一步走` / `两步走`, or just enumerate the steps directly. Same goes for any 黑话-style condensation. Plain language wins.

Bad examples:
- ❌ `(α) 两步走... (β) 一步走...`
- ❌ `Δ 1 — 排序规则 (新增)`
- ❌ `一刀做完 onboarding，二刀创建项目`

Good examples:
- ✅ `A. 两步走... B. 一步走...`
- ✅ `Change 1 — sorting rule (new)`
- ✅ `先做 onboarding，再创建项目`

## Programmer jargon → plain Chinese

When explaining how something works in Chinese, **don't directly translate English programmer terms**. The user is the product owner, not a JS/React engineer; literal translations sound either wrong or like buzzwords.

Specifically:
- ❌ `订阅 store 状态` (literal translation of "subscribe to store state" — sounds like a paid subscription)
- ✅ `监听 store 状态变化`，or better: `state 一变就自动跑一段代码`
- ❌ `挂载组件` (literal "mount component" — sounds violent)
- ✅ `组件第一次渲染的时候` / `组件出现在页面上时`
- ❌ `hook 进 lifecycle`
- ✅ `在组件 mount/unmount 的时候触发`

Rule of thumb: if a sentence in Chinese leans on a borrowed English noun-phrase verbatim (`订阅 X` / `挂载 X` / `dispatch X`), pause and ask "would my friend who isn't a coder understand this?". Rewrite if not.

English technical terms that are universally understood in Chinese tech conversation (`HMR`, `vite`, `Tailwind`, `Tailwind utility class`, `Chrome storage`, `props`, `state` itself) are fine to keep as English — the issue is the *Chinese verbs* I attach to them.

## Permission requests

Whenever a tool call needs the user's approval (Bash command, installing a package, writing to an unfamiliar path, modifying core config like `package.json` / `manifest.config.ts` / `vite.config.ts`), state in **one short sentence of plain Chinese** what the action is and why it's needed, *before* invoking the tool. Don't drop a raw English command on the user and let them figure it out.

Examples:

- ❌ Calling `npm install some-package` directly
- ✅ "我要装 some-package，因为做 X 功能需要它" then calling

## Language: English-only artifacts

All written artifacts that ship in this repo are in **English**:

- UI copy: buttons, labels, placeholders, headings, error messages, empty states
- Code identifiers: variable / function / type / file names
- Code comments and JSDoc
- Documentation files: `HANDOFF.md`, `PLAN.md`, `CLAUDE.md`, future `README.md`, etc.

Exception: the conversation between Claude and the user remains in Chinese (the user's working language). The English rule applies to anything that lands in the repo or renders in the product, not to chat replies.

## Cursor

Every interactive element must show `cursor: pointer` on hover — buttons, links, anything clickable. The base rule in `src/styles.css` covers `<button>` and `<a>`, so you don't need to add `cursor-pointer` to those by hand. **If you make a clickable element from a `<div>` or another non-interactive tag, add the `cursor-pointer` Tailwind class manually.**

## Dev server

Fixed port **3003** (`vite.config.ts` has `strictPort: true`). If 3003 is taken, fail loudly — don't let it drift to another port.
