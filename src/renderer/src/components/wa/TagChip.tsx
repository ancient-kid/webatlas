import type { ReactElement } from 'react'
import type { Cat } from '@shared/types'
import { catVars } from './cat'

export interface TagChipProps {
  label: string
  /** Adds a category dot; the text stays ink on surface-sunken. */
  color?: Cat
}

export function TagChip({ label, color }: TagChipProps): ReactElement {
  return (
    <span className="wa wa-tag" style={color ? catVars(color) : undefined}>
      {color ? <span className="wa-tag__dot" style={{ background: 'var(--gc)' }} /> : null}
      {label}
    </span>
  )
}
