import { describe, expect, it } from 'vitest'
import { GhostSchema } from '@shared/schema'
import {
  emptyRun,
  MIN_CONFIDENCE,
  ORGANIZE_TOOLS,
  pairKey,
  toGroqTools,
  toolCallToGhost,
  type ToolContext
} from './tools'

function ctx(overrides: Partial<ToolContext> = {}): ToolContext {
  let n = 0
  return {
    aliases: { q: 'question', n1: 'id-1', n2: 'id-2', n3: 'id-3', n4: 'id-4' },
    questionId: 'question',
    cards: {
      'id-1': { id: 'id-1', title: 'Rotterdam water squares', tags: [] },
      'id-2': { id: 'id-2', title: 'Jakarta sea wall', tags: ['flooding'] },
      'id-3': { id: 'id-3', title: 'Green bonds explained', tags: [] },
      'id-4': { id: 'id-4', title: 'Grouped card', tags: [], groupId: 'g1' }
    },
    groupLabels: { g1: 'Finance' },
    linkedPairs: new Set([pairKey('id-1', 'id-3')]),
    newId: () => `uuid-${++n}`,
    run: emptyRun(),
    ...overrides
  }
}

type Input = Record<string, unknown>

const group = (o: Input = {}): Input => ({
  nodeIds: ['n1', 'n2'],
  label: 'Case studies',
  category: 'topic',
  rationale: 'Both are city flood projects.',
  confidence: 0.8,
  ...o
})
const edge = (o: Input = {}): Input => ({
  source: 'n2',
  target: 'q',
  relation: 'answers',
  rationale: 'Shows how one city pays for defences.',
  confidence: 0.7,
  ...o
})
const tag = (o: Input = {}): Input => ({
  nodeId: 'n1',
  tag: '#Urban Design',
  rationale: 'About public space design.',
  confidence: 0.6,
  ...o
})

describe('tool schemas', () => {
  it('are strict, closed, and require every property', () => {
    expect(ORGANIZE_TOOLS.map((t) => t.name)).toEqual(['proposeGroup', 'proposeEdge', 'proposeTag'])
    for (const t of ORGANIZE_TOOLS) {
      expect(t.strict).toBe(true)
      const schema = t.input_schema as unknown as {
        additionalProperties: boolean
        properties: Record<string, unknown>
        required: string[]
      }
      expect(schema.additionalProperties).toBe(false)
      expect([...schema.required].sort()).toEqual(Object.keys(schema.properties).sort())
      expect(t.description?.length).toBeGreaterThan(20)
    }
  })

  it('use only keywords strict mode supports', () => {
    const banned = ['minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'maxItems']
    const json = JSON.stringify(ORGANIZE_TOOLS)
    for (const k of banned) expect(json).not.toContain(`"${k}"`)
  })

  it('convert to the Groq (OpenAI) function shape', () => {
    const groq = toGroqTools()
    expect(groq).toHaveLength(3)
    expect(groq[0]).toEqual({
      type: 'function',
      function: {
        name: 'proposeGroup',
        description: ORGANIZE_TOOLS[0].description,
        parameters: ORGANIZE_TOOLS[0].input_schema
      }
    })
  })
})

describe('toolCallToGhost: groups', () => {
  it('maps a valid group to a createGroup ghost', () => {
    const r = toolCallToGhost('proposeGroup', group({ label: '  case   studies ' }), ctx())
    expect(r.kind).toBe('ghost')
    if (r.kind !== 'ghost') return
    expect(r.ghost).toMatchObject({
      kind: 'group',
      title: 'Group 2 pages as “Case studies”',
      rationale: 'Both are city flood projects.',
      confidence: 0.8,
      command: {
        type: 'createGroup',
        payload: {
          group: { label: 'Case studies', category: 'topic', color: 'teal' },
          memberIds: ['id-1', 'id-2']
        }
      }
    })
    expect(GhostSchema.safeParse(r.ghost).success).toBe(true)
  })

  it('takes the colour from the category', () => {
    const r = toolCallToGhost('proposeGroup', group({ category: 'source' }), ctx())
    expect(r.kind === 'ghost' && r.ghost.command).toMatchObject({
      payload: { group: { color: 'blue' } }
    })
  })

  it('rejects a group with one card (after de-duplicating ids)', () => {
    expect(toolCallToGhost('proposeGroup', group({ nodeIds: ['n1'] }), ctx()).kind).toBe('error')
    expect(toolCallToGhost('proposeGroup', group({ nodeIds: ['n1', 'n1'] }), ctx()).kind).toBe(
      'error'
    )
  })

  it('rejects unknown ids and the question', () => {
    const unknown = toolCallToGhost('proposeGroup', group({ nodeIds: ['n1', 'n99'] }), ctx())
    expect(unknown).toEqual({ kind: 'error', message: expect.stringContaining('n99') })
    expect(toolCallToGhost('proposeGroup', group({ nodeIds: ['n1', 'q'] }), ctx()).kind).toBe(
      'error'
    )
  })

  it('rejects long labels', () => {
    const r = toolCallToGhost('proposeGroup', group({ label: 'one two three four five' }), ctx())
    expect(r.kind).toBe('error')
  })

  it('will not pull a card out of an existing group', () => {
    const r = toolCallToGhost('proposeGroup', group({ nodeIds: ['n1', 'n4'] }), ctx())
    expect(r).toEqual({ kind: 'error', message: expect.stringContaining('Finance') })
  })

  it('will not put a card in two proposed groups', () => {
    const c = ctx()
    expect(toolCallToGhost('proposeGroup', group(), c).kind).toBe('ghost')
    const r = toolCallToGhost('proposeGroup', group({ nodeIds: ['n2', 'n3'], label: 'B' }), c)
    expect(r).toEqual({ kind: 'error', message: expect.stringContaining('Case studies') })
  })

  it('accepts real ids as well as aliases', () => {
    expect(toolCallToGhost('proposeGroup', group({ nodeIds: ['id-1', 'n2'] }), ctx()).kind).toBe(
      'ghost'
    )
  })
})

describe('toolCallToGhost: edges', () => {
  it('maps a valid edge to an AI connect ghost', () => {
    const r = toolCallToGhost('proposeEdge', edge(), ctx())
    expect(r.kind).toBe('ghost')
    if (r.kind !== 'ghost') return
    expect(r.ghost).toMatchObject({
      kind: 'edge',
      title: 'Jakarta sea wall → answers → Research question',
      command: {
        type: 'connect',
        payload: {
          edge: { source: 'id-2', target: 'question', relation: 'answers', origin: 'ai' }
        }
      }
    })
    expect(GhostSchema.safeParse(r.ghost).success).toBe(true)
  })

  it('drops confidence below the minimum and rejects out-of-range values', () => {
    expect(toolCallToGhost('proposeEdge', edge({ confidence: 0.3 }), ctx()).kind).toBe('dropped')
    expect(toolCallToGhost('proposeEdge', edge({ confidence: MIN_CONFIDENCE }), ctx()).kind).toBe(
      'ghost'
    )
    expect(toolCallToGhost('proposeEdge', edge({ confidence: 1.5 }), ctx()).kind).toBe('error')
  })

  it('drops links that already exist (either direction) or repeat in the run', () => {
    expect(toolCallToGhost('proposeEdge', edge({ source: 'n3', target: 'n1' }), ctx()).kind).toBe(
      'dropped'
    )
    const c = ctx()
    expect(toolCallToGhost('proposeEdge', edge({ source: 'n1', target: 'n2' }), c).kind).toBe(
      'ghost'
    )
    expect(toolCallToGhost('proposeEdge', edge({ source: 'n2', target: 'n1' }), c).kind).toBe(
      'dropped'
    )
  })

  it('rejects unknown ids, self links and the question as a source', () => {
    expect(toolCallToGhost('proposeEdge', edge({ source: 'n42' }), ctx()).kind).toBe('error')
    expect(toolCallToGhost('proposeEdge', edge({ target: 'n2' }), ctx()).kind).toBe('error')
    expect(toolCallToGhost('proposeEdge', edge({ source: 'q', target: 'n1' }), ctx()).kind).toBe(
      'error'
    )
  })

  it('rejects relations outside the allowed set and malformed input', () => {
    expect(toolCallToGhost('proposeEdge', edge({ relation: 'opened-from' }), ctx()).kind).toBe(
      'error'
    )
    expect(toolCallToGhost('proposeEdge', { source: 'n1' }, ctx()).kind).toBe('error')
    expect(toolCallToGhost('proposeEdge', null, ctx()).kind).toBe('error')
  })
})

describe('toolCallToGhost: tags', () => {
  it('maps a valid tag to an addTags ghost with a normalised tag', () => {
    const r = toolCallToGhost('proposeTag', tag(), ctx())
    expect(r.kind).toBe('ghost')
    if (r.kind !== 'ghost') return
    expect(r.ghost).toMatchObject({
      kind: 'tag',
      title: 'Tag “Rotterdam water squares” as #urban design',
      command: { type: 'addTags', payload: { nodeIds: ['id-1'], tag: 'urban design' } }
    })
  })

  it('drops tags the card already has or that repeat', () => {
    expect(toolCallToGhost('proposeTag', tag({ nodeId: 'n2', tag: 'Flooding' }), ctx()).kind).toBe(
      'dropped'
    )
    const c = ctx()
    toolCallToGhost('proposeTag', tag(), c)
    expect(toolCallToGhost('proposeTag', tag({ tag: 'urban design' }), c).kind).toBe('dropped')
  })

  it('rejects empty tags and the question', () => {
    expect(toolCallToGhost('proposeTag', tag({ tag: ' # ' }), ctx()).kind).toBe('error')
    expect(toolCallToGhost('proposeTag', tag({ nodeId: 'q' }), ctx()).kind).toBe('error')
  })
})

describe('toolCallToGhost: general', () => {
  it('rejects unknown tools', () => {
    expect(toolCallToGhost('deleteNode', {}, ctx()).kind).toBe('error')
  })

  it('replaces card aliases in the rationale with short titles', () => {
    const r = toolCallToGhost(
      'proposeEdge',
      edge({ rationale: 'n1 shows plazas while n3 explains funding; n9 and n10x stay.' }),
      ctx()
    )
    expect(r.kind === 'ghost' && r.ghost.rationale).toBe(
      '“Rotterdam water squares” shows plazas while “Green bonds explained” explains funding; n9 and n10x stay.'
    )
  })

  it('cleans the rationale: trimmed, unquoted, sentence case, clipped', () => {
    const r = toolCallToGhost(
      'proposeEdge',
      edge({ rationale: `"  both   mention ${'x'.repeat(400)} "` }),
      ctx()
    )
    expect(r.kind === 'ghost' && r.ghost.rationale.startsWith('Both mention')).toBe(true)
    expect(r.kind === 'ghost' && r.ghost.rationale.length).toBeLessThanOrEqual(220)
  })
})
