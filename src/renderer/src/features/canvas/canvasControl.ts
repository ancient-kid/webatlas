// What the rest of the app may ask of the canvas (select, reveal, find the centre).
// CanvasView registers the real implementation while it is mounted; until then the
// calls do nothing, so features like capture work with or without a visible canvas.
import type { XY } from '@shared/types'

export interface CanvasControl {
  /** Selects exactly these ids. */
  select(ids: string[]): void
  /** Pans/zooms so these items are in view (only if they aren't already). */
  reveal(ids: string[]): void
  /** Frames these items (Zoom to selection). */
  zoomTo(ids: string[]): void
  /** The canvas point at the centre of the visible area. */
  centre(): XY
}

const fallback: CanvasControl = {
  select: () => undefined,
  reveal: () => undefined,
  zoomTo: () => undefined,
  centre: () => ({ x: 0, y: 0 })
}

let current: CanvasControl = fallback

export function registerCanvas(control: CanvasControl): () => void {
  current = control
  return () => {
    if (current === control) current = fallback
  }
}

export function canvas(): CanvasControl {
  return current
}
