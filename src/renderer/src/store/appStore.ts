// Which screen is showing, the open workspace's details and its session (browser URL,
// capture mode, view, layout). The board itself lives in boardStore.
import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { clampSplitRatio, defaultSession } from '@shared/session'
import type { Session, Workspace } from '@shared/types'

export type Screen = 'home' | 'workspace'

/** Which side-panel tab shows: card details (when something is selected) or AI suggestions. */
export type SideTab = 'details' | 'suggestions'

/** The workspace record without its board and session. */
export type WorkspaceMeta = Omit<Workspace, 'board' | 'session'>

export interface AppState {
  screen: Screen
  workspace: WorkspaceMeta | null
  session: Session
  sideTab: SideTab
  /** The suggestion the pointer is over in the panel (its ghost is emphasised on the canvas). */
  hoveredGhostId: string | null
  /** An Organize run is in progress. */
  organizing: boolean
  setSideTab(tab: SideTab): void
  setHoveredGhost(id: string | null): void
  setOrganizing(on: boolean): void
  showWorkspace(meta: WorkspaceMeta, session: Session): void
  showHome(): void
  /** Changes session fields; unchanged values are ignored (no autosave). */
  patchSession(patch: Partial<Session>): void
}

export type AppStore = UseBoundStore<StoreApi<AppState>>

function sameValue(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b)
}

export function createAppStore(): AppStore {
  return create<AppState>()((set, get) => ({
    screen: 'home',
    workspace: null,
    session: defaultSession(),
    sideTab: 'details',
    hoveredGhostId: null,
    organizing: false,

    setSideTab: (sideTab) => set({ sideTab }),
    setHoveredGhost: (hoveredGhostId) => set({ hoveredGhostId }),
    setOrganizing: (organizing) => set({ organizing }),

    showWorkspace(meta, session) {
      set({
        screen: 'workspace',
        workspace: meta,
        session,
        sideTab: 'details',
        hoveredGhostId: null,
        organizing: false
      })
    },

    showHome() {
      set({
        screen: 'home',
        workspace: null,
        session: defaultSession(),
        sideTab: 'details',
        hoveredGhostId: null,
        organizing: false
      })
    },

    patchSession(patch) {
      const current = get().session
      const next = { ...patch }
      if (next.splitRatio !== undefined) next.splitRatio = clampSplitRatio(next.splitRatio)
      const changed = Object.entries(next).filter(
        ([key, value]) => !sameValue(current[key as keyof Session], value)
      )
      if (changed.length) set({ session: { ...current, ...Object.fromEntries(changed) } })
    }
  }))
}

export const useAppStore = createAppStore()
