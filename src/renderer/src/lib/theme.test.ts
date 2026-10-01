// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { followSystemTheme } from './theme'

/** A controllable prefers-color-scheme media query. */
function mockMedia(dark: boolean): { set(next: boolean): void } {
  const listeners = new Set<() => void>()
  const media = {
    get matches() {
      return dark
    },
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb)
  }
  vi.stubGlobal('matchMedia', () => media)
  window.matchMedia = (() => media) as unknown as typeof window.matchMedia
  return {
    set(next) {
      dark = next
      listeners.forEach((cb) => cb())
    }
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete document.documentElement.dataset.theme
})

describe('followSystemTheme', () => {
  it('applies the OS theme to <html data-theme>', () => {
    mockMedia(true)
    followSystemTheme()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('follows changes without a restart, until stopped', () => {
    const os = mockMedia(false)
    const stop = followSystemTheme()
    expect(document.documentElement.dataset.theme).toBe('light')
    os.set(true)
    expect(document.documentElement.dataset.theme).toBe('dark')
    os.set(false)
    expect(document.documentElement.dataset.theme).toBe('light')
    stop()
    os.set(true)
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
