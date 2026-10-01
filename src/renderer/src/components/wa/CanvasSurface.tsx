import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'

export interface CanvasSurfaceProps {
  /** Default true; false gives a plain canvas (list view). */
  dotted?: boolean
  /** Multiplies the 32px dot pitch. */
  zoom?: number
  /** Pan offset so the dots move with the view. */
  offset?: [number, number]
  width?: number | string
  height?: number | string
  children?: ReactNode
}

/** DESIGN.md Canvas: the dotted workspace surface (static; the live canvas is React Flow). */
export function CanvasSurface(p: CanvasSurfaceProps): ReactElement {
  const pitch = 32 * (p.zoom ?? 1)
  const [ox, oy] = p.offset ?? [0, 0]
  const style: CSSProperties = { width: p.width ?? '100%', height: p.height ?? 320 }
  if (p.dotted !== false) {
    style.backgroundSize = `${pitch}px ${pitch}px`
    style.backgroundPosition = `${ox}px ${oy}px`
  }
  return (
    <div
      className={cn('wa wa-canvas', p.dotted === false && 'wa-canvas--plain')}
      style={style}
      role="application"
      aria-label="Canvas"
    >
      {p.children}
    </div>
  )
}
