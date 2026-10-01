import type { ReactElement } from 'react'
import { cn } from '@renderer/lib/utils'
import { Icon, type IconName } from './Icon'

export type PaletteResultType = 'web' | 'video' | 'pdf' | 'note' | 'tag' | 'group'

export interface PaletteResult {
  type: PaletteResultType
  title: string
  /** What matched, e.g. "Highlight · “…pilot in Rotterdam…”". */
  match: string
}

const ICON: Record<PaletteResultType, IconName> = {
  web: 'globe',
  video: 'play',
  pdf: 'file',
  note: 'note',
  tag: 'tag',
  group: 'focus'
}

const PALETTE_FOOTER = [
  '↑↓ to move',
  'Enter to jump to node',
  'Searches titles, URLs, notes, highlights, tags'
]

export interface CommandPaletteViewProps {
  query: string
  results: PaletteResult[]
  /** Highlighted row. */
  active?: number
}

/** DESIGN.md CommandPalette, visual shell only. T14 makes it interactive. */
export function CommandPaletteView({
  query,
  results,
  active = 0
}: CommandPaletteViewProps): ReactElement {
  return (
    <div className="wa wa-pal" role="dialog" aria-label="Search workspace">
      <div className="wa-pal__in">
        <Icon name="search" size={18} />
        <span className="q">{query}</span>
        <span className="wa-kbd">Esc</span>
      </div>
      {results.slice(0, 8).map((r, i) => (
        <div key={i} className={cn('wa-pal__row', i === active && 'wa-pal__row--on')}>
          <Icon name={ICON[r.type]} size={16} />
          <div className="wa-pal__main">
            <div className="wa-pal__t">{r.title}</div>
            <div className="wa-pal__m">{r.match}</div>
          </div>
        </div>
      ))}
      <div className="wa-pal__foot">
        {PALETTE_FOOTER.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </div>
  )
}
