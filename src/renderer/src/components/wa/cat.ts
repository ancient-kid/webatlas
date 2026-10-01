import type { CSSProperties } from 'react'
import type { Cat } from '@shared/types'

/** The `--gc` (colour) and `--gs` (soft fill) variables wa.css reads for a category. */
export function catVars(color: Cat): CSSProperties {
  return { '--gc': `var(--cat-${color})`, '--gs': `var(--cat-${color}-soft)` } as CSSProperties
}

/** A tag as components receive it: plain text, or a label with a category colour. */
export type TagLike = string | { label: string; color?: Cat }

export const tagLabel = (t: TagLike): string => (typeof t === 'string' ? t : t.label)
export const tagColor = (t: TagLike): Cat | undefined =>
  typeof t === 'string' ? undefined : t.color
