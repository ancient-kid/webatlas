import type { ReactElement, ReactNode } from 'react'
import { formatOpened } from '@renderer/lib/time'

export interface WorkspaceCardProps {
  name: string
  question?: string
  nodes: number
  groups: number
  /** Last change (ms); shown as "Opened 2h ago". */
  updatedAt: number
  now?: number
  /** A real thumbnail replaces the decorative mini map. */
  coverThumb?: string
  onOpen?: () => void
  /** Card menu (duplicate, export, delete), drawn above the open target. */
  menu?: ReactNode
}

const DOTS: [number, number, string][] = [
  [30, 60, 'teal'],
  [80, 30, 'rose'],
  [120, 66, 'teal'],
  [170, 36, 'blue'],
  [215, 62, 'plum'],
  [250, 28, 'moss']
]

const count = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

/** DESIGN.md WorkspaceCard: one workspace on the home screen. The name is the only serif. */
export function WorkspaceCard(p: WorkspaceCardProps): ReactElement {
  return (
    <article className="wa wa-ws" aria-label={p.name}>
      <div className="wa-ws__map" aria-hidden="true">
        {p.coverThumb ? (
          <img className="wa-ws__cover" src={p.coverThumb} alt="" />
        ) : (
          <svg width="100%" height={96} viewBox="0 0 280 96">
            <path
              d="M30 60L80 30L120 66L170 36L215 62L250 28"
              fill="none"
              stroke="var(--line-strong)"
              strokeWidth={1.5}
            />
            {DOTS.map(([cx, cy, c], i) => (
              <circle key={i} cx={cx} cy={cy} r={7} fill={`var(--cat-${c})`} />
            ))}
          </svg>
        )}
      </div>
      <div className="wa-ws__body">
        <h3 className="wa-ws__name">{p.name}</h3>
        {p.question ? <p className="wa-ws__q">{p.question}</p> : null}
        <div className="wa-ws__meta">
          <span>
            {count(p.nodes, 'node')} · {count(p.groups, 'group')}
          </span>
          <span>{formatOpened(p.updatedAt, p.now)}</span>
        </div>
      </div>
      <button
        type="button"
        className="wa-ws__open"
        aria-label={`Open ${p.name}`}
        onClick={p.onOpen}
      />
      {p.menu ? <div className="wa-ws__menu">{p.menu}</div> : null}
    </article>
  )
}
