import { describe, expect, it } from 'vitest'
import { CARD_HEIGHT, CARD_WIDTH } from '@shared/export/geometry'
import { makeBoard, makeGhost, makeGroup, makeNode } from '@shared/testing/factories'
import type { Board, Ghost } from '@shared/types'
import { boardToEdges, boardToFlow } from '../canvas/boardToFlow'
import { GHOST_PAD, ghostsToFlow, isGhostId, suggestedTagsFor, visibleGhosts } from './ghostsToFlow'

const groupGhost = (over: Partial<Ghost> = {}): Ghost =>
  makeGhost({
    id: 'gG',
    kind: 'group',
    title: 'Group 2 pages as “Bonds”',
    confidence: 0.9,
    command: {
      type: 'createGroup',
      payload: {
        group: { id: 'new-g', label: 'Bonds', color: 'teal', category: 'topic' },
        memberIds: ['a', 'b']
      }
    },
    ...over
  })
const edgeGhost = makeGhost({
  id: 'gE',
  kind: 'edge',
  confidence: 0.6,
  command: {
    type: 'connect',
    payload: { edge: { id: 'e-ai', source: 'a', target: 'b', relation: 'supports', origin: 'ai' } }
  }
})
const tagGhost = makeGhost({
  id: 'gT',
  kind: 'tag',
  confidence: 0.5,
  command: { type: 'addTags', payload: { nodeIds: ['a'], tag: 'finance' } }
})

const board = (ghosts: Ghost[] = [groupGhost(), edgeGhost, tagGhost]): Board =>
  makeBoard({
    nodes: [
      makeNode({ id: 'a', position: { x: 100, y: 100 } }),
      makeNode({ id: 'b', position: { x: 500, y: 300 } }),
      makeNode({ id: 'c', position: { x: 64, y: 64 }, parentGroupId: 'g1' })
    ],
    groups: [makeGroup({ id: 'g1', position: { x: 1000, y: 1000 } })],
    ghosts
  })

describe('ghostsToFlow', () => {
  it('draws a group ghost around its members with padding, behind everything', () => {
    const { nodes } = ghostsToFlow(board())
    expect(nodes).toHaveLength(1)
    const n = nodes[0]
    expect(n).toMatchObject({
      id: 'ghost-gG',
      type: 'ghostGroup',
      data: { id: 'gG' },
      zIndex: -1,
      selectable: false,
      draggable: false,
      connectable: false
    })
    expect(n.position).toEqual({ x: 100 - GHOST_PAD.side, y: 100 - GHOST_PAD.top })
    expect(n.width).toBe(500 + CARD_WIDTH.webpage - 100 + GHOST_PAD.side * 2)
    expect(n.height).toBe(300 + CARD_HEIGHT - 100 + GHOST_PAD.top + GHOST_PAD.bottom)
  })

  it('uses measured card sizes when known', () => {
    const { nodes } = ghostsToFlow(board(), (id) => (id === 'b' ? { w: 100, h: 50 } : undefined))
    expect(nodes[0].width).toBe(500 + 100 - 100 + GHOST_PAD.side * 2)
    expect(nodes[0].height).toBe(300 + 50 - 100 + GHOST_PAD.top + GHOST_PAD.bottom)
  })

  it('hides a group suggestion that would pull a card out of an existing group', () => {
    const b = board([
      groupGhost({
        command: {
          ...groupGhost().command,
          payload: {
            group: { id: 'n2', label: 'X', color: 'teal', category: 'topic' },
            memberIds: ['c', 'a']
          }
        } as Ghost['command']
      })
    ])
    expect(ghostsToFlow(b).nodes).toEqual([])
    expect(visibleGhosts(b)).toEqual([])
  })

  it('hides a link suggestion once the same cards are linked', () => {
    const b = board([edgeGhost])
    expect(ghostsToFlow(b).edges).toHaveLength(1)
    b.edges.mine = { id: 'mine', source: 'b', target: 'a', relation: 'related', origin: 'user' }
    expect(ghostsToFlow(b).edges).toEqual([])
  })

  it('draws an edge ghost as a prefixed labeled edge marked ghost', () => {
    const { edges } = ghostsToFlow(board())
    expect(edges).toEqual([
      expect.objectContaining({
        id: 'ghost-gE',
        type: 'labeled',
        source: 'a',
        target: 'b',
        data: { id: 'gE', ghost: true },
        selectable: false
      })
    ])
  })

  it('tag ghosts are not drawn as canvas items', () => {
    const { nodes, edges } = ghostsToFlow(board([tagGhost]))
    expect(nodes).toEqual([])
    expect(edges).toEqual([])
  })

  it('filters out stale ghosts (a deleted card) and low-confidence ones', () => {
    const b = board([groupGhost(), edgeGhost, { ...tagGhost, id: 'low', confidence: 0.3 }])
    delete b.nodes.b
    const { nodes, edges } = ghostsToFlow(b)
    expect(nodes).toEqual([])
    expect(edges).toEqual([])
    expect(visibleGhosts(b).map((g) => g.id)).toEqual([])
  })

  it('marks the hovered ghost', () => {
    const { nodes, edges } = ghostsToFlow(board(), undefined, 'gE')
    expect(nodes[0].className).toBeUndefined()
    expect(edges[0].className).toBe('wa-ghost-hot')
  })

  it('never collides with real ids, which boardToFlow keeps unprefixed', () => {
    const b = board()
    const real = [...boardToFlow(b), ...boardToEdges(b)].map((x) => x.id)
    const ghosts = ghostsToFlow(b)
    const ids = [...ghosts.nodes, ...ghosts.edges].map((x) => x.id)
    expect(ids.every(isGhostId)).toBe(true)
    expect(real.some(isGhostId)).toBe(false)
  })
})

describe('visibleGhosts', () => {
  it('orders groups, then links, then tags, each by confidence', () => {
    const b = board([
      tagGhost,
      edgeGhost,
      groupGhost(),
      {
        ...edgeGhost,
        id: 'gE2',
        confidence: 0.9,
        command: {
          type: 'connect',
          payload: {
            edge: { id: 'e2', source: 'b', target: 'a', relation: 'answers', origin: 'ai' }
          }
        }
      }
    ])
    expect(visibleGhosts(b).map((g) => g.id)).toEqual(['gG', 'gE2', 'gE', 'gT'])
  })
})

describe('suggestedTagsFor', () => {
  it('lists pending tags a card does not have yet', () => {
    const b = board()
    expect(suggestedTagsFor(b, 'a')).toEqual(['finance'])
    expect(suggestedTagsFor(b, 'b')).toEqual([])
    b.nodes.a.tags = ['finance']
    expect(suggestedTagsFor(b, 'a')).toEqual([])
    expect(suggestedTagsFor(b, 'missing')).toEqual([])
  })
})

describe('ghost frame order', () => {
  it('draws larger suggested groups first so smaller ones stay on top', () => {
    const big = groupGhost({ id: 'big' })
    const small = groupGhost({
      id: 'small',
      command: {
        type: 'createGroup',
        payload: {
          group: { id: 'g-small', label: 'Small', color: 'teal', category: 'topic' },
          memberIds: ['a', 'c']
        }
      }
    })
    const b = board([small, big])
    b.nodes.c = { ...b.nodes.c, parentGroupId: undefined, position: { x: 120, y: 120 } }
    const { nodes } = ghostsToFlow(b)
    expect(nodes.map((n) => n.id)).toEqual(['ghost-big', 'ghost-small'])
  })
})
