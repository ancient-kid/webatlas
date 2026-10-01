import { describe, expect, it } from 'vitest'
import { makeBoard, makeGroup, makeNode } from '../testing/factories'
import { absolutePosition, CARD_HEIGHT, nodeSize, toGroupSpace } from './geometry'

const board = makeBoard({ groups: [makeGroup({ id: 'g1', position: { x: 100, y: 200 } })] })

describe('geometry', () => {
  it('absolutePosition adds the parent group’s position', () => {
    expect(
      absolutePosition(makeNode({ position: { x: 10, y: 20 }, parentGroupId: 'g1' }), board)
    ).toEqual({ x: 110, y: 220 })
    expect(absolutePosition(makeNode({ position: { x: 10, y: 20 } }), board)).toEqual({
      x: 10,
      y: 20
    })
  })

  it('an unknown parent is treated as no parent', () => {
    expect(
      absolutePosition(makeNode({ position: { x: 1, y: 2 }, parentGroupId: 'gone' }), board)
    ).toEqual({ x: 1, y: 2 })
  })

  it('toGroupSpace is the reverse of absolutePosition', () => {
    expect(toGroupSpace({ x: 110, y: 220 }, 'g1', board)).toEqual({ x: 10, y: 20 })
    expect(toGroupSpace({ x: 110, y: 220 }, null, board)).toEqual({ x: 110, y: 220 })
  })

  it('nodeSize uses the resize, else the default width for the kind', () => {
    expect(nodeSize({ kind: 'note' })).toEqual({ w: 220, h: CARD_HEIGHT })
    expect(nodeSize({ kind: 'webpage' })).toEqual({ w: 260, h: CARD_HEIGHT })
    expect(nodeSize({ kind: 'pdf', size: { w: 400, h: 300 } })).toEqual({ w: 400, h: 300 })
  })
})
