import type { ReactElement } from 'react'
import type { Cat } from '@shared/types'
import { cn } from '@renderer/lib/utils'
import { catVars } from './cat'

export interface TagChipProps {
  label: string
  /** Adds a category dot; the text stays ink on surface-sunken. */
  color?: Cat
  /** A suggested tag (not yet accepted): dashed, marked "(suggested)". */
  ghost?: boolean
}

export function TagChip({ label, color, ghost }: TagChipProps): ReactElement {
  return (
    <span
      className={cn('wa wa-tag', ghost && 'wa-tag--ghost')}
      style={color ? catVars(color) : undefined}
    >
      {color ? <span className="wa-tag__dot" style={{ background: 'var(--gc)' }} /> : null}
      {ghost ? `#${label} (suggested)` : label}
    </span>
  )
}
