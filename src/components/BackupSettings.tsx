import { useEffect, useRef } from 'react'
import { useStore } from '../lib/store'
import HitArea from './HitArea'

/**
 * Popover that shows the current auto-backup folder and lets the user
 * switch to a different one. Anchored to the gear button in the BottomBar's
 * bottom-left corner. Auto-backup itself can't be turned off — it's a
 * required onboarding step.
 *
 * Layout choices that mirror the calendar popover (consistency):
 *  - Dark plot-ink background, light text
 *  - Anchored above the trigger button (`bottom-full ... mb-2`)
 *  - Click-outside / Escape closes
 */
export default function BackupSettings({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const folderName = useStore((s) => s.backupFolderName)
  const error = useStore((s) => s.backupError)
  const setupBackupFolder = useStore((s) => s.setupBackupFolder)

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

  const handleChange = async () => {
    const ok = await setupBackupFolder()
    if (ok) onClose()
  }

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-2 bg-plot-ink text-stone-100 border border-stone-100/20 rounded-md p-4 shadow-lg w-72"
    >
      <div className="font-mono uppercase tracking-[0.2em] text-[10px] text-stone-100/60 mb-3">
        Backup
      </div>

      {folderName ? (
        <>
          <div className="text-[12px] mb-1">
            <span className="text-stone-100/60">Folder · </span>
            <span className="font-mono">{folderName}</span>
          </div>
          <div className="font-mono uppercase tracking-[0.15em] text-[10px] text-stone-100/50 mb-4">
            auto-saves on every change
          </div>

          {error && (
            <div className="text-[11px] text-red-300 mb-3 leading-relaxed">
              {error}
            </div>
          )}

          <HitArea
            onClick={handleChange}
            className="text-stone-100/80 hover:text-stone-100 uppercase tracking-[0.2em] text-[10px] justify-start"
          >
            <span>Change folder…</span>
          </HitArea>
        </>
      ) : (
        <>
          <div className="text-[12px] text-stone-100/70 mb-4 leading-relaxed">
            Auto-backup isn't set up. Pick a folder and Plot will quietly
            mirror your data there on every change.
          </div>
          <HitArea
            onClick={handleChange}
            className="text-stone-100 hover:text-white uppercase tracking-[0.2em] text-[10px] justify-start"
          >
            <span>Choose backup folder…</span>
          </HitArea>
        </>
      )}
    </div>
  )
}
