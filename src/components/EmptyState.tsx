import { useStore } from '../lib/store'

export default function EmptyState({
  onCreate,
  historicalDayLabel,
}: {
  onCreate: () => void
  /** When provided, render the past-day empty variant: no create button,
   *  copy reflects that no projects existed on the viewed day. */
  historicalDayLabel?: string
}) {
  const isHistorical = historicalDayLabel !== undefined
  const backupFolderName = useStore((s) => s.backupFolderName)
  const setupBackupFolder = useStore((s) => s.setupBackupFolder)

  // Onboarding gate: on a brand-new install (no projects, viewing today),
  // require the user to choose a backup folder before they can create
  // their first project. This prevents silent data loss if Chrome ever
  // wipes the extension's local storage. Past-day empty bypasses this —
  // historical browsing doesn't create new data.
  const needsBackupSetup = !isHistorical && !backupFolderName

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-stone-100 px-12 text-plot-ink pb-12">
      <h1 className="font-display font-bold text-[12rem] leading-none tracking-tight">
        Plot
      </h1>
      <p className="font-mono uppercase tracking-[0.25em] text-xs mt-6 mb-8 text-plot-ink/60">
        {isHistorical
          ? `no plots existed on ${historicalDayLabel}`
          : 'a treemap of your projects'}
      </p>

      {needsBackupSetup && (
        <p className="max-w-xl text-center text-[14px] text-plot-ink/70 mb-8 leading-relaxed">
          Plot keeps your data on your computer. Pick a folder where Plot can
          quietly auto-save a backup. Your work survives Chrome reinstalls
          and you can restore it on any machine by re-picking the same
          folder.
        </p>
      )}

      {!isHistorical && (
        needsBackupSetup ? (
          <button
            onClick={() => setupBackupFolder()}
            className="font-mono uppercase tracking-[0.2em] text-sm bg-plot-ink text-stone-100 px-8 py-4 rounded-full hover:bg-black transition-colors"
          >
            choose backup folder
          </button>
        ) : (
          <button
            onClick={onCreate}
            className="font-mono uppercase tracking-[0.2em] text-sm bg-plot-ink text-stone-100 px-8 py-4 rounded-full hover:bg-black transition-colors"
          >
            create my first plot
          </button>
        )
      )}

      {!isHistorical && !needsBackupSetup && backupFolderName && (
        <p className="mt-6 font-mono uppercase tracking-[0.2em] text-[10px] text-plot-ink/50">
          backing up to {backupFolderName}
        </p>
      )}
    </main>
  )
}
