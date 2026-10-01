// Finding room on the canvas for a new card (used by capture in T11).
import { absolutePosition, GRID, nodeSize } from '@shared/export/geometry'
import type { Board, Size, XY } from '@shared/types'
import { intersects, type Rect } from './geometry'

export const PLACEMENT_COLUMNS = 8
export const PLACEMENT_ROWS = 5
const MARGIN = 16

/** Absolute rectangles of every card and group on the board. */
function occupied(board: Board): Rect[] {
  const cards = Object.values(board.nodes).map((n) => {
    const p = absolutePosition(n, board)
    const s = nodeSize(n)
    return { x: p.x, y: p.y, w: s.w, h: s.h }
  })
  const groups = Object.values(board.groups).map((g) => ({
    x: g.position.x,
    y: g.position.y,
    w: g.size.w,
    h: g.size.h
  }))
  return [...cards, ...groups]
}

const snap = (v: number): number => Math.round(v / GRID) * GRID

/**
 * The first free spot for a card of `size`, scanning right of `near` and then down, one
 * card-width/height (plus a grid step) at a time. Falls back to `near` if the area is full.
 */
export function findFreeSpot(board: Board, near: XY, size: Size = { w: 260, h: 240 }): XY {
  const taken = occupied(board)
  const stepX = snap(size.w + GRID)
  const stepY = snap(size.h + GRID)
  const origin = { x: snap(near.x), y: snap(near.y) }
  for (let row = 0; row < PLACEMENT_ROWS; row++) {
    for (let col = 0; col < PLACEMENT_COLUMNS; col++) {
      const spot = { x: origin.x + col * stepX, y: origin.y + row * stepY }
      const rect = { ...spot, w: size.w, h: size.h }
      if (!taken.some((r) => intersects(rect, r, MARGIN))) return spot
    }
  }
  return origin
}
