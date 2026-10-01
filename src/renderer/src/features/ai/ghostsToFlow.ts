// Pending AI suggestions → React Flow items, drawn dashed over the board. They are
// derived on every render and never stored: their ids carry the `ghost-` prefix so the
// canvas sync, selection and commit code can tell them apart from real items.
import type { Edge as RFEdge, Node as RFNode } from '@xyflow/react'
import { absolutePosition, nodeSize } from '@shared/export/geometry'
import type { Board, Edge, Ghost, Size } from '@shared/types'
import { MIN_GHOST_CONFIDENCE } from '@renderer/components/wa/GhostSuggestion'
import { ghostFits } from '@renderer/store/actions'

export const GHOST_PREFIX = 'ghost-'
/** Space around the members of a suggested group (the top leaves room for the label). */
export const GHOST_PAD = { side: 24, top: 48, bottom: 24 }

export type GhostGroupFlowNode = RFNode<{ id: string }, 'ghostGroup'>
export type GhostFlowEdge = RFEdge<{ id: string; ghost: true }, 'labeled'>

export const isGhostId = (id: string): boolean => id.startsWith(GHOST_PREFIX)
export const ghostFlowId = (ghostId: string): string => GHOST_PREFIX + ghostId

const KIND_ORDER: Record<Ghost['kind'], number> = { group: 0, edge: 1, tag: 2 }

/**
 * The suggestions worth showing: still fitting the board (cards not deleted, not already
 * done, see ghostFits) and at or above the minimum confidence. Groups first, then links
 * and tags, each by confidence.
 */
export function visibleGhosts(board: Board): Ghost[] {
  return Object.values(board.ghosts)
    .filter((g) => g.confidence >= MIN_GHOST_CONFIDENCE && ghostFits(board, g))
    .sort(
      (a, b) =>
        KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
        b.confidence - a.confidence ||
        (a.id < b.id ? -1 : 1)
    )
}

/** The link a suggestion would create, if it is a link suggestion. */
export function ghostEdge(ghost: Ghost): Edge | null {
  return ghost.command.type === 'connect' ? ghost.command.payload.edge : null
}

/** Card ids a suggested group would contain. */
export function ghostMembers(ghost: Ghost): string[] {
  return ghost.command.type === 'createGroup' ? ghost.command.payload.memberIds : []
}

/** Pending tag suggestions for one card that it doesn't have yet (for the dashed chips). */
export function suggestedTagsFor(board: Board, nodeId: string): string[] {
  const node = board.nodes[nodeId]
  if (!node) return []
  const out: string[] = []
  for (const g of Object.values(board.ghosts)) {
    if (g.command.type !== 'addTags' || g.confidence < MIN_GHOST_CONFIDENCE) continue
    const { nodeIds, tag } = g.command.payload
    if (nodeIds.includes(nodeId) && !node.tags.includes(tag) && !out.includes(tag)) out.push(tag)
  }
  return out.sort()
}

/**
 * Dashed frames for suggested groups (around where their cards are now) and dashed
 * arrows for suggested links. `measured` gives a card's rendered size when known.
 */
export function ghostsToFlow(
  board: Board,
  measured: (id: string) => Size | undefined = () => undefined,
  hoveredId: string | null = null
): { nodes: GhostGroupFlowNode[]; edges: GhostFlowEdge[] } {
  const nodes: GhostGroupFlowNode[] = []
  const edges: GhostFlowEdge[] = []
  for (const g of visibleGhosts(board)) {
    const hot = g.id === hoveredId ? 'wa-ghost-hot' : undefined
    if (g.command.type === 'createGroup') {
      const members = g.command.payload.memberIds.map((id) => board.nodes[id]).filter(Boolean)
      if (!members.length) continue
      const boxes = members.map((n) => {
        const at = absolutePosition(n, board)
        const size = measured(n.id) ?? nodeSize(n)
        return { x: at.x, y: at.y, x2: at.x + size.w, y2: at.y + size.h }
      })
      const minX = Math.min(...boxes.map((b) => b.x))
      const minY = Math.min(...boxes.map((b) => b.y))
      const maxX = Math.max(...boxes.map((b) => b.x2))
      const maxY = Math.max(...boxes.map((b) => b.y2))
      nodes.push({
        id: ghostFlowId(g.id),
        type: 'ghostGroup',
        data: { id: g.id },
        position: { x: minX - GHOST_PAD.side, y: minY - GHOST_PAD.top },
        width: maxX - minX + GHOST_PAD.side * 2,
        height: maxY - minY + GHOST_PAD.top + GHOST_PAD.bottom,
        zIndex: -1,
        selectable: false,
        draggable: false,
        connectable: false,
        focusable: false,
        className: hot
      })
    } else if (g.command.type === 'connect') {
      const e = g.command.payload.edge
      edges.push({
        id: ghostFlowId(g.id),
        type: 'labeled',
        source: e.source,
        target: e.target,
        data: { id: g.id, ghost: true },
        selectable: false,
        focusable: false,
        className: hot
      })
    }
  }
  // Larger frames first, so a smaller suggested group drawn over a larger one stays visible.
  const area = (n: GhostGroupFlowNode): number => (n.width ?? 0) * (n.height ?? 0)
  nodes.sort((a, b) => area(b) - area(a))
  return { nodes, edges }
}
