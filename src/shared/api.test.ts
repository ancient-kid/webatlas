import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  CHANNELS,
  MENU_ACTIONS,
  RENDERER_EVENTS,
  type ApiMethod,
  type RendererEvent,
  type WebAtlasApi
} from './api'
import { makeWorkspace } from './testing/factories'
import { COMMAND_TYPES, type CommandType } from './types'

/** A complete stub of window.api: fails to compile if the contract and this drift apart. */
const stub = {
  workspace: {
    list: async () => [],
    load: async () => makeWorkspace(),
    save: async () => undefined,
    create: async () => makeWorkspace(),
    delete: async () => undefined,
    duplicate: async () => ({ id: 'w', name: 'n', updatedAt: 0, nodeCount: 0, groupCount: 0 })
  },
  thumb: { save: async () => 'wa-thumb://ws/node.png' },
  ai: {
    embed: async () => ({}),
    summarize: async () => '',
    organize: async () => ({ ghosts: [], mode: 'offline' as const }),
    status: async () => ({ anthropic: false, groq: false })
  },
  export: { save: async () => null },
  import: { workspace: async () => null, sample: async () => makeWorkspace() },
  app: { readyToClose: () => undefined },
  on: () => () => undefined
} satisfies WebAtlasApi

/** "group.method" for every request method on an object shaped like window.api. */
function methodsOf(api: Record<string, unknown>): string[] {
  return Object.entries(api)
    .filter(([group]) => group !== 'on')
    .flatMap(([group, methods]) => Object.keys(methods as object).map((m) => `${group}.${m}`))
    .sort()
}

describe('window.api contract', () => {
  it('has exactly one IPC channel per request method', () => {
    expect(Object.keys(CHANNELS).sort()).toEqual(methodsOf(stub))
  })

  it('names channels "domain:verb" and never reuses one', () => {
    const channels = Object.values(CHANNELS)
    expect(new Set(channels).size).toBe(channels.length)
    for (const channel of channels) expect(channel).toMatch(/^[a-z]+:[a-z-]+$/)
  })

  it('keeps event channels distinct from request channels', () => {
    const requests = new Set<string>(Object.values(CHANNELS))
    for (const event of RENDERER_EVENTS) expect(requests.has(event)).toBe(false)
  })

  it('lists every renderer event exactly once', () => {
    expectTypeOf<(typeof RENDERER_EVENTS)[number]>().toEqualTypeOf<RendererEvent>()
    expect(new Set(RENDERER_EVENTS).size).toBe(RENDERER_EVENTS.length)
  })

  it('includes the browser-toggle menu action for Ctrl+B', () => {
    expect(MENU_ACTIONS).toContain('toggle-browser')
  })

  it('types ApiMethod as the keys of CHANNELS', () => {
    expectTypeOf<keyof typeof CHANNELS>().toEqualTypeOf<ApiMethod>()
  })
})

describe('command types', () => {
  it('lists every Command variant exactly once', () => {
    expectTypeOf<(typeof COMMAND_TYPES)[number]>().toEqualTypeOf<CommandType>()
    expect(new Set(COMMAND_TYPES).size).toBe(COMMAND_TYPES.length)
  })
})
