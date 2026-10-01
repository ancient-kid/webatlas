import type { Board, Command, Edge } from '@shared/types'
import { assignPatch, batchOf, copy, NOOP, prevValues, unique, type DefsFor } from './def'

/** An edge can be added if it is new, joins two different existing cards and isn't a duplicate. */
function canConnect(board: Board, edge: Edge): boolean {
  if (board.edges[edge.id] || edge.source === edge.target) return false
  if (!board.nodes[edge.source] || !board.nodes[edge.target]) return false
  return !Object.values(board.edges).some(
    (e) =>
      e.source === edge.source &&
      e.target === edge.target &&
      e.relation === edge.relation &&
      (edge.relation !== 'custom' || e.label === edge.label)
  )
}

function existing(board: Board, ids: string[]): Edge[] {
  return unique(ids)
    .map((id) => board.edges[id])
    .filter(Boolean)
}

export const edgeCommands: DefsFor<'connect' | 'disconnect' | 'updateEdge'> = {
  connect: {
    apply(draft, { edge }) {
      if (canConnect(draft, edge)) draft.edges[edge.id] = copy(edge)
    },
    invert(before, { edge }) {
      return canConnect(before, edge) ? { type: 'disconnect', payload: { ids: [edge.id] } } : NOOP
    }
  },

  disconnect: {
    apply(draft, { ids }) {
      for (const e of existing(draft, ids)) delete draft.edges[e.id]
    },
    invert(before, { ids }) {
      return batchOf(
        existing(before, ids).map((edge): Command => ({ type: 'connect', payload: { edge } }))
      )
    }
  },

  updateEdge: {
    apply(draft, { id, patch }) {
      const edge = draft.edges[id]
      if (edge) assignPatch(edge, patch)
    },
    invert(before, { id, patch }) {
      const edge = before.edges[id]
      if (!edge) return NOOP
      return { type: 'updateEdge', payload: { id, patch: prevValues(edge, patch) } }
    }
  }
}
