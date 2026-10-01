// Coordinate helpers shared by the command layer and the exporters.
// A card inside a group stores its position relative to the group (the React Flow
// parent/child convention); everything else is absolute.
import type { Board, CanvasNode, NodeKind, Size, XY } from '../types'

/** The canvas snap grid (DESIGN.md `space-6`). */
export const GRID = 32

/** Default rendered card widths (DESIGN.md Appendix A) and a typical card height. */
export const CARD_WIDTH: Record<NodeKind, number> = {
  webpage: 260,
  video: 260,
  pdf: 260,
  note: 220,
  question: 320
}
export const CARD_HEIGHT = 240

/** Space between a group's edge and its cards; the top leaves room for the label. */
export const GROUP_PAD = { side: 32, top: 64 } as const

/** Absolute canvas position of a card or group. */
export function absolutePosition(
  item: { position: XY; parentGroupId?: string },
  board: Pick<Board, 'groups'>
): XY {
  const group = item.parentGroupId ? board.groups[item.parentGroupId] : undefined
  if (!group) return { x: item.position.x, y: item.position.y }
  return { x: group.position.x + item.position.x, y: group.position.y + item.position.y }
}

/** Converts an absolute position into the coordinate space of `groupId` (or absolute for null). */
export function toGroupSpace(
  absolute: XY,
  groupId: string | null,
  board: Pick<Board, 'groups'>
): XY {
  const group = groupId ? board.groups[groupId] : undefined
  if (!group) return { x: absolute.x, y: absolute.y }
  return { x: absolute.x - group.position.x, y: absolute.y - group.position.y }
}

/** A card's size: the user's resize if any, otherwise the default for its kind. */
export function nodeSize(node: Pick<CanvasNode, 'kind' | 'size'>): Size {
  return node.size ?? { w: CARD_WIDTH[node.kind], h: CARD_HEIGHT }
}
