import type { WebAtlasApi } from '../shared/api'
import type { Board, OrganizeResult, Session } from '../shared/types'

/** Read-only state and checks for E2E tests and development (WA_E2E=1 or `npm run dev`). */
export interface WaDebug {
  getBoard(): Board
  /** The open workspace's session, or null when none is open (wired in T08). */
  getSession(): Session | null
  getHistorySizes(): { past: number; future: number }
  /** Runs the Organize agent on the open board and returns its result without showing it. */
  organize(): Promise<OrganizeResult>
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
    /** E2E runs and development only. */
    __waDebug?: WaDebug
    __waDev?: WaDev
  }
}

export {}
