/**
 * The deliberately oversized "you shipped N things" number that anchors
 * the Stats dashboard. Same display-font scale as project names on the
 * StatusView, so visual rhythm carries over.
 */
export default function BigDelivered({ count }: { count: number }) {
  return (
    <div>
      <div className="font-display font-bold text-[8rem] leading-none tracking-tight tabular-nums">
        {count}
      </div>
      <div className="mt-3 font-mono uppercase tracking-[0.25em] text-[10px] text-plot-ink/60 dark:text-stone-100/60">
        delivered
      </div>
    </div>
  )
}
