// A fake window.api for component tests: every method is a vi.fn with a sensible
// default, and `emit` fires the main → renderer events the components subscribe to.
import { vi } from 'vitest'
import type { RendererEvent, RendererEventMap, WebAtlasApi } from '@shared/api'
import { makeWorkspace } from '@shared/testing/factories'

export interface ApiStub {
  api: WebAtlasApi
  emit<E extends RendererEvent>(event: E, ...args: RendererEventMap[E]): void
}

export function installApiStub(): ApiStub {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>()
  const api = {
    workspace: {
      list: vi.fn(async () => []),
      load: vi.fn(async () => makeWorkspace()),
      save: vi.fn(async () => undefined),
      create: vi.fn(async () => makeWorkspace()),
      delete: vi.fn(async () => undefined),
      duplicate: vi.fn(async () => ({
        id: 'copy',
        name: 'copy',
        updatedAt: 0,
        nodeCount: 0,
        groupCount: 0
      }))
    },
    thumb: { save: vi.fn(async () => 'wa-thumb://ws-1/n.png') },
    ai: {
      embed: vi.fn(async () => ({})),
      summarize: vi.fn(async () => ''),
      organize: vi.fn(async () => ({ ghosts: [], mode: 'offline' as const })),
      status: vi.fn(async () => ({ anthropic: false, groq: false }))
    },
    export: { save: vi.fn(async () => null) },
    import: { workspace: vi.fn(async () => null), sample: vi.fn(async () => makeWorkspace()) },
    app: { readyToClose: vi.fn() },
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event)!.add(cb)
      return () => listeners.get(event)?.delete(cb)
    })
  } as unknown as WebAtlasApi
  Object.defineProperty(window, 'api', { value: api, configurable: true, writable: true })
  return {
    api,
    emit: (event, ...args) => listeners.get(event)?.forEach((cb) => cb(...args))
  }
}
