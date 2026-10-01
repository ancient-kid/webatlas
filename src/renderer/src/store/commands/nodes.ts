// Commands on cards (and the item commands shared by cards and groups: move, resize,
// comments).
import { normalizeTag } from '@shared/tags'
import type { Board, CanvasNode, Command, Group, NodePatch, Size, XY } from '@shared/types'
import { assignPatch, batchOf, copy, NOOP, prevValues, samePair, unique, type DefsFor } from './def'
import { safeNodeRefs } from './refs'

/** Cards from the payload that can be inserted (new id, not a second question, known group). */
function insertable(board: Board, nodes: CanvasNode[]): CanvasNode[] {
  const seen = new Set<string>()
  return nodes.filter((n) => {
    if (seen.has(n.id) || board.nodes[n.id] || n.kind === 'question') return false
    if (n.parentGroupId && !board.groups[n.parentGroupId]) return false
    seen.add(n.id)
    return true
  })
}

/** Ids that exist and may be removed. The research-question card never can be. */
function removable(board: Board, ids: string[]): string[] {
  return unique(ids).filter((id) => board.nodes[id] && board.nodes[id].kind !== 'question')
}

/** `kind` never changes and the parent changes only through setParent. */
function cleanNodePatch(patch: NodePatch): NodePatch {
  const rest = { ...patch }
  delete rest.kind
  delete rest.parentGroupId
  return rest
}

function itemOf(board: Board, id: string): CanvasNode | Group | undefined {
  return board.nodes[id] ?? board.groups[id]
}

function validSize(size: Size | null): boolean {
  return size === null || (size.w > 0 && size.h > 0)
}

function nodesWithTag(board: Board, nodeIds: string[], tag: string, has: boolean): string[] {
  return unique(nodeIds).filter(
    (id) => board.nodes[id] && board.nodes[id].tags.includes(tag) === has
  )
}

export const nodeCommands: DefsFor<
  | 'addNodes'
  | 'removeNodes'
  | 'updateNode'
  | 'moveItems'
  | 'resizeItem'
  | 'addTags'
  | 'removeTag'
  | 'addHighlight'
  | 'removeHighlight'
  | 'addComment'
  | 'removeComment'
> = {
  addNodes: {
    apply(draft, { nodes }) {
      for (const n of insertable(draft, nodes)) draft.nodes[n.id] = copy(n)
    },
    invert(before, { nodes }) {
      const ids = insertable(before, nodes).map((n) => n.id)
      return ids.length ? { type: 'removeNodes', payload: { ids } } : NOOP
    }
  },

  // Removing cards also removes their edges and any ghost that refers to them.
  removeNodes: {
    apply(draft, { ids }) {
      const gone = new Set(removable(draft, ids))
      if (!gone.size) return
      for (const id of gone) delete draft.nodes[id]
      for (const e of Object.values(draft.edges)) {
        if (gone.has(e.source) || gone.has(e.target)) delete draft.edges[e.id]
      }
      for (const g of Object.values(draft.ghosts)) {
        if (safeNodeRefs(g.command).some((id) => gone.has(id))) delete draft.ghosts[g.id]
      }
    },
    invert(before, { ids }) {
      const gone = new Set(removable(before, ids))
      if (!gone.size) return NOOP
      const edges = Object.values(before.edges).filter(
        (e) => gone.has(e.source) || gone.has(e.target)
      )
      const ghosts = Object.values(before.ghosts).filter((g) =>
        safeNodeRefs(g.command).some((id) => gone.has(id))
      )
      const restore: Command[] = [
        { type: 'addNodes', payload: { nodes: [...gone].map((id) => before.nodes[id]) } },
        ...edges.map((edge): Command => ({ type: 'connect', payload: { edge } }))
      ]
      if (ghosts.length) restore.push({ type: 'restoreGhosts', payload: { ghosts } })
      return batchOf(restore)
    }
  },

  updateNode: {
    apply(draft, { id, patch }) {
      const node = draft.nodes[id]
      if (node) assignPatch(node, cleanNodePatch(patch))
    },
    invert(before, { id, patch }) {
      const node = before.nodes[id]
      if (!node) return NOOP
      return { type: 'updateNode', payload: { id, patch: prevValues(node, cleanNodePatch(patch)) } }
    }
  },

  // Works for cards and groups. Positions are in each item's own coordinate space.
  moveItems: {
    apply(draft, { moves }) {
      for (const { id, to } of moves) {
        const item = itemOf(draft, id)
        if (item && !samePair(item.position, to)) item.position = { x: to.x, y: to.y }
      }
    },
    invert(before, { moves }) {
      const back = moves
        .filter((m) => itemOf(before, m.id))
        .map((m) => ({ id: m.id, to: itemOf(before, m.id)!.position as XY }))
        .reverse()
      return back.length ? { type: 'moveItems', payload: { moves: back } } : NOOP
    }
  },

  // `size: null` returns a card to its default size. Groups always keep a size.
  resizeItem: {
    apply(draft, { id, size }) {
      if (!validSize(size)) return
      const node = draft.nodes[id]
      if (node) {
        if (size) {
          if (!samePair(node.size, size)) node.size = { w: size.w, h: size.h }
        } else if (node.size) delete node.size

        return
      }
      const group = draft.groups[id]
      if (group && size && !samePair(group.size, size)) group.size = { w: size.w, h: size.h }
    },
    invert(before, { id, size }) {
      if (!validSize(size)) return NOOP
      const node = before.nodes[id]
      if (node) return { type: 'resizeItem', payload: { id, size: node.size ?? null } }
      const group = before.groups[id]
      if (group && size) return { type: 'resizeItem', payload: { id, size: group.size } }
      return NOOP
    }
  },

  addTags: {
    apply(draft, { nodeIds, tag }) {
      const t = normalizeTag(tag)
      if (!t) return
      for (const id of nodesWithTag(draft, nodeIds, t, false)) draft.nodes[id].tags.push(t)
    },
    invert(before, { nodeIds, tag }) {
      const t = normalizeTag(tag)
      const ids = t ? nodesWithTag(before, nodeIds, t, false) : []
      return ids.length ? { type: 'removeTag', payload: { nodeIds: ids, tag: t } } : NOOP
    }
  },

  // The inverse restores each tag list exactly, so tag order survives undo.
  removeTag: {
    apply(draft, { nodeIds, tag }) {
      const t = normalizeTag(tag)
      for (const id of nodesWithTag(draft, nodeIds, t, true)) {
        draft.nodes[id].tags = draft.nodes[id].tags.filter((x) => x !== t)
      }
    },
    invert(before, { nodeIds, tag }) {
      const t = normalizeTag(tag)
      return batchOf(
        nodesWithTag(before, nodeIds, t, true).map((id): Command => ({
          type: 'updateNode',
          payload: { id, patch: { tags: before.nodes[id].tags } }
        }))
      )
    }
  },

  addHighlight: {
    apply(draft, { nodeId, highlight }) {
      const node = draft.nodes[nodeId]
      if (node && !node.highlights.some((h) => h.id === highlight.id)) {
        node.highlights.push(copy(highlight))
      }
    },
    invert(before, { nodeId, highlight }) {
      const node = before.nodes[nodeId]
      if (!node || node.highlights.some((h) => h.id === highlight.id)) return NOOP
      return { type: 'removeHighlight', payload: { nodeId, highlightId: highlight.id } }
    }
  },

  removeHighlight: {
    apply(draft, { nodeId, highlightId }) {
      const node = draft.nodes[nodeId]
      if (node?.highlights.some((h) => h.id === highlightId)) {
        node.highlights = node.highlights.filter((h) => h.id !== highlightId)
      }
    },
    invert(before, { nodeId, highlightId }) {
      const node = before.nodes[nodeId]
      if (!node || !node.highlights.some((h) => h.id === highlightId)) return NOOP
      return { type: 'updateNode', payload: { id: nodeId, patch: { highlights: node.highlights } } }
    }
  },

  // Comments can be on a card or a group.
  addComment: {
    apply(draft, { targetId, comment }) {
      const item = itemOf(draft, targetId)
      if (item && !item.comments.some((c) => c.id === comment.id)) item.comments.push(copy(comment))
    },
    invert(before, { targetId, comment }) {
      const item = itemOf(before, targetId)
      if (!item || item.comments.some((c) => c.id === comment.id)) return NOOP
      return { type: 'removeComment', payload: { targetId, commentId: comment.id } }
    }
  },

  removeComment: {
    apply(draft, { targetId, commentId }) {
      const item = itemOf(draft, targetId)
      if (item?.comments.some((c) => c.id === commentId)) {
        item.comments = item.comments.filter((c) => c.id !== commentId)
      }
    },
    invert(before, { targetId, commentId }) {
      const item = itemOf(before, targetId)
      if (!item || !item.comments.some((c) => c.id === commentId)) return NOOP
      const patch = { comments: item.comments }
      return before.nodes[targetId]
        ? { type: 'updateNode', payload: { id: targetId, patch } }
        : { type: 'updateGroup', payload: { id: targetId, patch } }
    }
  }
}
