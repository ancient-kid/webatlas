import type { ReactElement } from 'react'
import { cn } from '@renderer/lib/utils'
import { Button } from './Button'
import { Icon, type IconName } from './Icon'

/** DESIGN.md: suggestions below this confidence are never shown. */
export const MIN_GHOST_CONFIDENCE = 0.4

export type GhostKind = 'cluster' | 'edge' | 'tag'

const KINDS: Record<GhostKind, { icon: IconName; label: string }> = {
  cluster: { icon: 'focus', label: 'Suggested group' },
  edge: { icon: 'link', label: 'Suggested link' },
  tag: { icon: 'tag', label: 'Suggested tag' }
}

export interface GhostSuggestionProps {
  kind: GhostKind
  title: string
  /** One sentence saying why; always shown. */
  reason: string
  /** 0–1. */
  confidence?: number
  /** The matching ghost on the canvas is being pointed at. */
  hovered?: boolean
  onAccept?: () => void
  onReject?: () => void
  onHoverChange?: (hovering: boolean) => void
}

/** DESIGN.md GhostSuggestion: the review card for one AI suggestion. */
export function GhostSuggestion(p: GhostSuggestionProps): ReactElement | null {
  if (p.confidence != null && p.confidence < MIN_GHOST_CONFIDENCE) return null
  const k = KINDS[p.kind]
  return (
    <div
      className={cn('wa wa-ghost', p.hovered && 'wa-ghost--hovered')}
      role="group"
      aria-label={`Suggestion: ${p.title}`}
      onMouseEnter={() => p.onHoverChange?.(true)}
      onMouseLeave={() => p.onHoverChange?.(false)}
    >
      <div className="wa-ghost__head">
        <span className="wa-badge">
          <Icon name={k.icon} size={14} />
          {k.label}
        </span>
        {p.confidence != null ? (
          <span className="wa-conf">{Math.round(p.confidence * 100)}% match</span>
        ) : null}
      </div>
      <p className="wa-ghost__title">{p.title}</p>
      <p className="wa-ghost__why">{p.reason}</p>
      <div className="wa-ghost__actions">
        <Button variant="accept" size="sm" icon="check" onClick={p.onAccept}>
          Accept
        </Button>
        <Button variant="reject" size="sm" icon="x" onClick={p.onReject}>
          Reject
        </Button>
      </div>
    </div>
  )
}
