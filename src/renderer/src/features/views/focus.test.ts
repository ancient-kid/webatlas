import { describe, expect, it } from 'vitest'
import type { Board, CanvasNode, Group } from '@shared/types'
import { focusSet } from './focus'

function makeNode(overrides: Partial<CanvasNode> & { id: string }): CanvasNode {
  return {
    kind: 'webpage',
    title: 'Test',
    highlights: [],
    note: '',
    comments: [],
    tags: [],
    position: { x: 0, y: 0 },
    capturedAt: Date.now(),
    ...overrides
  }
}

function makeGroup(overrides: Partial<Group> & { id: string; label: string }): Group {
  return {
    color: 'teal',
    category: 'topic',
    note: '',
    comments: [],
    position: { x: 0, y: 0 },
    size: { w: 400, h: 300 },
    ...overrides
  }
}

describe('focusSet', () => {
  it('anchors on the question card when nothing is selected', () => {
    const board: Board = {
      nodes: {
        q: makeNode({ id: 'q', kind: 'question', title: 'Research Question' }),
        c1: makeNode({ id: 'c1' }),
        c2: makeNode({ id: 'c2' })
      },
      groups: {},
      edges: {
        e1: { id: 'e1', source: 'c1', target: 'q', relation: 'related', origin: 'user' }
      },
      ghosts: {}
    }

    const set = focusSet(board, [])
    expect(set.has('q')).toBe(true)
    // 1-hop neighbour c1 is connected to q
    expect(set.has('c1')).toBe(true)
    // c2 is not connected
    expect(set.has('c2')).toBe(false)
  })

  it('includes a card, its neighbours in both directions, and its parent group', () => {
    const board: Board = {
      nodes: {
        q: makeNode({ id: 'q', kind: 'question' }),
        cardA: makeNode({ id: 'cardA', parentGroupId: 'g1' }),
        cardB: makeNode({ id: 'cardB' }), // outgoing neighbour
        cardC: makeNode({ id: 'cardC' }), // incoming neighbour
        cardD: makeNode({ id: 'cardD' }) // distant node
      },
      groups: {
        g1: makeGroup({ id: 'g1', label: 'Group 1' })
      },
      edges: {
        e1: { id: 'e1', source: 'cardA', target: 'cardB', relation: 'related', origin: 'user' },
        e2: { id: 'e2', source: 'cardC', target: 'cardA', relation: 'related', origin: 'user' },
        e3: { id: 'e3', source: 'cardD', target: 'cardB', relation: 'related', origin: 'user' }
      },
      ghosts: {}
    }

    const set = focusSet(board, ['cardA'])
    expect(set.has('cardA')).toBe(true)
    expect(set.has('g1')).toBe(true)
    expect(set.has('cardB')).toBe(true)
    expect(set.has('cardC')).toBe(true)
    expect(set.has('cardD')).toBe(false)
  })

  it('includes group members plus their neighbours when a group is selected', () => {
    const board: Board = {
      nodes: {
        m1: makeNode({ id: 'm1', parentGroupId: 'g1' }),
        m2: makeNode({ id: 'm2', parentGroupId: 'g1' }),
        ext: makeNode({ id: 'ext' }), // neighbour of m1
        other: makeNode({ id: 'other' })
      },
      groups: {
        g1: makeGroup({ id: 'g1', label: 'Case Studies' })
      },
      edges: {
        e1: { id: 'e1', source: 'm1', target: 'ext', relation: 'related', origin: 'user' }
      },
      ghosts: {}
    }

    const set = focusSet(board, ['g1'])
    expect(set.has('g1')).toBe(true)
    expect(set.has('m1')).toBe(true)
    expect(set.has('m2')).toBe(true)
    expect(set.has('ext')).toBe(true)
    expect(set.has('other')).toBe(false)
  })
})
