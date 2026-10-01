import type { CSSProperties, ReactElement, ReactNode } from 'react'
import type { Cat } from '@shared/types'
import { cn } from '@renderer/lib/utils'
import { Icon } from './Icon'
import { TagChip } from './TagChip'
import { tagColor, tagLabel, type TagLike } from './cat'

export interface NoteCardViewProps {
  text: string
  tags?: TagLike[]
  selected?: boolean
  color?: Cat
  width?: number
  /** Replaces the text while editing (the consumer passes a textarea). */
  body?: ReactNode
  className?: string
}

/** DESIGN.md NoteCard: a web card minus the thumbnail, so the two read as one family. */
export function NoteCardView(p: NoteCardViewProps): ReactElement {
  const style = {
    ...(p.width ? { width: p.width } : null),
    ...(p.color ? { border: `2px solid var(--cat-${p.color})` } : null)
  } as CSSProperties
  return (
    <article
      className={cn('wa wa-note', p.selected && 'wa-note--selected', p.className)}
      style={style}
    >
      <span className="wa-badge" style={{ marginBottom: 8, display: 'flex' }}>
        <Icon name="note" size={14} />
        Note
      </span>
      {p.body ??
        (p.text ? (
          <p className="wa-note-text">{p.text}</p>
        ) : (
          <p className="wa-note-text wa-note__placeholder">Double-click to write</p>
        ))}
      {p.tags?.length ? (
        <div className="wa-tags" style={{ marginTop: 8 }}>
          {p.tags.map((g) => (
            <TagChip key={tagLabel(g)} label={tagLabel(g)} color={tagColor(g)} />
          ))}
        </div>
      ) : null}
    </article>
  )
}
