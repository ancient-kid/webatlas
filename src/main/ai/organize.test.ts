import type Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it, vi } from 'vitest'
import type { BoardSnapshot } from '@shared/types'
import { mockVector } from './embed'
import { createMockAnthropic, parsePrompt } from './mockClient'
import {
  createOrganizer,
  HAIKU_MODEL,
  MAX_TURNS,
  MESSAGES,
  type AnthropicClient,
  type GroqClient,
  type OrganizeDeps
} from './organize'

type Card = BoardSnapshot['nodes'][number]
type Reply = Pick<Anthropic.Message, 'content' | 'stop_reason'>
type GroqReply = Awaited<ReturnType<GroqClient['chat']['completions']['create']>>
interface FakeAnthropic {
  client: AnthropicClient
  bodies: Anthropic.MessageCreateParamsNonStreaming[]
  options: unknown[]
}
const card = (
  id: string,
  title: string,
  text: string,
  url = `https://${id}.example.org/p`
): Card => ({
  id,
  kind: 'webpage',
  title,
  url,
  text,
  tags: [],
  note: '',
  highlights: []
})

/** Six cards on two topics, plus the question. */
function board(extra: Partial<BoardSnapshot> = {}): BoardSnapshot {
  return {
    workspaceId: 'ws-1',
    researchQuestion: 'How do coastal cities pay for flood defences?',
    questionNodeId: 'q-id',
    nodes: [
      {
        ...card('q-id', 'How do coastal cities pay for flood defences?', ''),
        kind: 'question',
        url: undefined
      },
      card(
        'f1',
        'Rotterdam flood defences',
        'Rotterdam flood defences sea walls storm barriers coastal city'
      ),
      card('f2', 'Jakarta sea wall', 'Jakarta flood defences sea walls coastal city sinking'),
      card('f3', 'Miami flood barriers', 'Miami flood defences sea walls storm barriers coastal'),
      card('c1', 'Coffee brewing basics', 'coffee beans grind brewing espresso water temperature'),
      card('c2', 'Espresso extraction', 'espresso coffee beans grind extraction pressure brewing'),
      card('c3', 'Pour-over coffee', 'pour over coffee beans grind brewing filter water')
    ],
    groups: [],
    edges: [],
    ...extra
  }
}

const toolUse = (
  name: string,
  input: unknown,
  id = `tu_${name}_${Math.random()}`
): Anthropic.ToolUseBlock => ({ type: 'tool_use', id, name, input }) as Anthropic.ToolUseBlock

const groupCall = (
  ids: string[],
  label = 'Flood defences',
  confidence = 0.8
): Anthropic.ToolUseBlock =>
  toolUse('proposeGroup', {
    nodeIds: ids,
    label,
    category: 'topic',
    rationale: 'All cover sea walls.',
    confidence
  })

function fakeAnthropic(
  ...turns: (Reply | Error | ((body: Anthropic.MessageCreateParamsNonStreaming) => Reply))[]
): FakeAnthropic {
  const bodies: Anthropic.MessageCreateParamsNonStreaming[] = []
  const options: unknown[] = []
  let i = 0
  const client: AnthropicClient = {
    messages: {
      create: vi.fn(async (body, opts) => {
        bodies.push(structuredClone(body))
        options.push(opts)
        const t = turns[Math.min(i++, turns.length - 1)]
        if (t instanceof Error) throw t
        return typeof t === 'function' ? t(body) : t
      })
    }
  }
  return { client, bodies, options }
}

function fakeGroq(...turns: (GroqReply | Error)[]): { client: GroqClient; bodies: unknown[] } {
  const bodies: unknown[] = []
  let i = 0
  const client: GroqClient = {
    chat: {
      completions: {
        create: vi.fn(async (body) => {
          bodies.push(structuredClone(body))
          const t = turns[Math.min(i++, turns.length - 1)]
          if (t instanceof Error) throw t
          return t
        })
      }
    }
  }
  return { client, bodies }
}

function deps(over: Partial<OrganizeDeps> = {}): {
  d: OrganizeDeps
  logs: Record<string, unknown>[]
} {
  let id = 0
  const logs: Record<string, unknown>[] = []
  const d: OrganizeDeps = {
    embed: vi.fn(async (_ws, items) =>
      Object.fromEntries(items.map((it) => [it.id, mockVector(it.text)]))
    ),
    embedText: vi.fn(async (t) => mockVector(t)),
    keys: () => ({ anthropic: 'a-key', groq: 'g-key' }),
    anthropic: vi.fn(() => {
      throw new Error('no anthropic client in this test')
    }),
    groq: vi.fn(() => {
      throw new Error('no groq client in this test')
    }),
    groqModel: () => 'qwen/qwen3.8-27b',
    newId: () => `id-${++id}`,
    now: () => 0,
    log: (l) => logs.push(l),
    ...over
  }
  return { d, logs }
}

describe('organize', () => {
  it('asks for more pages below 3 cards, without any embedding or network call', async () => {
    const { d } = deps()
    const snap = board()
    snap.nodes = snap.nodes.slice(0, 3)
    const res = await createOrganizer(d).organize(snap)
    expect(res).toEqual({ ghosts: [], mode: 'offline', message: MESSAGES.tooFew })
    expect(d.embed).not.toHaveBeenCalled()
    expect(d.anthropic).not.toHaveBeenCalled()
  })

  it('rejects a malformed snapshot', async () => {
    const { d } = deps()
    await expect(createOrganizer(d).organize({ nodes: 'x' })).rejects.toThrow(
      'Invalid board snapshot'
    )
  })

  it('Haiku success: ghosts from tool calls, mode haiku', async () => {
    const fake = fakeAnthropic(
      {
        stop_reason: 'tool_use',
        content: [
          groupCall(['n1', 'n2', 'n3']),
          toolUse('proposeEdge', {
            source: 'n1',
            target: 'q',
            relation: 'answers',
            rationale: 'Explains the funding.',
            confidence: 0.7
          }),
          toolUse('proposeTag', {
            nodeId: 'n4',
            tag: 'coffee',
            rationale: 'About coffee.',
            confidence: 0.6
          })
        ]
      },
      { stop_reason: 'end_turn', content: [] }
    )
    const { d, logs } = deps({ anthropic: () => fake.client })
    const res = await createOrganizer(d).organize(board())
    expect(res.mode).toBe('haiku')
    expect(res.message).toBeUndefined()
    expect(res.ghosts.map((g) => g.kind)).toEqual(['group', 'edge', 'tag'])
    expect(res.ghosts[0].command).toMatchObject({
      type: 'createGroup',
      payload: { memberIds: ['f1', 'f2', 'f3'] }
    })
    for (const g of res.ghosts) expect(g.rationale.length).toBeGreaterThan(0)

    // The request: Haiku 4.5, strict tools, auto tool choice, no thinking/effort.
    const body = fake.bodies[0]
    expect(body.model).toBe(HAIKU_MODEL)
    expect(body.tool_choice).toEqual({ type: 'auto' })
    expect(body.tools?.every((t) => 'strict' in t && t.strict === true)).toBe(true)
    expect(body).not.toHaveProperty('thinking')
    expect(body).not.toHaveProperty('output_config')
    expect(body.messages).toHaveLength(1)
    // The prompt carries the clusters found locally.
    const parsed = parsePrompt(body.messages[0].content as string)
    expect(parsed.clusters.length).toBe(2)

    expect(logs.at(-1)).toMatchObject({ mode: 'haiku', cards: 6, clusters: 2, ghosts: 3, turns: 2 })
  })

  it('sends every tool result back in one user message, with is_error for bad calls', async () => {
    const fake = fakeAnthropic(
      {
        stop_reason: 'tool_use',
        content: [
          { type: 'text', text: 'Proposing.', citations: null },
          toolUse(
            'proposeGroup',
            {
              nodeIds: ['n1', 'n2'],
              label: 'Floods',
              category: 'topic',
              rationale: 'r',
              confidence: 0.9
            },
            'tu_ok'
          ),
          toolUse(
            'proposeEdge',
            { source: 'n77', target: 'q', relation: 'answers', rationale: 'r', confidence: 0.9 },
            'tu_bad'
          ),
          toolUse(
            'proposeTag',
            { nodeId: 'n1', tag: 'x', rationale: 'r', confidence: 0.2 },
            'tu_low'
          )
        ]
      },
      { stop_reason: 'end_turn', content: [] }
    )
    const { d } = deps({ anthropic: () => fake.client })
    const res = await createOrganizer(d).organize(board())
    expect(res.ghosts).toHaveLength(1)
    const second = fake.bodies[1]
    expect(second.messages).toHaveLength(3)
    expect(second.messages[1].role).toBe('assistant')
    const reply = second.messages[2]
    expect(reply.role).toBe('user')
    expect(reply.content).toEqual([
      { type: 'tool_result', tool_use_id: 'tu_ok', content: 'ok' },
      {
        type: 'tool_result',
        tool_use_id: 'tu_bad',
        content: expect.stringContaining('n77'),
        is_error: true
      },
      { type: 'tool_result', tool_use_id: 'tu_low', content: expect.stringContaining('Skipped') }
    ])
  })

  it(`stops after ${MAX_TURNS} turns even if the model keeps calling tools`, async () => {
    let n = 0
    const fake = fakeAnthropic(() => ({
      stop_reason: 'tool_use',
      content: [
        toolUse('proposeTag', { nodeId: `n${++n}`, tag: 'loop', rationale: 'r', confidence: 0.8 })
      ]
    }))
    const { d } = deps({ anthropic: () => fake.client })
    const res = await createOrganizer(d).organize(board())
    expect(fake.client.messages.create).toHaveBeenCalledTimes(MAX_TURNS)
    expect(res.mode).toBe('haiku')
    expect(res.ghosts).toHaveLength(MAX_TURNS)
  })

  it('keeps earlier ghosts when a later Haiku turn fails', async () => {
    const fake = fakeAnthropic(
      { stop_reason: 'tool_use', content: [groupCall(['n1', 'n2'])] },
      new Error('connection reset')
    )
    const { d } = deps({ anthropic: () => fake.client, groq: vi.fn() })
    const res = await createOrganizer(d).organize(board())
    expect(res.mode).toBe('haiku')
    expect(res.ghosts).toHaveLength(1)
    expect(d.groq).not.toHaveBeenCalled()
  })

  it('caps each kind of suggestion', async () => {
    const calls = Array.from({ length: 9 }, (_, i) =>
      toolUse('proposeTag', { nodeId: 'n1', tag: `tag ${i}`, rationale: 'r', confidence: 0.8 })
    )
    const fake = fakeAnthropic({ stop_reason: 'end_turn', content: calls })
    const { d } = deps({ anthropic: () => fake.client })
    const res = await createOrganizer(d).organize(board())
    expect(res.ghosts).toHaveLength(6)
  })

  it('says so when Haiku suggests nothing', async () => {
    const fake = fakeAnthropic({ stop_reason: 'end_turn', content: [] })
    const { d } = deps({ anthropic: () => fake.client })
    const res = await createOrganizer(d).organize(board())
    expect(res).toEqual({ ghosts: [], mode: 'haiku', message: MESSAGES.none })
  })

  it('Haiku throws → Groq with the same tools → mode groq', async () => {
    const haiku = fakeAnthropic(Object.assign(new Error('401'), { status: 401 }))
    const groq = fakeGroq(
      {
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'proposeGroup',
                    arguments: JSON.stringify({
                      nodeIds: ['n4', 'n5', 'n6'],
                      label: 'Coffee',
                      category: 'topic',
                      rationale: 'All coffee.',
                      confidence: 0.9
                    })
                  }
                },
                {
                  id: 'call_2',
                  type: 'function',
                  function: { name: 'proposeEdge', arguments: '{not json' }
                }
              ]
            }
          }
        ]
      },
      { choices: [{ finish_reason: 'stop', message: { content: '' } }] }
    )
    const { d, logs } = deps({ anthropic: () => haiku.client, groq: () => groq.client })
    const res = await createOrganizer(d).organize(board())
    expect(res.mode).toBe('groq')
    expect(res.message).toBe(MESSAGES.backup)
    expect(res.ghosts).toHaveLength(1)
    const first = groq.bodies[0] as {
      model: string
      tools: { type: string }[]
      tool_choice: string
      reasoning_format?: string
      messages: { role: string }[]
    }
    expect(first.model).toBe('qwen/qwen3.8-27b')
    expect(first.tools.every((t) => t.type === 'function')).toBe(true)
    expect(first.tool_choice).toBe('auto')
    expect(first.reasoning_format).toBe('hidden')
    expect(first.messages.map((m) => m.role)).toEqual(['system', 'user'])
    const second = groq.bodies[1] as {
      messages: { role: string; tool_call_id?: string; content: string }[]
    }
    expect(second.messages.map((m) => m.role)).toEqual([
      'system',
      'user',
      'assistant',
      'tool',
      'tool'
    ])
    expect(second.messages[3]).toMatchObject({ tool_call_id: 'call_1', content: 'ok' })
    expect(second.messages[4].content).toMatch(/^Error: /)
    expect(logs.some((l) => l.stage === 'haiku' && l.error === 'HTTP 401')).toBe(true)
  })

  it('both fail → offline: named clusters, no links', async () => {
    const haiku = fakeAnthropic(new Error('offline'))
    const groq = fakeGroq(new Error('offline'))
    const { d } = deps({ anthropic: () => haiku.client, groq: () => groq.client })
    const snap = board()
    snap.nodes[1].tags = ['flooding']
    snap.nodes[2].tags = ['flooding']
    const res = await createOrganizer(d).organize(snap)
    expect(res.mode).toBe('offline')
    expect(res.message).toBe(MESSAGES.offline)
    expect(res.ghosts.length).toBe(2)
    expect(res.ghosts.every((g) => g.kind === 'group')).toBe(true)
    const labels = res.ghosts.map((g) =>
      g.command.type === 'createGroup' ? g.command.payload.group.label : ''
    )
    expect(labels).toContain('Flooding')
    for (const g of res.ghosts) {
      expect(g.confidence).toBeGreaterThanOrEqual(0.4)
      expect(g.rationale).toMatch(/pages with similar text/)
    }
  })

  it('offline names an untagged cluster by a word most of its titles share', async () => {
    const { d } = deps({ keys: () => ({ anthropic: '', groq: '' }) })
    const res = await createOrganizer(d).organize(board())
    const labels = res.ghosts.map((g) =>
      g.command.type === 'createGroup' ? g.command.payload.group.label : ''
    )
    expect(labels.sort()).toEqual(['Coffee', 'Flood'])
  })

  it('no keys → offline without creating any client', async () => {
    const { d } = deps({ keys: () => ({ anthropic: '', groq: '' }) })
    const res = await createOrganizer(d).organize(board())
    expect(res.mode).toBe('offline')
    expect(d.anthropic).not.toHaveBeenCalled()
    expect(d.groq).not.toHaveBeenCalled()
  })

  it('without a usable model, offline groups cards from the same site', async () => {
    const snap = board()
    snap.nodes.slice(1, 4).forEach((n, i) => {
      n.url = 'https://www.floods.example.org/' + n.id
      n.title = ['Rotterdam', 'Jakarta', 'Miami'][i]
    })
    const { d } = deps({
      keys: () => ({ anthropic: '', groq: '' }),
      embed: vi.fn(async () => {
        throw new Error('model download failed')
      })
    })
    const res = await createOrganizer(d).organize(snap)
    expect(res.mode).toBe('offline')
    expect(res.ghosts).toHaveLength(1)
    expect(res.ghosts[0].command).toMatchObject({
      payload: {
        group: { label: 'floods.example.org', category: 'source' },
        memberIds: ['f1', 'f2', 'f3']
      }
    })
  })

  it('works from text alone when embeddings fail but Haiku is reachable', async () => {
    const fake = fakeAnthropic({ stop_reason: 'end_turn', content: [groupCall(['n1', 'n2'])] })
    const { d } = deps({
      anthropic: () => fake.client,
      embed: vi.fn(async () => {
        throw new Error('model download failed')
      })
    })
    const res = await createOrganizer(d).organize(board())
    expect(res.mode).toBe('haiku')
    expect(res.ghosts).toHaveLength(1)
    expect(fake.bodies[0].messages[0].content).toContain('(none found)')
  })

  it('does not start a request when the deadline has passed, and falls back', async () => {
    let t = 0
    const fake = fakeAnthropic({ stop_reason: 'end_turn', content: [groupCall(['n1', 'n2'])] })
    const { d } = deps({
      anthropic: () => fake.client,
      keys: () => ({ anthropic: 'a', groq: '' }),
      now: () => (t += 1000),
      deadlineMs: 1500
    })
    const res = await createOrganizer(d).organize(board())
    expect(fake.client.messages.create).not.toHaveBeenCalled()
    expect(res.mode).toBe('offline')
  })

  it('gives each request the time left as its timeout (at most 30 s)', async () => {
    const fake = fakeAnthropic({ stop_reason: 'end_turn', content: [] })
    const { d } = deps({ anthropic: () => fake.client, deadlineMs: 12_000 })
    await createOrganizer(d).organize(board())
    expect(fake.options[0]).toEqual({ timeout: 12_000 })
  })

  it('never logs page text', async () => {
    const fake = fakeAnthropic({ stop_reason: 'end_turn', content: [] })
    const { d, logs } = deps({ anthropic: () => fake.client })
    await createOrganizer(d).organize(board())
    const all = JSON.stringify(logs)
    expect(all).not.toContain('sea walls')
    expect(all).not.toContain('a-key')
  })

  it('leaves grouped cards out of the clusters', async () => {
    const fake = fakeAnthropic({ stop_reason: 'end_turn', content: [] })
    const { d } = deps({ anthropic: () => fake.client })
    const snap = board({ groups: [{ id: 'g', label: 'Coffee', memberIds: ['c1', 'c2', 'c3'] }] })
    for (const n of snap.nodes) if (n.id.startsWith('c')) n.groupId = 'g'
    await createOrganizer(d).organize(snap)
    const parsed = parsePrompt(fake.bodies[0].messages[0].content as string)
    expect(parsed.clusters).toEqual([['n1', 'n2', 'n3']])
  })
})

describe('the mock client (test runs)', () => {
  it('drives the real loop: every ghost kind, and the bad call is reported back', async () => {
    const mock = createMockAnthropic(0)
    const spy = vi.spyOn(mock.messages, 'create')
    const { d } = deps({ anthropic: () => mock })
    const res = await createOrganizer(d).organize(board())
    expect(res.mode).toBe('haiku')
    expect(new Set(res.ghosts.map((g) => g.kind))).toEqual(new Set(['group', 'edge', 'tag']))
    expect(spy).toHaveBeenCalledTimes(2)
    const reply = spy.mock.calls[1][0].messages[2].content as Anthropic.ToolResultBlockParam[]
    expect(reply.filter((r) => r.is_error)).toHaveLength(1)
  })
})
