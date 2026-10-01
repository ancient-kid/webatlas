import { useState, type ReactElement } from 'react'
import { Button } from '@renderer/components/wa/Button'

export const HINTS_SEEN_KEY = 'wa.hintsSeen'

function isSeen(): boolean {
  try {
    return Boolean(localStorage.getItem(HINTS_SEEN_KEY))
  } catch {
    return false
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(HINTS_SEEN_KEY, '1')
  } catch {
    // ignore storage exceptions
  }
}

export function HintOverlay(): ReactElement | null {
  const [visible, setVisible] = useState(() => !isSeen())

  if (!visible) return null

  const handleDismiss = (): void => {
    markSeen()
    setVisible(false)
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-40" data-testid="hint-overlay">
      {/* Hint 1: Near CaptureBar */}
      <div className="pointer-events-auto absolute left-6 top-16 max-w-[240px] rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 text-xs shadow-md">
        <p className="m-0 font-medium text-[var(--ink)]">Add the page you&apos;re reading. Alt+A</p>
      </div>

      {/* Hint 2: On Canvas */}
      <div className="pointer-events-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[260px] rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 text-center text-xs shadow-md">
        <p className="m-0 font-medium text-[var(--ink)] mb-3">
          Double-click empty space to write a note
        </p>
        <Button variant="primary" size="sm" onClick={handleDismiss} data-testid="hint-got-it">
          Got it
        </Button>
      </div>

      {/* Hint 3: By Organize */}
      <div className="pointer-events-auto absolute right-6 top-16 max-w-[260px] rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 text-xs shadow-md">
        <p className="m-0 font-medium text-[var(--ink)]">
          Organize suggests groups and links. You decide what stays.
        </p>
      </div>
    </div>
  )
}
