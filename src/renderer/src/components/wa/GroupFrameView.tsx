import type { CSSProperties, ReactElement, ReactNode } from 'react'
import type { Cat } from '@shared/types'
import { cn } from '@renderer/lib/utils'
import { Icon } from './Icon'
import { catVars } from './cat'

export interface GroupFrameViewProps {
  label: string
  color?: Cat
  /** An AI suggestion: dashed, ghost colours and "(suggested)" in the label. */
  ghost?: boolean
  selected?: boolean
  /** Fixed size (on the canvas); the demo default is 320 × 160. */
  width?: number | string
  height?: number | string
  /** Replaces the label text while renaming. */
  labelSlot?: ReactNode
  children?: ReactNode
  className?: string
}

/** DESIGN.md GroupFrame: a labelled, coloured region whose cards move with it. */
export function GroupFrameView(p: GroupFrameViewProps): ReactElement {
  const style: CSSProperties = {
    ...(p.ghost ? {} : catVars(p.color ?? 'teal')),
    width: p.width ?? 320,
    minHeight: p.height ?? 160,
    ...(typeof p.height === 'number' || typeof p.height === 'string' ? { height: p.height } : null)
  }
  return (
    <section
      className={cn(
        'wa wa-group',
        p.ghost && 'wa-group--ghost',
        p.selected && 'wa-group--selected',
        p.className
      )}
      style={style}
      aria-label={p.ghost ? `${p.label} (suggested)` : p.label}
    >
      <span className="wa-group__label">
        {p.ghost ? <Icon name="focus" size={12} /> : null}
        {p.labelSlot ?? p.label}
        {p.ghost ? ' (suggested)' : ''}
      </span>
      {p.children}
    </section>
  )
}
