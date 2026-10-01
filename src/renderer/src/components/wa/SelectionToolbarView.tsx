import type { ReactElement } from 'react'
import { CATS, type Cat } from '@shared/types'
import { cn } from '@renderer/lib/utils'
import { Tip } from '../ui/tooltip'
import { Icon, type IconName } from './Icon'
import { catVars } from './cat'

export interface SelectionToolbarViewProps {
  /** The selection's colour, if they all share one. */
  color?: Cat | null
  /** Clicking the active colour again clears it (null). */
  onColor?: (color: Cat | null) => void
  onTag?: () => void
  onNote?: () => void
  onOpen?: () => void
  onZoom?: () => void
  /** Shown only when provided (2+ cards selected). */
  onGroup?: () => void
  onDelete?: () => void
  /** "Open in browser pane" only makes sense for captured pages. */
  showOpen?: boolean
  showNote?: boolean
}

const capitalise = (s: string): string => s[0].toUpperCase() + s.slice(1)

function ToolButton(p: {
  icon: IconName
  label: string
  onClick?: () => void
  danger?: boolean
}): ReactElement {
  return (
    <Tip label={p.label}>
      <button
        type="button"
        className={cn('wa-tb', p.danger && 'wa-tb--danger')}
        aria-label={p.label}
        onClick={p.onClick}
      >
        <Icon name={p.icon} size={16} />
      </button>
    </Tip>
  )
}

/**
 * DESIGN.md SelectionToolbar, fixed order: six colours | tag, note, open, zoom (group) | delete.
 * The consumer places it 12px above the selection.
 */
export function SelectionToolbarView(p: SelectionToolbarViewProps): ReactElement {
  return (
    <div className="wa wa-toolbar" role="toolbar" aria-label="Selection">
      {CATS.map((c) => {
        const on = p.color === c
        const label = `Colour ${c}`
        return (
          <Tip key={c} label={on ? `${capitalise(label)} (click to clear)` : capitalise(label)}>
            <button
              type="button"
              className={cn('wa-sw', on && 'wa-sw--on')}
              style={catVars(c)}
              aria-label={label}
              aria-pressed={on}
              onClick={() => p.onColor?.(on ? null : c)}
            />
          </Tip>
        )
      })}
      <span className="wa-sep" />
      <ToolButton icon="tag" label="Tag" onClick={p.onTag} />
      {p.showNote !== false ? <ToolButton icon="note" label="Note" onClick={p.onNote} /> : null}
      {p.showOpen !== false ? (
        <ToolButton icon="globe" label="Open in browser pane" onClick={p.onOpen} />
      ) : null}
      <ToolButton icon="zoom" label="Zoom to selection" onClick={p.onZoom} />
      {p.onGroup ? <ToolButton icon="group" label="Group" onClick={p.onGroup} /> : null}
      <span className="wa-sep" />
      <ToolButton icon="trash" label="Delete" onClick={p.onDelete} danger />
    </div>
  )
}
