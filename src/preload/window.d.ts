import type { WebAtlasApi } from '../shared/api'
import type { Board, Session } from '../shared/types'

/** Read-only state for E2E tests (only present when the app runs with WA_E2E=1). */
export interface WaDebug {
  getBoard(): Board
  /** The open workspace's session, or null when none is open (wired in T08). */
  getSession(): Session | null
  getHistorySizes(): { past: number; future: number }
}

declare global {
  interface Window {
    api: WebAtlasApi
    /** Set by the preload in E2E runs only. */
    waE2E?: true
    __waDebug?: WaDebug
  }
}

export {}
