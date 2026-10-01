import type { ReactElement, ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'
import { Icon } from './Icon'

export interface QuestionCardViewProps {
  question: string
  /** Optional one-line summary, e.g. "Due in 2 days · 24 sources · 5 groups". */
  meta?: string
  selected?: boolean
  /** Replaces the question while editing. */
  body?: ReactNode
}

/** DESIGN.md QuestionCard: the one brand-filled card, anchoring the workspace. */
export function QuestionCardView(p: QuestionCardViewProps): ReactElement {
  return (
    <article className={cn('wa wa-q', p.selected && 'wa-q--selected')}>
      <span className="wa-badge">
        <Icon name="compass" size={14} />
        Research question
      </span>
      {p.body ??
        (p.question ? (
          <p className="wa-q__text">{p.question}</p>
        ) : (
          <p className="wa-q__text wa-q__text--empty">Double-click to add your research question</p>
        ))}
      {p.meta ? <p className="wa-q__meta">{p.meta}</p> : null}
    </article>
  )
}
