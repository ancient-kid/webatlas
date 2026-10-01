import type { WaDebug, WaDev } from '../../../preload/window'
import { groupSelection } from '../store/actions'
import { useAppStore } from '../store/appStore'
import { useBoardStore } from '../store/boardStore'

/** Read-only state for E2E tests. Installed only when the preload marks a test run. */
export function createDebugHooks(): WaDebug {
  return Object.freeze({
    getBoard: () => structuredClone(useBoardStore.getState().board),
    getSession: () =>
      useAppStore.getState().workspace ? structuredClone(useAppStore.getState().session) : null,
    getHistorySizes: () => {
      const { past, future } = useBoardStore.getState()
      return { past: past.length, future: future.length }
    }
  })
}

/** Development and test helpers that change the board (through the normal actions). */
export function createDevHooks(): WaDev {
  return Object.freeze({
    groupSelected: (label = 'New group') =>
      groupSelection(useAppStore.getState().session.selectedIds, label)
  })
}

export function installDebugHooks(): void {
  const e2e = window.waE2E === true
  if (e2e)
    Object.defineProperty(window, '__waDebug', { value: createDebugHooks(), writable: false })
  if (e2e || import.meta.env.DEV) {
    Object.defineProperty(window, '__waDev', { value: createDevHooks(), writable: false })
  }
}
