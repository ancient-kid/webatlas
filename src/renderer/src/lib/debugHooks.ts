import type { WaDebug } from '../../../preload/window'
import { useBoardStore } from '../store/boardStore'

/** Read-only state for E2E tests. Installed only when the preload marks a test run. */
export function createDebugHooks(): WaDebug {
  return Object.freeze({
    getBoard: () => structuredClone(useBoardStore.getState().board),
    getSession: () => null,
    getHistorySizes: () => {
      const { past, future } = useBoardStore.getState()
      return { past: past.length, future: future.length }
    }
  })
}

export function installDebugHooks(): void {
  if (window.waE2E !== true) return
  Object.defineProperty(window, '__waDebug', { value: createDebugHooks(), writable: false })
}
