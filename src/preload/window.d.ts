import type { WebAtlasApi } from '../shared/api'
import type { Board, Session } from '../shared/types'

/** Read-only state for E2E tests (only present when the app runs with WA_E2E=1). */
export interface WaDebug {
  getBoard(): Board
  /** The open workspace's session, or null when none is open (wired in T08). */
  getSession(): Session | null
  getHistorySizes(): { past: number; future: number }
}

/** Development and test helpers for steps that have no UI yet. Removed in T19. */
export interface WaDev {
  /** Groups the selected cards (the Group button arrives in T10). Returns the group id. */
  groupSelected(label?: string): string | null
}

declare global {
  interface Window {
    api: WebAtlasApi
    /** Set by the preload in E2E runs only. */
    waE2E?: true
    __waDebug?: WaDebug
    __waDev?: WaDev
  }
}

export {}
