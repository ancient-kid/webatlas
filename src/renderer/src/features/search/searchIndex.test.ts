import { beforeEach, describe, expect, it } from 'vitest'
import type { Board, CanvasNode, Group } from '@shared/types'
import { buildDocs, clearSearchIndexCache, getSearchIndex, searchBoard } from './searchIndex'

function makeNode(overrides: Partial<CanvasNode> & { id: string; title: string }): CanvasNode {
  return {
    kind: 'webpage',
    url: 'https://example.com/page',
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

describe('searchIndex', () => {
  beforeEach(() => {
    clearSearchIndexCache()
  })

  it('fuzzy matches typos like "rotterdm" to Rotterdam card', () => {
    const board: Board = {
      nodes: {
        node1: makeNode({
          id: 'node1',
          title: 'Rotterdam: living with water',
          url: 'https://youtube.com/watch?v=123'
        }),
        node2: makeNode({
          id: 'node2',
          title: 'Sea-level rise in Venice',
          url: 'https://nature.com/article'
        })
      },
      groups: {},
      edges: {},
      ghosts: {}
    }

    const results = searchBoard(board, 'rotterdm')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe('node1')
    expect(results[0].title).toBe('Rotterdam: living with water')
    expect(results[0].match).toContain('Title')
  })

  it('a highlight hit gives a match line starting with "Highlight ·" with a snippet', () => {
    const board: Board = {
      nodes: {
        node1: makeNode({
          id: 'node1',
          title: 'Urban Climate Finance',
          highlights: [
            {
              id: 'h1',
              quote:
                'A major pilot project in Rotterdam reduced flood damage significantly over the decade.',
              createdAt: Date.now()
            }
          ]
        })
      },
      groups: {},
      edges: {},
      ghosts: {}
    }

    const results = searchBoard(board, 'flood damage')
    expect(results.length).toBe(1)
    expect(results[0].id).toBe('node1')
    expect(results[0].match).toMatch(/^Highlight · “.*flood damage.*”$/)
  })

  it('a note hit gives a match line starting with "Note ·"', () => {
    const board: Board = {
      nodes: {
        node1: makeNode({
          id: 'node1',
          title: 'Green Bonds Note',
          kind: 'note',
          note: 'Need to cross-check this municipal debt statistic against World Bank reports.'
        })
      },
      groups: {},
      edges: {},
      ghosts: {}
    }

    const results = searchBoard(board, 'municipal debt')
    expect(results.length).toBe(1)
    expect(results[0].id).toBe('node1')
    expect(results[0].match).toMatch(/^Note ·/)
  })

  it('a tag doc yields "Tag · N nodes" with associated node ids', () => {
    const board: Board = {
      nodes: {
        node1: makeNode({ id: 'node1', title: 'Article 1', tags: ['adaptation', 'case-study'] }),
        node2: makeNode({ id: 'node2', title: 'Article 2', tags: ['adaptation'] }),
        node3: makeNode({ id: 'node3', title: 'Article 3', tags: ['finance'] })
      },
      groups: {},
      edges: {},
      ghosts: {}
    }

    const results = searchBoard(board, 'adaptation')
    const tagResult = results.find((r) => r.type === 'tag')
    expect(tagResult).toBeDefined()
    expect(tagResult?.title).toBe('#adaptation')
    expect(tagResult?.match).toBe('Tag · 2 nodes')
    expect(tagResult?.ids).toEqual(['node1', 'node2'])
  })

  it('indexes groups and returns a group doc with type "group"', () => {
    const board: Board = {
      nodes: {},
      groups: {
        g1: makeGroup({ id: 'g1', label: 'Funding models' })
      },
      edges: {},
      ghosts: {}
    }

    const results = searchBoard(board, 'Funding')
    expect(results.length).toBe(1)
    expect(results[0].id).toBe('g1')
    expect(results[0].type).toBe('group')
    expect(results[0].title).toBe('Funding models')
    expect(results[0].match).toBe('Group')
  })

  it('caps search results at 8 items', () => {
    const nodes: Record<string, CanvasNode> = {}
    for (let i = 1; i <= 15; i++) {
      nodes[`n${i}`] = makeNode({ id: `n${i}`, title: `Climate Report Volume ${i}` })
    }
    const board: Board = {
      nodes,
      groups: {},
      edges: {},
      ghosts: {}
    }

    const results = searchBoard(board, 'Climate')
    expect(results.length).toBe(8)
  })

  it('strictly excludes ghosts from indexing', () => {
    const board: Board = {
      nodes: {
        real: makeNode({ id: 'real', title: 'Real Node' }),
        ghostNode: {
          ...makeNode({ id: 'ghostNode', title: 'Ghost Climate Node' }),
          ghost: true
        } as unknown as CanvasNode
      },
      groups: {
        realGroup: makeGroup({ id: 'realGroup', label: 'Real Group' }),
        ghostGroup: {
          ...makeGroup({ id: 'ghostGroup', label: 'Ghost Group' }),
          ghost: true
        } as unknown as Group
      },
      edges: {},
      ghosts: {}
    }

    const docs = buildDocs(board)
    expect(docs.some((d) => d.id === 'ghostNode')).toBe(false)
    expect(docs.some((d) => d.id === 'ghostGroup')).toBe(false)
    expect(docs.some((d) => d.id === 'real')).toBe(true)
    expect(docs.some((d) => d.id === 'realGroup')).toBe(true)
  })

  it('rebuilds the index when a node or board changes', () => {
    const board1: Board = {
      nodes: {
        n1: makeNode({ id: 'n1', title: 'First title' })
      },
      groups: {},
      edges: {},
      ghosts: {}
    }

    const idx1 = getSearchIndex(board1)
    expect(idx1.search('First').length).toBe(1)

    // Unchanged references -> cached index
    const idxCached = getSearchIndex(board1)
    expect(idxCached).toBe(idx1)

    // Changed nodes reference -> rebuilds index
    const board2: Board = {
      ...board1,
      nodes: {
        n1: makeNode({ id: 'n1', title: 'Updated title' })
      }
    }
    const idx2 = getSearchIndex(board2)
    expect(idx2).not.toBe(idx1)
    expect(idx2.search('Updated').length).toBe(1)
  })
})
