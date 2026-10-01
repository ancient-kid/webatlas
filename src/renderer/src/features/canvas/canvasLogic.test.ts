// @vitest-environment jsdom
// Pure canvas logic: board → React Flow, link geometry, drop targets, placement,
// keyboard mapping and link labels.
import { describe, expect, it } from 'vitest'
import { makeBoard, makeEdge, makeGroup, makeNode, makeQuestion } from '@shared/testing/factories'
import { boardToEdges, boardToFlow, type FlowNode } from './boardToFlow'
import { findDropGroup, linkEnds } from './geometry'
import { isTypingTarget, keyToAction } from './keyboard'
import { findFreeSpot } from './placement'
import { edgeTone, relationLabel } from './relations'

const board = makeBoard({
  nodes: [
    makeQuestion({ position: { x: 0, y: 0 } }),
    makeNode({ id: 'web', position: { x: 400, y: 0 }, size: { w: 300, h: 200 } }),
    makeNode({ id: 'video', kind: 'video', position: { x: 32, y: 64 }, parentGroupId: 'g1' }),
    makeNode({ id: 'note', kind: 'note', position: { x: 0, y: 400 } })
  ],
  groups: [makeGroup({ id: 'g1', position: { x: 800, y: 0 }, size: { w: 400, h: 300 } })],
  edges: [makeEdge({ id: 'e1', source: 'web', target: 'question' })]
})

describe('boardToFlow', () => {
  it('puts groups before every card and the question card last', () => {
    const nodes = boardToFlow(board)
    expect(nodes.map((n) => n.id)).toEqual(['g1', 'web', 'video', 'note', 'question'])
    expect(nodes.map((n) => n.type)).toEqual(['frame', 'card', 'card', 'note', 'question'])
  })

  it('children carry parentId and their position relative to the group', () => {
    const video = boardToFlow(board).find((n) => n.id === 'video')!
    expect(video.parentId).toBe('g1')
    expect(video.position).toEqual({ x: 32, y: 64 })
  })

  it('groups and resized cards get fixed sizes; other cards are measured', () => {
    const nodes = boardToFlow(board)
    expect(nodes[0]).toMatchObject({ width: 400, height: 300 })
    expect(nodes.find((n) => n.id === 'web')).toMatchObject({ width: 300, height: 200 })
    expect(nodes.find((n) => n.id === 'note')!.width).toBeUndefined()
  })

  it('carries measured, selected and dragging over by id', () => {
    const first = boardToFlow(board)
    const prev = first.map((n): FlowNode =>
      n.id === 'note'
        ? { ...n, measured: { width: 220, height: 90 }, selected: true, dragging: true }
        : n
    )
    const next = boardToFlow(board, prev).find((n) => n.id === 'note')!
    expect(next).toMatchObject({
      measured: { width: 220, height: 90 },
      selected: true,
      dragging: true
    })
  })

  it('seeds the selection from saved ids on the first build', () => {
    const nodes = boardToFlow(board, [], ['note', 'g1'])
    expect(
      nodes
        .filter((n) => n.selected)
        .map((n) => n.id)
        .sort()
    ).toEqual(['g1', 'note'])
  })

  it('edges are labeled edges that keep their selection', () => {
    const [edge] = boardToEdges(board)
    expect(edge).toMatchObject({ id: 'e1', type: 'labeled', source: 'web', target: 'question' })
    expect(boardToEdges(board, [{ ...edge, selected: true }])[0].selected).toBe(true)
  })
})

describe('link geometry', () => {
  const a = { x: 0, y: 0, w: 100, h: 50 }
  it('attaches to facing sides: left/right when apart horizontally', () => {
    expect(linkEnds(a, { x: 300, y: 20, w: 100, h: 50 })).toEqual({
      source: { x: 100, y: 25 },
      target: { x: 300, y: 45 },
      sourceSide: 'right',
      targetSide: 'left'
    })
  })

  it('top/bottom when apart vertically', () => {
    const ends = linkEnds(a, { x: 0, y: -300, w: 100, h: 50 })
    expect([ends.sourceSide, ends.targetSide]).toEqual(['top', 'bottom'])
  })

  it('a card dropped on overlapping groups joins the smallest one under its centre', () => {
    const groups = [
      { id: 'big', x: 0, y: 0, w: 1000, h: 1000 },
      { id: 'small', x: 100, y: 100, w: 300, h: 300 }
    ]
    expect(findDropGroup({ x: 150, y: 150, w: 100, h: 100 }, groups)).toBe('small')
    expect(findDropGroup({ x: 700, y: 700, w: 100, h: 100 }, groups)).toBe('big')
    expect(findDropGroup({ x: 2000, y: 0, w: 100, h: 100 }, groups)).toBeNull()
  })
})

describe('findFreeSpot', () => {
  it('returns the spot itself when it is free', () => {
    expect(findFreeSpot(makeBoard(), { x: 1000, y: 1000 })).toEqual({ x: 992, y: 992 })
  })

  it('moves right past cards and groups (with a margin)', () => {
    const b = makeBoard({ nodes: [makeQuestion({ position: { x: 0, y: 0 } })] })
    // The question card (320 × 240) covers the start; one column over (x 288) is still
    // inside its 16px margin, so the card lands two columns over.
    expect(findFreeSpot(b, { x: 0, y: 0 })).toEqual({ x: 576, y: 0 })
  })

  it('falls back to the starting point when the whole area is taken', () => {
    const wall = makeGroup({
      id: 'wall',
      position: { x: -100, y: -100 },
      size: { w: 5000, h: 5000 }
    })
    const b = makeBoard({ groups: [wall] })
    expect(findFreeSpot(b, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 })
  })
})

describe('keyboard', () => {
  const key = (
    k: string,
    mods: Partial<KeyboardEvent> = {},
    target: EventTarget | null = null
  ): ReturnType<typeof keyToAction> =>
    keyToAction({
      key: k,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      target,
      ...mods
    } as KeyboardEvent)

  it.each([
    ['Delete', {}, { type: 'delete' }],
    ['Backspace', {}, { type: 'delete' }],
    ['z', { ctrlKey: true }, { type: 'undo' }],
    ['Z', { ctrlKey: true, shiftKey: true }, { type: 'redo' }],
    ['y', { ctrlKey: true }, { type: 'redo' }],
    ['a', { ctrlKey: true }, { type: 'selectAll' }],
    ['Escape', {}, { type: 'clearSelection' }],
    ['ArrowLeft', {}, { type: 'nudge', dx: -32, dy: 0 }],
    ['ArrowRight', {}, { type: 'nudge', dx: 32, dy: 0 }],
    ['ArrowUp', {}, { type: 'nudge', dx: 0, dy: -32 }],
    ['ArrowDown', {}, { type: 'nudge', dx: 0, dy: 32 }]
  ] as const)('%s %j → %j', (k, mods, action) => {
    expect(key(k, mods)).toEqual(action)
  })

  it('ignores keys it does not own', () => {
    expect(key('b', { ctrlKey: true })).toBeNull()
    expect(key('x')).toBeNull()
    expect(key('Delete', { altKey: true })).toBeNull()
  })

  it('is ignored while typing in an input, textarea or editable text', () => {
    const input = document.createElement('input')
    const textarea = document.createElement('textarea')
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    const inside = document.createElement('span')
    editable.append(inside)
    for (const target of [input, textarea, inside]) {
      expect(isTypingTarget(target)).toBe(true)
      expect(key('z', { ctrlKey: true }, target)).toBeNull()
      expect(key('Delete', {}, target)).toBeNull()
    }
    expect(isTypingTarget(document.createElement('div'))).toBe(false)
  })
})

describe('link labels', () => {
  it('uses verbs, the custom label, and the right tone', () => {
    expect(relationLabel({ relation: 'opened-from' })).toBe('opened from')
    expect(relationLabel({ relation: 'source-of' })).toBe('source of')
    expect(relationLabel({ relation: 'custom', label: 'cites' })).toBe('cites')
    expect(edgeTone({ origin: 'user' })).toBe('neutral')
    expect(edgeTone({ origin: 'ai' })).toBe('brand')
    expect(edgeTone({ origin: 'user', color: 'rose' })).toBe('cat-rose')
  })
})
