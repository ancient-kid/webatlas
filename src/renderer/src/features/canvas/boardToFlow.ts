// Board → React Flow arrays. React Flow keeps its own node array (it holds measured
// sizes and transient drag positions), so each rebuild carries `measured`, `selected`
// and `dragging` over from the previous array by id. Groups come first: React Flow
// needs a parent before its children.
import type { Edge as RFEdge, Node as RFNode } from '@xyflow/react'
import type { Board, CanvasNode, NodeKind } from '@shared/types'

export type CanvasNodeType = 'question' | 'card' | 'note' | 'frame'
export type FlowNode = RFNode<{ id: string }, CanvasNodeType>
export type FlowEdge = RFEdge<{ id: string }, 'labeled'>

export function nodeType(kind: NodeKind): CanvasNodeType {
  if (kind === 'question') return 'question'
  if (kind === 'note') return 'note'
  return 'card'
}

/** Builds the React Flow nodes for a board. `selected` seeds selection on first build. */
export function boardToFlow(
  board: Board,
  previous: FlowNode[] = [],
  selected: string[] = []
): FlowNode[] {
  const prev = new Map(previous.map((n) => [n.id, n]))
  const initial = new Set(selected)
  const carry = (id: string): Partial<FlowNode> => {
    const p = prev.get(id)
    if (!p) return { selected: initial.has(id) }
    return { measured: p.measured, selected: p.selected, dragging: p.dragging }
  }

  const groups: FlowNode[] = Object.values(board.groups).map((g) => ({
    id: g.id,
    type: 'frame',
    data: { id: g.id },
    position: { x: g.position.x, y: g.position.y },
    width: g.size.w,
    height: g.size.h,
    zIndex: 0,
    ...carry(g.id)
  }))

  const card = (n: CanvasNode): FlowNode => {
    const node: FlowNode = {
      id: n.id,
      type: nodeType(n.kind),
      data: { id: n.id },
      position: { x: n.position.x, y: n.position.y },
      zIndex: 1,
      ...carry(n.id)
    }
    if (n.size) {
      node.width = n.size.w
      node.height = n.size.h
    }
    if (n.parentGroupId && board.groups[n.parentGroupId]) node.parentId = n.parentGroupId
    return node
  }

  // Cards inside groups after all groups; the question card last so it stays on top.
  const cards = Object.values(board.nodes)
  const ordered = [
    ...cards.filter((n) => n.kind !== 'question'),
    ...cards.filter((n) => n.kind === 'question')
  ]
  return [...groups, ...ordered.map(card)]
}

/** Builds the React Flow edges, carrying `selected` over by id. */
export function boardToEdges(board: Board, previous: FlowEdge[] = []): FlowEdge[] {
  const prev = new Map(previous.map((e) => [e.id, e]))
  return Object.values(board.edges).map((e) => ({
    id: e.id,
    type: 'labeled',
    source: e.source,
    target: e.target,
    data: { id: e.id },
    selected: prev.get(e.id)?.selected ?? false
  }))
}
