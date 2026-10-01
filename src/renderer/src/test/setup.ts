// Shared Vitest setup. Adds the jest-dom matchers (toBeInTheDocument, …) and
// unmounts rendered components after each test. Safe in the node environment:
// cleanup only runs when a DOM exists.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

afterEach(async () => {
  if (typeof document === 'undefined') return
  const { cleanup } = await import('@testing-library/react')
  cleanup()
})

// jsdom lacks a few browser APIs React Flow needs (as recommended by the React Flow docs).
if (typeof window !== 'undefined') {
  class ResizeObserverStub {
    observe = (): void => undefined
    unobserve = (): void => undefined
    disconnect = (): void => undefined
  }
  globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
  globalThis.DOMMatrixReadOnly ??= class {
    m22: number
    constructor(transform?: string) {
      const scale = transform?.match(/scale\(([1-9.])\)/)?.[1]
      this.m22 = scale !== undefined ? Number(scale) : 1
    }
  } as unknown as typeof DOMMatrixReadOnly
}
