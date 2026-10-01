import type { Cat } from '@shared/types'

/** A URL as cards show it: no scheme, no trailing slash. */
export function displayUrl(url = ''): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

/** The colour of an edge's line, arrowhead and label border. */
export function edgeColor(color?: Cat, ghost?: boolean): string {
  if (ghost) return 'var(--ghost-line)'
  return color ? `var(--cat-${color})` : 'var(--line-strong)'
}

/** Curved path between two points, as drawn by DESIGN.md Edge. */
export function edgePath([x1, y1]: [number, number], [x2, y2]: [number, number]): string {
  const dx = Math.max(40, Math.abs(x2 - x1) / 2)
  return `M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`
}
