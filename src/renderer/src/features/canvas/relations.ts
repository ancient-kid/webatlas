import type { Edge, Relation } from '@shared/types'

const LABELS: Record<Exclude<Relation, 'custom'>, string> = {
  'opened-from': 'opened from',
  related: 'related',
  supports: 'supports',
  contradicts: 'contradicts',
  answers: 'answers',
  'source-of': 'source of'
}

/** The sentence-case verb shown on a link (DESIGN.md: relationship labels are verbs). */
export function relationLabel(edge: Pick<Edge, 'relation' | 'label'>): string {
  if (edge.label) return edge.label
  return edge.relation === 'custom' ? 'related' : LABELS[edge.relation]
}

/** Which arrowhead/colour a link uses: its category colour, AI teal, or neutral. */
export function edgeTone(edge: Pick<Edge, 'color' | 'origin'>): string {
  if (edge.color) return `cat-${edge.color}`
  return edge.origin === 'ai' ? 'brand' : 'neutral'
}

/** The CSS colour for a tone from edgeTone. */
export function toneColor(tone: string): string {
  if (tone === 'neutral') return 'var(--line-strong)'
  if (tone === 'ghost') return 'var(--ghost-line)'
  return `var(--${tone})`
}

/** Relations the student can choose (opened from is set by capture, not by hand). */
export const EDITABLE_RELATIONS: Exclude<Relation, 'opened-from' | 'custom'>[] = [
  'related',
  'supports',
  'contradicts',
  'answers',
  'source-of'
]
