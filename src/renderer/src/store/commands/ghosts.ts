import type { Board, Ghost } from '@shared/types'
import { copy, NOOP, unique, type DefsFor } from './def'

function existing(board: Board, ids: string[]): Ghost[] {
  return unique(ids)
    .map((id) => board.ghosts[id])
    .filter(Boolean)
}

function restorable(board: Board, ghosts: Ghost[]): Ghost[] {
  const seen = new Set<string>()
  return ghosts.filter((g) => {
    if (seen.has(g.id) || board.ghosts[g.id]) return false
    seen.add(g.id)
    return true
  })
}

export const ghostCommands: DefsFor<'removeGhosts' | 'restoreGhosts'> = {
  removeGhosts: {
    apply(draft, { ids }) {
      for (const g of existing(draft, ids)) delete draft.ghosts[g.id]
    },
    invert(before, { ids }) {
      const ghosts = existing(before, ids)
      return ghosts.length ? { type: 'restoreGhosts', payload: { ghosts } } : NOOP
    }
  },

  restoreGhosts: {
    apply(draft, { ghosts }) {
      for (const g of restorable(draft, ghosts)) draft.ghosts[g.id] = copy(g)
    },
    invert(before, { ghosts }) {
      const ids = restorable(before, ghosts).map((g) => g.id)
      return ids.length ? { type: 'removeGhosts', payload: { ids } } : NOOP
    }
  }
}
