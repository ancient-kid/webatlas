// Pure geometry for the canvas: where a link attaches, and which group a card lands in.
import type { XY } from '@shared/types'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export type Side = 'top' | 'right' | 'bottom' | 'left'

const centre = (r: Rect): XY => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

function sidePoint(r: Rect, side: Side): XY {
  switch (side) {
    case 'top':
      return { x: r.x + r.w / 2, y: r.y }
    case 'bottom':
      return { x: r.x + r.w / 2, y: r.y + r.h }
    case 'left':
      return { x: r.x, y: r.y + r.h / 2 }
    case 'right':
      return { x: r.x + r.w, y: r.y + r.h / 2 }
  }
}

/**
 * Floating link ends: each end attaches to the middle of the side facing the other card
 * (left/right when they are further apart horizontally, otherwise top/bottom).
 */
export function linkEnds(
  source: Rect,
  target: Rect
): { source: XY; target: XY; sourceSide: Side; targetSide: Side } {
  const s = centre(source)
  const t = centre(target)
  const dx = t.x - s.x
  const dy = t.y - s.y
  const horizontal = Math.abs(dx) >= Math.abs(dy)
  const sourceSide: Side = horizontal ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'bottom' : 'top'
  const targetSide: Side = horizontal ? (dx >= 0 ? 'left' : 'right') : dy >= 0 ? 'top' : 'bottom'
  return {
    source: sidePoint(source, sourceSide),
    target: sidePoint(target, targetSide),
    sourceSide,
    targetSide
  }
}

/** The group whose frame contains the card's centre (the smallest one if several), or null. */
export function findDropGroup(card: Rect, groups: (Rect & { id: string })[]): string | null {
  const c = centre(card)
  const hits = groups.filter(
    (g) => c.x >= g.x && c.x <= g.x + g.w && c.y >= g.y && c.y <= g.y + g.h
  )
  hits.sort((a, b) => a.w * a.h - b.w * b.h)
  return hits[0]?.id ?? null
}

export function intersects(a: Rect, b: Rect, margin = 0): boolean {
  return (
    a.x < b.x + b.w + margin &&
    a.x + a.w + margin > b.x &&
    a.y < b.y + b.h + margin &&
    a.y + a.h + margin > b.y
  )
}
