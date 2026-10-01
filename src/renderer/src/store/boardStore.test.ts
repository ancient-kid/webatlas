import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBoard, makeGhost, makeNode } from '@shared/testing/factories'
import type { Command } from '@shared/types'
import { createBoardStore, HISTORY_LIMIT } from './boardStore'

let store: ReturnType<typeof createBoardStore>
const s = (): ReturnType<typeof store.getState> => store.getState()

const move = (x: number): Command => ({
  type: 'moveItems',
  payload: { moves: [{ id: 'n1', to: { x, y: 0 } }] }
})

beforeEach(() => {
  store = createBoardStore()
  s().load(makeBoard({ nodes: [makeNode({ id: 'n1' })] }))
})

describe('boardStore', () => {
  it('dispatch applies the command, records history and clears redo', () => {
    s().dispatch(move(10))
    s().undo()
    expect(s().canRedo()).toBe(true)
    expect(s().dispatch(move(20))).toBe(true)
    expect(s().board.nodes.n1.position.x).toBe(20)
    expect(s().past).toHaveLength(1)
    expect(s().canRedo()).toBe(false)
  })

  it('a command that changes nothing returns false and records nothing', () => {
    expect(s().dispatch(move(0))).toBe(false) // already at x 0
    expect(s().dispatch({ type: 'removeNodes', payload: { ids: ['question'] } })).toBe(false)
    expect(s().past).toHaveLength(0)
  })

  it('undo and redo move one step at a time', () => {
    s().dispatch(move(10))
    s().dispatch(move(20))
    expect(s().undo()).toBe(true)
    expect(s().board.nodes.n1.position.x).toBe(10)
    expect(s().undo()).toBe(true)
    expect(s().board.nodes.n1.position.x).toBe(0)
    expect(s().redo()).toBe(true)
    expect(s().board.nodes.n1.position.x).toBe(10)
    expect(s().redo()).toBe(true)
    expect(s().board.nodes.n1.position.x).toBe(20)
  })

  it('undo and redo with empty stacks do nothing', () => {
    const before = s().board
    expect(s().undo()).toBe(false)
    expect(s().redo()).toBe(false)
    expect(s().board).toBe(before)
    expect(s().canUndo()).toBe(false)
  })

  it(`keeps at most ${HISTORY_LIMIT} undo steps`, () => {
    for (let i = 1; i <= HISTORY_LIMIT + 5; i++) s().dispatch(move(i))
    expect(s().past).toHaveLength(HISTORY_LIMIT)
    while (s().undo());
    // The 5 oldest steps fell off, so undo stops at x = 5.
    expect(s().board.nodes.n1.position.x).toBe(5)
  })

  it('load replaces the board and clears history', () => {
    s().dispatch(move(10))
    s().undo()
    s().load(makeBoard())
    expect(s().board.nodes.n1).toBeUndefined()
    expect(s().past).toHaveLength(0)
    expect(s().future).toHaveLength(0)
  })

  it('patchSilently and setGhosts change the board without an undo step', () => {
    s().patchSilently((d) => {
      d.nodes.n1.summary = 'Arrived later'
    })
    s().setGhosts([makeGhost({ id: 'gA' }), makeGhost({ id: 'gB' })])
    expect(s().board.nodes.n1.summary).toBe('Arrived later')
    expect(Object.keys(s().board.ghosts)).toEqual(['gA', 'gB'])
    expect(s().past).toHaveLength(0)
    s().setGhosts([])
    expect(s().board.ghosts).toEqual({})
  })

  it('dispatch → undo → redo gives an identical board', () => {
    const cmd: Command = {
      type: 'batch',
      payload: {
        commands: [
          {
            type: 'addNodes',
            payload: { nodes: [makeNode({ id: 'n2', position: { x: 300, y: 0 } })] }
          },
          {
            type: 'createGroup',
            payload: {
              group: { id: 'g1', label: 'Pair', color: 'teal', category: 'topic' },
              memberIds: ['n1', 'n2']
            }
          }
        ]
      }
    }
    s().dispatch(cmd)
    const after = s().board
    s().undo()
    s().redo()
    expect(s().board).toStrictEqual(after)
  })

  it('never shares payload objects with the board (history stays intact)', () => {
    const node = makeNode({ id: 'n2' })
    s().dispatch({ type: 'addNodes', payload: { nodes: [node] } })
    s().dispatch({ type: 'addTags', payload: { nodeIds: ['n2'], tag: 'policy' } })
    expect(s().board.nodes.n2.tags).toEqual(['policy'])
    expect(node.tags).toEqual([])
  })

  it('the board is frozen, so accidental mutation throws', () => {
    expect(() => {
      ;(s().board.nodes.n1 as { title: string }).title = 'x'
    }).toThrow()
  })

  it('a failing command is logged and changes nothing', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const before = s().board
    expect(s().dispatch({ type: 'nope', payload: {} } as unknown as Command)).toBe(false)
    expect(s().board).toBe(before)
    expect(error).toHaveBeenCalledWith('[board] command failed', 'nope', expect.any(Error))
  })
})
