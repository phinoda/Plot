/**
 * Analyze dashboard's pre-unlock state. Mirrors the visual language of
 * `EmptyState.tsx` (Plot wordmark + small-caps tagline) so the user
 * doesn't feel like they've landed somewhere strange — just somewhere
 * they haven't filled in enough yet.
 *
 * Threshold (10) is enforced by the caller; this component is only
 * rendered when `count < 10`.
 */
const THRESHOLD = 10

export default function EmptyStats({
  count,
  isDark,
}: {
  count: number
  isDark: boolean
}) {
  return (
    <main
      className={`${isDark ? 'dark ' : ''}min-h-screen flex flex-col items-center justify-center bg-stone-100 dark:bg-plot-ink px-12 text-plot-ink dark:text-stone-100 pb-12`}
    >
      <h1 className="font-display font-bold text-[12rem] leading-none tracking-tight">
        Plot
      </h1>
      <p className="font-mono uppercase tracking-[0.25em] text-xs mt-6 mb-10 text-plot-ink/60 dark:text-stone-100/60">
        log {THRESHOLD}+ entries to unlock analysis
      </p>
      <div className="font-mono uppercase tracking-[0.2em] text-[12px] text-plot-ink/70 dark:text-stone-100/70 tabular-nums">
        you've logged {count} of {THRESHOLD}
      </div>
      <div className="mt-3 w-64 h-1.5 bg-plot-ink/10 dark:bg-stone-100/15 rounded-full overflow-hidden">
        <div
          className="h-full bg-plot-ink dark:bg-stone-100 transition-all duration-500"
          style={{
            width: `${Math.min(100, (count / THRESHOLD) * 100)}%`,
          }}
        />
      </div>
    </main>
  )
}
