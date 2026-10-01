import type { Session } from './types'

/** Browser pane width limits, as a percentage of the window. Closing is done with the toggle. */
export const SPLIT_RATIO_MIN = 20
export const SPLIT_RATIO_MAX = 80
export const SPLIT_RATIO_DEFAULT = 42

export const DEFAULT_BROWSER_URL = 'https://www.google.com'

/** Keeps the browser pane width within limits; bad values fall back to the default. */
export function clampSplitRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return SPLIT_RATIO_DEFAULT
  return Math.min(SPLIT_RATIO_MAX, Math.max(SPLIT_RATIO_MIN, Math.round(ratio * 10) / 10))
}

/** A fresh session for a new workspace. */
export function defaultSession(): Session {
  return {
    viewport: { x: 400, y: 300, zoom: 1 },
    selectedIds: [],
    browserUrl: DEFAULT_BROWSER_URL,
    viewMode: 'graph',
    captureMode: 'manual',
    browserOpen: true,
    splitRatio: SPLIT_RATIO_DEFAULT
  }
}
