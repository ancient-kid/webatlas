import { beforeEach, describe, expect, it } from 'vitest'
import {
  makeBoard,
  makeEdge,
  makeGhost,
  makeGroup,
  makeNode,
  makeQuestion
} from '@shared/testing/factories'
import type { Ghost } from '@shared/types'
import * as A from './actions'
import { useBoardStore } from './boardStore'

const s = (): ReturnType<typeof useBoardStore.getState> => useBoardStore.getState()
const b = (): ReturnType<typeof useBoardStore.getState>['board'] => s().board

const edgeGhost = makeGhost({
  id: 'gE',
  kind: 'edge',
  confidence: 0.7,
  command: {
    type: 'connect',
    payload: {
      edge: { id: 'eAI', source: 'n1', target: 'question', relation: 'answers', origin: 'user' }
    }
  }
})
const groupGhost = makeGhost({
  id: 'gG',
  kind: 'group',
  confidence: 0.9,
  command: {
    type: 'createGroup',
    payload: {
      group: { id: 'gAI', label: 'Bonds', color: 'not-a-colour' as 'teal', category: 'source' },
      memberIds: ['n1', 'n2']
    }
  }
})
const tagGhost = makeGhost({
  id: 'gT',
  kind: 'tag',
  confidence: 0.5,
  command: { type: 'addTags', payload: { nodeIds: ['n2'], tag: 'finance' } }
})

function load(ghosts: Ghost[] = [edgeGhost, groupGhost, tagGhost]): void {
  s().load(
    makeBoard({
      nodes: [
        makeQuestion({ position: { x: 0, y: 0 } }),
        makeNode({ id: 'n1', position: { x: 400, y: 0 } }),
        makeNode({ id: 'n2', position: { x: 800, y: 0 } }),
        makeNode({ id: 'n3', position: { x: 64, y: 64 }, parentGroupId: 'g1' })
      ],
      groups: [makeGroup({ id: 'g1', position: { x: 0, y: 400 } })],
      edges: [makeEdge({ id: 'e1', source: 'n1', target: 'n2', relation: 'related' })],
      ghosts
    })
  )
}

beforeEach(() => load())

describe('ghost actions', () => {
  it('acceptGhost applies the command and removes the ghost in one undo step', () => {
    expect(A.acceptGhost('gE')).toBe(true)
    expect(b().edges.eAI).toMatchObject({ relation: 'answers', origin: 'ai' })
    expect(b().ghosts.gE).toBeUndefined()
    expect(s().past).toHaveLength(1)

    s().undo()
    expect(b().edges.eAI).toBeUndefined()
    expect(b().ghosts.gE).toEqual(edgeGhost)
  })

  it('an accepted group gets a default colour for its category when it has none', () => {
    A.acceptGhost('gG')
    expect(b().groups.gAI).toMatchObject({ label: 'Bonds', color: 'blue' }) // source → blue
    expect(b().nodes.n1.parentGroupId).toBe('gAI')
  })

  it('rejectGhost removes it; undo brings it back', () => {
    expect(A.rejectGhost('gT')).toBe(true)
    expect(b().ghosts.gT).toBeUndefined()
    s().undo()
    expect(b().ghosts.gT).toEqual(tagGhost)
  })

  it('acceptAllGhosts applies each as its own undo step (groups first)', () => {
    expect(A.acceptAllGhosts()).toBe(3)
    expect(b().ghosts).toEqual({})
    expect(s().past).toHaveLength(3)
    expect(s().past[0].command).toMatchObject({
      payload: { commands: [{ type: 'createGroup' }, { type: 'removeGhosts' }] }
    })
    s().undo()
    expect(Object.keys(b().ghosts)).toEqual(['gT'])
  })

  it('rejectAllGhosts removes every ghost as one undo step', () => {
    expect(A.rejectAllGhosts()).toBe(true)
    expect(b().ghosts).toEqual({})
    s().undo()
    expect(Object.keys(b().ghosts).sort()).toEqual(['gE', 'gG', 'gT'])
    expect(A.rejectAllGhosts()).toBe(true)
    expect(A.rejectAllGhosts()).toBe(false) // nothing left
  })

  it('a ghost whose card was deleted is dropped instead of applied', () => {
    // Simulate a stale ghost (e.g. loaded from disk) without removeNodes' cascade.
    s().patchSilently((d) => {
      delete d.nodes.n1
    })
    expect(A.acceptGhost('gE')).toBe(false)
    expect(b().ghosts.gE).toBeUndefined()
    expect(b().edges.eAI).toBeUndefined()
    expect(s().past).toHaveLength(0)
  })

  it('deleting a card removes ghosts that refer to it; undo restores them', () => {
    A.deleteSelection(['n1'])
    expect(Object.keys(b().ghosts)).toEqual(['gT'])
    s().undo()
    expect(Object.keys(b().ghosts).sort()).toEqual(['gE', 'gG', 'gT'])
  })
})

describe('dropIntoGroup', () => {
  it('converts a dropped absolute position into the group’s space', () => {
    expect(A.dropIntoGroup(['n1'], 'g1', { n1: { x: 96, y: 500 } })).toBe(true)
    expect(b().nodes.n1).toMatchObject({ parentGroupId: 'g1', position: { x: 96, y: 100 } })
  })

  it('moving out keeps the card where it is on screen', () => {
    A.dropIntoGroup(['n3'], null)
    expect(b().nodes.n3.parentGroupId).toBeUndefined()
    expect(b().nodes.n3.position).toEqual({ x: 64, y: 464 })
    s().undo()
    expect(b().nodes.n3).toMatchObject({ parentGroupId: 'g1', position: { x: 64, y: 64 } })
  })

  it('is one undo step for several cards, and ignores the question card and no-ops', () => {
    expect(A.dropIntoGroup(['n1', 'n2', 'question'], 'g1')).toBe(true)
    expect(s().past).toHaveLength(1)
    expect(b().nodes.question.parentGroupId).toBeUndefined()
    expect(A.dropIntoGroup(['n1'], 'g1')).toBe(false) // already there, same place
    expect(A.dropIntoGroup(['n1'], 'missing')).toBe(false)
  })
})

describe('card, edge and group actions', () => {
  it('addNoteAt creates a note card with a fresh id', () => {
    const id = A.addNoteAt({ x: 10, y: 20 }, 'Green bonds')
    expect(b().nodes[id]).toMatchObject({
      kind: 'note',
      title: 'Green bonds',
      position: { x: 10, y: 20 }
    })
    expect(A.addNoteAt({ x: 0, y: 0 })).not.toBe(id)
  })

  it('deleteSelection removes cards and group frames in one step and keeps the question', () => {
    expect(A.deleteSelection(['n2', 'g1', 'question'])).toBe(true)
    expect(b().nodes.n2).toBeUndefined()
    expect(b().nodes.question).toBeDefined()
    expect(b().groups.g1).toBeUndefined()
    expect(b().nodes.n3).toMatchObject({ position: { x: 64, y: 464 } }) // frame only
    expect(b().edges.e1).toBeUndefined()
    s().undo()
    expect(b().nodes.n3).toMatchObject({ parentGroupId: 'g1', position: { x: 64, y: 64 } })
    expect(b().edges.e1).toBeDefined()
    expect(A.deleteSelection(['question'])).toBe(false)
  })

  it('moveCommitted skips unchanged positions', () => {
    expect(A.moveCommitted([{ id: 'n1', to: { x: 400, y: 0 } }])).toBe(false)
    expect(A.moveCommitted([{ id: 'n1', to: { x: 432, y: 0 } }])).toBe(true)
  })

  it('setColor colours cards and groups; null clears cards only', () => {
    A.setColor(['n1', 'g1'], 'rose')
    expect(b().nodes.n1.color).toBe('rose')
    expect(b().groups.g1.color).toBe('rose')
    expect(s().past).toHaveLength(1)
    A.setColor(['n1', 'g1'], null)
    expect('color' in b().nodes.n1).toBe(false)
    expect(b().groups.g1.color).toBe('rose')
    expect(A.setColor(['n1'], null)).toBe(false)
  })

  it('tagItems normalises the tag; untag removes it', () => {
    A.tagItems(['n1', 'n2'], '  #Must Cite ')
    expect(b().nodes.n1.tags).toEqual(['must cite'])
    A.untag(['n1'], 'MUST CITE')
    expect(b().nodes.n1.tags).toEqual([])
    expect(b().nodes.n2.tags).toEqual(['must cite'])
    expect(A.tagItems(['n1'], '   ')).toBe(false)
  })

  it('highlights and comments get ids and times; empty text is ignored', () => {
    const h = A.addHighlight('n1', '  Sea walls cost billions. ')
    expect(b().nodes.n1.highlights).toEqual([
      { id: h, quote: 'Sea walls cost billions.', createdAt: expect.any(Number) }
    ])
    expect(A.addHighlight('n1', '  ')).toBeNull()
    const c = A.addComment('g1', 'Check with supervisor')
    expect(b().groups.g1.comments[0]).toMatchObject({ id: c, text: 'Check with supervisor' })
    A.removeComment('g1', c!)
    A.removeHighlight('n1', h!)
    expect(b().groups.g1.comments).toEqual([])
    expect(b().nodes.n1.highlights).toEqual([])
  })

  it('updateNodeFields and updateQuestion only record real changes', () => {
    expect(A.updateNodeFields('n1', { title: 'Page n1' })).toBe(false) // unchanged
    expect(A.updateNodeFields('n1', { title: 'Renamed', note: 'Mine' })).toBe(true)
    expect(A.updateQuestion('Why do sea walls fail?')).toBe(true)
    expect(b().nodes.question.title).toBe('Why do sea walls fail?')
    s().undo()
    expect(b().nodes.question.title).toBe('How do coastal cities fund climate adaptation?')
  })

  it('connectNodes defaults to a user "related" link and refuses duplicates', () => {
    const id = A.connectNodes('n2', 'question')
    expect(b().edges[id!]).toMatchObject({ relation: 'related', origin: 'user' })
    expect(A.connectNodes('n2', 'question')).toBeNull()
  })

  it('setEdgeRelation keeps a label only for custom relations', () => {
    A.setEdgeRelation('e1', 'custom', ' cites ')
    expect(b().edges.e1).toMatchObject({ relation: 'custom', label: 'cites' })
    A.setEdgeRelation('e1', 'supports')
    expect(b().edges.e1.relation).toBe('supports')
    expect('label' in b().edges.e1).toBe(false)
    expect(A.setEdgeRelation('e1', 'supports')).toBe(false)
    A.disconnectEdges(['e1'])
    expect(b().edges.e1).toBeUndefined()
  })

  it('groupSelection creates a coloured group; ungroup removes the frame', () => {
    const id = A.groupSelection(['n1', 'n2'], ' Funding ', 'importance')!
    expect(b().groups[id]).toMatchObject({
      label: 'Funding',
      color: 'rose',
      category: 'importance'
    })
    expect(A.updateGroupFields(id, { label: 'Funding' })).toBe(false)
    expect(A.updateGroupFields(id, { label: 'Money' })).toBe(true)
    A.ungroup(id)
    expect(b().groups[id]).toBeUndefined()
    expect(b().nodes.n1.parentGroupId).toBeUndefined()
    expect(A.groupSelection(['question'], 'Nope')).toBeNull()
  })
})
