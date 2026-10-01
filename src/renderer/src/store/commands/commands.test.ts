import { describe, expect, it } from 'vitest'
import { parseBoard } from '@shared/schema'
import {
  makeBoard,
  makeEdge,
  makeGhost,
  makeGroup,
  makeNode,
  makeQuestion
} from '@shared/testing/factories'
import { COMMAND_TYPES, type Board, type Command, type CommandType } from '@shared/types'
import { applyToBoard, canApply, invertCommand } from './registry'

// Fixture: the question card, two loose web pages, a video inside group g1, a note,
// two edges and three pending ghosts (one of each kind).
function fixture(): Board {
  return makeBoard({
    nodes: [
      makeQuestion({ position: { x: 0, y: 0 } }),
      makeNode({ id: 'n1', position: { x: 400, y: 0 }, tags: ['policy'] }),
      makeNode({
        id: 'n2',
        position: { x: 800, y: 0 },
        tags: ['policy', 'finance', 'rotterdam'],
        color: 'rose',
        size: { w: 300, h: 200 },
        summary: 'Green bonds pay for sea walls.',
        highlights: [
          { id: 'h1', quote: 'First quote', createdAt: 1 },
          { id: 'h2', quote: 'Second quote', createdAt: 2 }
        ],
        comments: [{ id: 'c1', text: 'Check figure 2', createdAt: 3 }]
      }),
      makeNode({ id: 'n3', kind: 'video', position: { x: 32, y: 64 }, parentGroupId: 'g1' }),
      makeNode({ id: 'n4', kind: 'note', title: 'Green bonds', position: { x: 1200, y: 0 } })
    ],
    groups: [
      makeGroup({
        id: 'g1',
        position: { x: 0, y: 400 },
        size: { w: 400, h: 400 },
        comments: [{ id: 'c2', text: 'Case studies', createdAt: 4 }]
      })
    ],
    edges: [
      makeEdge({ id: 'e1', source: 'n1', target: 'question', relation: 'supports' }),
      makeEdge({
        id: 'e2',
        source: 'n2',
        target: 'n1',
        relation: 'opened-from',
        origin: 'provenance'
      })
    ],
    ghosts: [
      makeGhost({
        id: 'gh1',
        command: {
          type: 'connect',
          payload: {
            edge: {
              id: 'e-ai',
              source: 'n3',
              target: 'question',
              relation: 'answers',
              origin: 'ai'
            }
          }
        }
      }),
      makeGhost({
        id: 'gh2',
        kind: 'group',
        command: {
          type: 'createGroup',
          payload: {
            group: { id: 'g-ai', label: 'Bonds', color: 'blue', category: 'topic' },
            memberIds: ['n1', 'n2']
          }
        }
      }),
      makeGhost({
        id: 'gh3',
        kind: 'tag',
        command: { type: 'addTags', payload: { nodeIds: ['n4'], tag: 'idea' } }
      })
    ]
  })
}

const n5 = makeNode({ id: 'n5', position: { x: 0, y: -400 } })

/** One representative, board-changing command per type. */
const ROUND_TRIP: Record<CommandType, Command> = {
  addNodes: { type: 'addNodes', payload: { nodes: [n5] } },
  removeNodes: { type: 'removeNodes', payload: { ids: ['n1', 'n3'] } },
  updateNode: {
    type: 'updateNode',
    payload: { id: 'n2', patch: { title: 'Renamed', color: undefined, note: 'Mine' } }
  },
  moveItems: {
    type: 'moveItems',
    payload: {
      moves: [
        { id: 'n1', to: { x: 96, y: 96 } },
        { id: 'g1', to: { x: 64, y: 512 } }
      ]
    }
  },
  resizeItem: { type: 'resizeItem', payload: { id: 'n1', size: { w: 320, h: 320 } } },
  addTags: { type: 'addTags', payload: { nodeIds: ['n1', 'n2', 'n4'], tag: ' Finance ' } },
  removeTag: { type: 'removeTag', payload: { nodeIds: ['n1', 'n2'], tag: 'policy' } },
  addHighlight: {
    type: 'addHighlight',
    payload: { nodeId: 'n1', highlight: { id: 'h9', quote: 'New quote', createdAt: 9 } }
  },
  removeHighlight: { type: 'removeHighlight', payload: { nodeId: 'n2', highlightId: 'h1' } },
  addComment: {
    type: 'addComment',
    payload: { targetId: 'g1', comment: { id: 'c9', text: 'Ask tutor', createdAt: 9 } }
  },
  removeComment: { type: 'removeComment', payload: { targetId: 'n2', commentId: 'c1' } },
  connect: {
    type: 'connect',
    payload: { edge: makeEdge({ id: 'e9', source: 'n3', target: 'n4', relation: 'related' }) }
  },
  disconnect: { type: 'disconnect', payload: { ids: ['e1', 'e2'] } },
  updateEdge: {
    type: 'updateEdge',
    payload: { id: 'e1', patch: { relation: 'custom', label: 'cites' } }
  },
  createGroup: {
    type: 'createGroup',
    payload: {
      group: { id: 'g2', label: 'Funding', color: 'amber', category: 'topic' },
      memberIds: ['n1', 'n3', 'n4']
    }
  },
  addGroups: {
    type: 'addGroups',
    payload: { groups: [makeGroup({ id: 'g9', position: { x: 2000, y: 0 } })] }
  },
  updateGroup: {
    type: 'updateGroup',
    payload: { id: 'g1', patch: { label: 'Cities', color: 'plum', note: 'Main cases' } }
  },
  removeGroup: { type: 'removeGroup', payload: { id: 'g1' } },
  setParent: {
    type: 'setParent',
    payload: {
      items: [
        { id: 'n1', groupId: 'g1', position: { x: 32, y: 320 } },
        { id: 'n3', groupId: null, position: { x: 100, y: 100 } }
      ]
    }
  },
  removeGhosts: { type: 'removeGhosts', payload: { ids: ['gh1', 'gh2'] } },
  restoreGhosts: {
    type: 'restoreGhosts',
    payload: { ghosts: [makeGhost({ id: 'gh9' })] }
  },
  batch: {
    type: 'batch',
    payload: {
      commands: [
        { type: 'addNodes', payload: { nodes: [n5] } },
        {
          type: 'connect',
          payload: { edge: makeEdge({ id: 'e5', source: 'n5', target: 'n1', relation: 'related' }) }
        },
        {
          type: 'batch',
          payload: {
            commands: [
              { type: 'addTags', payload: { nodeIds: ['n5'], tag: 'new' } },
              {
                type: 'createGroup',
                payload: {
                  group: { id: 'g3', label: 'Pair', color: 'moss', category: 'custom' },
                  memberIds: ['n5', 'n1']
                }
              }
            ]
          }
        },
        { type: 'removeNodes', payload: { ids: ['n2'] } }
      ]
    }
  }
}

/** Applies a command and returns the result plus its inverse (computed beforehand). */
function run(board: Board, cmd: Command): { after: Board; inverse: Command } {
  const inverse = invertCommand(board, cmd)
  return { after: applyToBoard(board, cmd), inverse }
}

describe('round trip: apply then apply(inverse) restores the board', () => {
  it('covers every command type', () => {
    expect(Object.keys(ROUND_TRIP).sort()).toEqual([...COMMAND_TYPES].sort())
  })

  it.each(COMMAND_TYPES)('%s', (type) => {
    const before = fixture()
    const cmd = ROUND_TRIP[type]
    const { after, inverse } = run(before, cmd)

    expect(after).not.toStrictEqual(before)
    expect(parseBoard(after)).toMatchObject({ ok: true })
    expect(applyToBoard(after, inverse)).toStrictEqual(before)
    // Redo is deterministic: replaying the command on the restored board gives the same result.
    expect(applyToBoard(applyToBoard(after, inverse), cmd)).toStrictEqual(after)
  })
})

describe('removeNodes', () => {
  it('never removes the research-question card', () => {
    const before = fixture()
    const cmd: Command = { type: 'removeNodes', payload: { ids: ['question'] } }
    expect(applyToBoard(before, cmd)).toBe(before)
    expect(invertCommand(before, cmd)).toEqual({ type: 'batch', payload: { commands: [] } })
  })

  it('removes connected edges and ghosts that refer to the cards; undo restores all', () => {
    const before = fixture()
    const { after, inverse } = run(before, { type: 'removeNodes', payload: { ids: ['n1'] } })
    expect(after.nodes.n1).toBeUndefined()
    expect(Object.keys(after.edges)).toEqual([]) // e1 (n1→question) and e2 (n2→n1)
    expect(Object.keys(after.ghosts).sort()).toEqual(['gh1', 'gh3']) // gh2 grouped n1
    expect(applyToBoard(after, inverse)).toStrictEqual(before)
  })

  it('keeps the question card when it is part of a mixed selection', () => {
    const { after } = run(fixture(), { type: 'removeNodes', payload: { ids: ['question', 'n4'] } })
    expect(after.nodes.question).toBeDefined()
    expect(after.nodes.n4).toBeUndefined()
  })
})

describe('createGroup', () => {
  it('packs members into a grid in reading order and parents them', () => {
    const { after } = run(fixture(), ROUND_TRIP.createGroup)
    // Members by absolute position: n1 (400,0), n4 (1200,0), n3 (32,464 inside g1).
    // 3 members → 2 columns; cell = widest card 260 + 32, tallest 240 + 32.
    expect(after.groups.g2).toMatchObject({
      position: { x: 0, y: -64 },
      size: { w: 32 + 2 * 292, h: 64 + 2 * 272 },
      label: 'Funding',
      note: '',
      comments: []
    })
    expect(after.nodes.n1).toMatchObject({ parentGroupId: 'g2', position: { x: 32, y: 64 } })
    expect(after.nodes.n4).toMatchObject({ parentGroupId: 'g2', position: { x: 324, y: 64 } })
    expect(after.nodes.n3).toMatchObject({ parentGroupId: 'g2', position: { x: 32, y: 336 } })
  })

  it('undo restores each member’s exact old position and parent', () => {
    const before = fixture()
    const { after, inverse } = run(before, ROUND_TRIP.createGroup)
    const restored = applyToBoard(after, inverse)
    expect(restored.groups.g2).toBeUndefined()
    expect(restored.nodes.n3).toMatchObject({ parentGroupId: 'g1', position: { x: 32, y: 64 } })
    expect(restored.nodes.n1.parentGroupId).toBeUndefined()
    expect(restored.nodes.n1.position).toEqual({ x: 400, y: 0 })
    expect(restored).toStrictEqual(before)
  })

  it('uses resized cards for the cell size', () => {
    const { after } = run(fixture(), {
      type: 'createGroup',
      payload: {
        group: { id: 'g2', label: 'Wide', color: 'teal', category: 'topic' },
        memberIds: ['n1', 'n2'] // n2 is 300 × 200
      }
    })
    expect(after.groups.g2.size).toEqual({ w: 32 + 2 * (300 + 32), h: 64 + 1 * (240 + 32) })
  })

  it('skips the question card and does nothing without members or with a taken id', () => {
    const before = fixture()
    const onlyQuestion: Command = {
      type: 'createGroup',
      payload: {
        group: { id: 'g2', label: 'X', color: 'teal', category: 'topic' },
        memberIds: ['question', 'missing']
      }
    }
    expect(applyToBoard(before, onlyQuestion)).toBe(before)
    const takenId: Command = {
      type: 'createGroup',
      payload: {
        group: { id: 'g1', label: 'X', color: 'teal', category: 'topic' },
        memberIds: ['n1']
      }
    }
    expect(applyToBoard(before, takenId)).toBe(before)
  })
})

describe('removeGroup', () => {
  it('converts members to absolute positions; undo puts them back inside', () => {
    const before = fixture()
    const { after, inverse } = run(before, ROUND_TRIP.removeGroup)
    expect(after.groups.g1).toBeUndefined()
    expect(after.nodes.n3.parentGroupId).toBeUndefined()
    expect(after.nodes.n3.position).toEqual({ x: 32, y: 464 })
    expect(applyToBoard(after, inverse)).toStrictEqual(before)
  })
})

describe('setParent', () => {
  const into = (board: Board, groupId: string | null, position = { x: 10, y: 20 }): Board =>
    applyToBoard(board, {
      type: 'setParent',
      payload: { items: [{ id: 'n3', groupId, position }] }
    })

  it('moves a card into, out of and between groups', () => {
    const base = applyToBoard(fixture(), ROUND_TRIP.addGroups) // adds g9
    const out = into(base, null, { x: 32, y: 464 })
    expect(out.nodes.n3.parentGroupId).toBeUndefined()
    const inG9 = into(out, 'g9')
    expect(inG9.nodes.n3).toMatchObject({ parentGroupId: 'g9', position: { x: 10, y: 20 } })
    const back = into(inG9, 'g1', { x: 32, y: 64 })
    expect(back.nodes.n3).toMatchObject({ parentGroupId: 'g1', position: { x: 32, y: 64 } })
  })

  it('ignores unknown groups and the question card', () => {
    const before = fixture()
    expect(into(before, 'nope')).toBe(before)
    const q: Command = {
      type: 'setParent',
      payload: { items: [{ id: 'question', groupId: 'g1', position: { x: 0, y: 0 } }] }
    }
    expect(applyToBoard(before, q)).toBe(before)
  })
})

describe('batch', () => {
  it('inverts in reverse order, each against the state its sub-command saw', () => {
    const before = fixture()
    const inverse = invertCommand(before, ROUND_TRIP.batch)
    expect(inverse.type).toBe('batch')
    const steps = (inverse as Extract<Command, { type: 'batch' }>).payload.commands
    // Last sub-command (removeNodes n2) is undone first; the first (addNodes) last.
    expect(steps[0].type).toBe('batch') // restore n2 + its edge
    expect(steps.at(-1)).toEqual({ type: 'removeNodes', payload: { ids: ['n5'] } })
  })

  it('handles nested batches and an empty batch', () => {
    const before = fixture()
    const empty: Command = { type: 'batch', payload: { commands: [] } }
    expect(applyToBoard(before, empty)).toBe(before)
    const { after } = run(before, ROUND_TRIP.batch)
    expect(after.groups.g3).toBeDefined()
    expect(after.nodes.n5).toMatchObject({ parentGroupId: 'g3', tags: ['new'] })
  })
})

describe('connect', () => {
  it('is a no-op when a card is missing, for a self-link, or for a duplicate', () => {
    const before = fixture()
    const cases = [
      makeEdge({ id: 'x1', source: 'n1', target: 'ghost-card' }),
      makeEdge({ id: 'x2', source: 'n1', target: 'n1' }),
      makeEdge({ id: 'x3', source: 'n1', target: 'question', relation: 'supports' }), // = e1
      makeEdge({ id: 'e1', source: 'n4', target: 'n2' }) // id taken
    ]
    for (const edge of cases) {
      const cmd: Command = { type: 'connect', payload: { edge } }
      expect(applyToBoard(before, cmd)).toBe(before)
      expect(invertCommand(before, cmd)).toEqual({ type: 'batch', payload: { commands: [] } })
    }
  })

  it('allows a second link between the same cards with a different relation', () => {
    const edge = makeEdge({ id: 'x4', source: 'n1', target: 'question', relation: 'answers' })
    const after = applyToBoard(fixture(), { type: 'connect', payload: { edge } })
    expect(after.edges.x4).toEqual(edge)
  })
})

describe('tags', () => {
  it('addTags lowercases, trims and skips cards that already have the tag', () => {
    const before = fixture()
    const { after, inverse } = run(before, ROUND_TRIP.addTags)
    expect(after.nodes.n1.tags).toEqual(['policy', 'finance'])
    expect(after.nodes.n2.tags).toEqual(['policy', 'finance', 'rotterdam'])
    expect(after.nodes.n4.tags).toEqual(['finance'])
    // Undo removes the tag only from the cards that didn't have it.
    expect(inverse).toEqual({
      type: 'removeTag',
      payload: { nodeIds: ['n1', 'n4'], tag: 'finance' }
    })
    expect(applyToBoard(after, inverse).nodes.n2.tags).toEqual(['policy', 'finance', 'rotterdam'])
  })

  it('an empty tag does nothing', () => {
    const before = fixture()
    const cmd: Command = { type: 'addTags', payload: { nodeIds: ['n1'], tag: '  #  ' } }
    expect(applyToBoard(before, cmd)).toBe(before)
  })
})

describe('other edge cases', () => {
  it('resizeItem with null returns a card to its default size; groups keep theirs', () => {
    const before = fixture()
    const { after, inverse } = run(before, {
      type: 'resizeItem',
      payload: { id: 'n2', size: null }
    })
    expect(after.nodes.n2.size).toBeUndefined()
    expect(applyToBoard(after, inverse)).toStrictEqual(before)
    expect(applyToBoard(before, { type: 'resizeItem', payload: { id: 'g1', size: null } })).toBe(
      before
    )
  })

  it('updateNode never changes kind or parent', () => {
    const before = fixture()
    const cmd: Command = {
      type: 'updateNode',
      payload: { id: 'n3', patch: { kind: 'note', parentGroupId: undefined } }
    }
    expect(applyToBoard(before, cmd)).toBe(before)
  })

  it('commands on missing items are no-ops with no-op inverses', () => {
    const before = fixture()
    const cmds: Command[] = [
      { type: 'updateNode', payload: { id: 'zz', patch: { title: 'x' } } },
      { type: 'moveItems', payload: { moves: [{ id: 'zz', to: { x: 1, y: 1 } }] } },
      { type: 'disconnect', payload: { ids: ['zz'] } },
      { type: 'updateGroup', payload: { id: 'zz', patch: { label: 'x' } } },
      { type: 'removeGroup', payload: { id: 'zz' } },
      { type: 'removeGhosts', payload: { ids: ['zz'] } },
      { type: 'removeHighlight', payload: { nodeId: 'n1', highlightId: 'zz' } }
    ]
    for (const cmd of cmds) {
      expect(applyToBoard(before, cmd)).toBe(before)
      expect(applyToBoard(before, invertCommand(before, cmd))).toBe(before)
    }
  })

  it('throws on an unknown command type', () => {
    const bad = { type: 'explode', payload: {} } as unknown as Command
    expect(() => applyToBoard(fixture(), bad)).toThrow(/Unknown command/)
  })
})

describe('canApply', () => {
  it('is true for a pending ghost whose cards exist', () => {
    const board = fixture()
    expect(canApply(board, board.ghosts.gh1.command)).toBe(true)
    expect(canApply(board, board.ghosts.gh2.command)).toBe(true)
  })

  it('is false when a referenced card is gone or nothing would change', () => {
    const board = fixture()
    const withoutN3 = { ...board, nodes: { ...board.nodes } }
    delete withoutN3.nodes.n3
    expect(canApply(withoutN3, board.ghosts.gh1.command)).toBe(false)
    const duplicate: Command = {
      type: 'connect',
      payload: { edge: { ...board.edges.e1, id: 'x' } }
    }
    expect(canApply(board, duplicate)).toBe(false)
  })

  it('is false for a malformed command instead of throwing', () => {
    const bad = { type: 'connect', payload: {} } as unknown as Command
    expect(canApply(fixture(), bad)).toBe(false)
  })
})
