// "Opened from": which card the next capture should link back to. Following a link keeps
// the current parent; landing on a page that is already a card makes that card the
// parent; typing an address starts afresh; a capture becomes the new parent.
import { normalizeUrl } from '@shared/kind'
import type { Board } from '@shared/types'

export interface Provenance {
  parentId: string | null
}

export type ProvenanceEvent =
  | { type: 'typed' }
  | { type: 'navigated'; url: string }
  | { type: 'captured'; id: string }
  | { type: 'reset' }

/** The card whose URL matches, if any (pages, videos and PDFs only). */
export function nodeForUrl(board: Board, url: string): string | null {
  if (!url) return null
  const key = normalizeUrl(url)
  const match = Object.values(board.nodes).find(
    (n) => n.url && n.kind !== 'note' && n.kind !== 'question' && normalizeUrl(n.url) === key
  )
  return match?.id ?? null
}

export function nextProvenance(
  state: Provenance,
  event: ProvenanceEvent,
  board: Board
): Provenance {
  switch (event.type) {
    case 'typed':
    case 'reset':
      return { parentId: null }
    case 'captured':
      return { parentId: event.id }
    case 'navigated': {
      const existing = nodeForUrl(board, event.url)
      if (existing) return { parentId: existing }
      // Keep the parent only while it is still on the board.
      return { parentId: state.parentId && board.nodes[state.parentId] ? state.parentId : null }
    }
  }
}
