// DESIGN.md NodeCard: a captured web page, video or PDF. Presentational only; the
// React Flow node (T09) feeds it from a CanvasNode and draws real connection handles.
import { useState, type CSSProperties, type ReactElement } from 'react'
import type { Cat, Highlight } from '@shared/types'
import { cn } from '@renderer/lib/utils'
import { Tip } from '../ui/tooltip'
import { Icon, type IconName } from './Icon'
import { TagChip } from './TagChip'
import { tagColor, tagLabel, type TagLike } from './cat'
import { displayUrl } from './format'

export type ResourceKind = 'webpage' | 'video' | 'pdf'

const TYPES: Record<ResourceKind, { icon: IconName; label: string; color: string }> = {
  webpage: { icon: 'globe', label: 'Web page', color: 'var(--cat-teal)' },
  video: { icon: 'play', label: 'Video', color: 'var(--cat-plum)' },
  pdf: { icon: 'file', label: 'PDF', color: 'var(--cat-blue)' }
}

/** Cards show at most this many tags, then "+N". */
export const MAX_CARD_TAGS = 3

export interface NodeCardViewProps {
  kind: ResourceKind
  title: string
  url?: string
  /** Image URL (usually wa-thumb://…); a skeleton shows when absent or broken. */
  thumbnail?: string
  faviconUrl?: string
  summary?: string
  /** All highlights; only the newest is shown (the rest live in the side panel). */
  highlights?: Pick<Highlight, 'quote' | 'createdAt'>[]
  tags?: TagLike[]
  /** Pending AI tag suggestions, shown as dashed chips. */
  suggestedTags?: string[]
  /** Title of the card this one was opened from. */
  openedFrom?: string
  pages?: number
  /** The student wrote a note about this card (shown in the side panel, flagged here). */
  hasNote?: boolean
  color?: Cat
  selected?: boolean
  /** Draw the four decorative handles when selected (React Flow draws real ones). */
  showHandles?: boolean
  width?: number
  className?: string
}

function newest<T extends { createdAt: number }>(items: T[] = []): T | undefined {
  return items.reduce<T | undefined>(
    (a, b) => (!a || b.createdAt >= a.createdAt ? b : a),
    undefined
  )
}

function Favicon({ src, host }: { src?: string; host: string }): ReactElement {
  const [failed, setFailed] = useState(false)
  const letter = (host[0] ?? 'w').toUpperCase()
  return (
    <span className="wa-fav" aria-hidden="true">
      {src && !failed ? <img src={src} alt="" onError={() => setFailed(true)} /> : letter}
    </span>
  )
}

function Handles(): ReactElement {
  const at: CSSProperties[] = [
    { top: '50%', left: -5, marginTop: -5 },
    { top: '50%', right: -5, marginTop: -5 },
    { top: -5, left: '50%', marginLeft: -5 },
    { bottom: -5, left: '50%', marginLeft: -5 }
  ]
  return (
    <>
      {at.map((style, i) => (
        <span key={i} className="wa-handle" style={style} />
      ))}
    </>
  )
}

export function NodeCardView(p: NodeCardViewProps): ReactElement {
  const t = TYPES[p.kind]
  const host = displayUrl(p.url)
  const [thumbFailed, setThumbFailed] = useState(false)
  const quote = newest(p.highlights)
  const tags = p.tags ?? []
  const extra = tags.length - MAX_CARD_TAGS
  const style = {
    '--badge': t.color,
    ...(p.width ? { width: p.width } : null),
    ...(p.color ? { border: `2px solid var(--cat-${p.color})` } : null)
  } as CSSProperties

  return (
    <article
      className={cn('wa wa-card', p.selected && 'wa-card--selected', p.className)}
      style={style}
      aria-label={p.title}
    >
      <div className="wa-card__thumb">
        {p.thumbnail && !thumbFailed ? (
          <img src={p.thumbnail} alt="" onError={() => setThumbFailed(true)} />
        ) : (
          <div className="wa-skel" aria-hidden="true">
            <i />
            <i style={{ width: '80%' }} />
            <i style={{ width: '55%' }} />
          </div>
        )}
        {p.kind === 'video' ? (
          <span className="wa-card__play">
            <Icon name="play" size={16} />
          </span>
        ) : null}
        {p.kind === 'pdf' && p.pages ? (
          <span className="wa-tag wa-card__pages">{p.pages} pages</span>
        ) : null}
      </div>
      <div className="wa-card__body">
        <div className="wa-card__row">
          <span className="wa-badge">
            <Icon name={t.icon} size={14} />
            {t.label}
          </span>
          {p.hasNote ? (
            <Tip label="Has a note">
              <span className="wa-card__noteflag" role="img" aria-label="Has a note" tabIndex={-1}>
                <Icon name="note" size={14} />
              </span>
            </Tip>
          ) : null}
        </div>
        <h3 className="wa-card__title">{p.title}</h3>
        {host ? (
          <div className="wa-url">
            <Favicon src={p.faviconUrl} host={host} />
            {host}
          </div>
        ) : null}
        {p.summary ? <p className="wa-card__summary">{p.summary}</p> : null}
        {quote ? <blockquote className="wa-quote">{quote.quote}</blockquote> : null}
        {tags.length || p.suggestedTags?.length ? (
          <div className="wa-tags">
            {tags.slice(0, MAX_CARD_TAGS).map((g) => (
              <TagChip key={tagLabel(g)} label={tagLabel(g)} color={tagColor(g)} />
            ))}
            {extra > 0 ? <TagChip label={`+${extra}`} /> : null}
            {p.suggestedTags?.map((t) => (
              <TagChip key={`suggested:${t}`} label={t} ghost />
            ))}
          </div>
        ) : null}
        {p.openedFrom ? (
          <div className="wa-prov">
            <Icon name="arrow" size={12} />
            opened from {p.openedFrom}
          </div>
        ) : null}
      </div>
      {p.selected && p.showHandles !== false ? <Handles /> : null}
    </article>
  )
}
