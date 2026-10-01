import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'
import {
  CanvasNodeSchema,
  EdgeSchema,
  GhostSchema,
  GroupSchema,
  SessionSchema,
  WorkspaceSummarySchema,
  parseBoard,
  parseWorkspace,
  parseWorkspaceFile
} from './schema'
import {
  makeBoard,
  makeEdge,
  makeGhost,
  makeGroup,
  makeNode,
  makeQuestion,
  makeWorkspace,
  makeWorkspaceFile
} from './testing/factories'
import type { CanvasNode, Edge, Ghost, Group, Session, Workspace, WorkspaceSummary } from './types'

/** Deep clone, then let a test break one field. */
function mutated<T>(value: T, change: (copy: T) => void): T {
  const copy = structuredClone(value)
  change(copy)
  return copy
}

describe('schemas produce exactly the types in types.ts', () => {
  it('matches field for field', () => {
    expectTypeOf<z.infer<typeof CanvasNodeSchema>>().toEqualTypeOf<CanvasNode>()
    expectTypeOf<z.infer<typeof GroupSchema>>().toEqualTypeOf<Group>()
    expectTypeOf<z.infer<typeof EdgeSchema>>().toEqualTypeOf<Edge>()
    expectTypeOf<z.infer<typeof GhostSchema>>().toEqualTypeOf<Ghost>()
    expectTypeOf<z.infer<typeof SessionSchema>>().toEqualTypeOf<Session>()
    expectTypeOf<z.infer<typeof WorkspaceSummarySchema>>().toEqualTypeOf<WorkspaceSummary>()
  })
})

describe('parseWorkspace', () => {
  it('accepts a minimal valid workspace', () => {
    const ws = makeWorkspace()
    const r = parseWorkspace(ws)
    expect(r).toEqual({ ok: true, value: ws })
  })

  it('accepts a full board with every kind of item', () => {
    const ws = makeWorkspace({
      board: makeBoard({
        nodes: [
          makeNode({ id: 'node-1', parentGroupId: 'group-1', tags: ['policy'], color: 'rose' }),
          makeNode({
            id: 'node-2',
            kind: 'video',
            capturedFromNodeId: 'node-1',
            size: { w: 300, h: 260 },
            highlights: [{ id: 'h1', quote: 'Insurance pools shift cost.', createdAt: 1 }],
            comments: [{ id: 'c1', text: 'Check this', createdAt: 2 }]
          }),
          makeNode({ id: 'note-1', kind: 'note', url: undefined, title: 'Green bonds' })
        ],
        groups: [makeGroup()],
        edges: [
          makeEdge(),
          makeEdge({
            id: 'edge-2',
            source: 'node-1',
            target: 'node-2',
            relation: 'opened-from',
            origin: 'provenance'
          })
        ],
        ghosts: [makeGhost()]
      })
    })
    expect(parseWorkspace(ws).ok).toBe(true)
  })

  it.each(['version', 'id', 'name', 'createdAt', 'updatedAt', 'session', 'board'] as const)(
    'rejects a workspace without "%s"',
    (field) => {
      const ws = mutated(makeWorkspace(), (w) => {
        delete (w as Partial<Workspace>)[field]
      })
      expect(parseWorkspace(ws).ok).toBe(false)
    }
  )

  it.each([
    'viewport',
    'selectedIds',
    'browserUrl',
    'viewMode',
    'captureMode',
    'browserOpen',
    'splitRatio'
  ] as const)('rejects a session without "%s"', (field) => {
    const ws = mutated(makeWorkspace(), (w) => {
      delete (w.session as Partial<Session>)[field]
    })
    expect(parseWorkspace(ws).ok).toBe(false)
  })

  it.each([
    'kind',
    'title',
    'highlights',
    'note',
    'comments',
    'tags',
    'position',
    'capturedAt'
  ] as const)('rejects a card without "%s"', (field) => {
    const node = mutated(makeNode(), (n) => {
      delete (n as Partial<CanvasNode>)[field]
    })
    expect(parseBoard(makeBoard({ nodes: [node] })).ok).toBe(false)
  })

  it('rejects a wrong version', () => {
    const r = parseWorkspace({ ...makeWorkspace(), version: 2 })
    expect(r.ok).toBe(false)
  })

  it('rejects an unknown card kind, colour, relation or view mode', () => {
    expect(parseBoard(makeBoard({ nodes: [makeNode({ kind: 'tweet' as never })] })).ok).toBe(false)
    expect(parseBoard(makeBoard({ nodes: [makeNode({ color: 'green' as never })] })).ok).toBe(false)
    expect(
      parseBoard(
        makeBoard({ nodes: [makeNode()], edges: [makeEdge({ relation: 'likes' as never })] })
      ).ok
    ).toBe(false)
    expect(
      parseWorkspace(mutated(makeWorkspace(), (w) => (w.session.viewMode = 'grid' as never))).ok
    ).toBe(false)
  })

  it('rejects a split ratio outside 20–80 and a non-positive zoom', () => {
    expect(parseWorkspace(mutated(makeWorkspace(), (w) => (w.session.splitRatio = 5))).ok).toBe(
      false
    )
    expect(parseWorkspace(mutated(makeWorkspace(), (w) => (w.session.splitRatio = 95))).ok).toBe(
      false
    )
    expect(parseWorkspace(mutated(makeWorkspace(), (w) => (w.session.viewport.zoom = 0))).ok).toBe(
      false
    )
  })

  it('rejects a ghost confidence outside 0–1 and an unknown command type', () => {
    const board = (ghost: Ghost): unknown => makeBoard({ nodes: [makeNode()], ghosts: [ghost] })
    expect(parseBoard(board(makeGhost({ confidence: 1.2 }))).ok).toBe(false)
    expect(
      parseBoard(board(makeGhost({ command: { type: 'deleteEverything', payload: {} } as never })))
        .ok
    ).toBe(false)
  })

  it('strips unknown extra fields instead of failing', () => {
    const ws = { ...makeWorkspace(), futureField: 42 }
    const r = parseWorkspace(ws)
    expect(r.ok).toBe(true)
    if (r.ok) expect('futureField' in r.value).toBe(false)
  })

  it('returns a readable error message and never throws', () => {
    for (const junk of [null, 42, 'text', [], {}, { version: 1 }]) {
      const r = parseWorkspace(junk)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.length).toBeGreaterThan(0)
    }
  })
})

describe('board integrity', () => {
  it('requires exactly one research-question card', () => {
    const none = makeBoard({ nodes: [makeNode()] })
    delete none.nodes.question
    expect(parseBoard(none)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/exactly one research-question/)
    })
    const two = makeBoard({ nodes: [makeQuestion(), makeQuestion({ id: 'question-2' })] })
    expect(parseBoard(two).ok).toBe(false)
  })

  it('requires record keys to match item ids', () => {
    const board = makeBoard({ nodes: [makeNode()] })
    board.nodes['wrong-key'] = board.nodes['node-1']
    delete board.nodes['node-1']
    expect(parseBoard(board)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/does not match key/)
    })
  })

  it('rejects an edge to a card that does not exist', () => {
    const board = makeBoard({ nodes: [makeNode()], edges: [makeEdge({ target: 'ghost-node' })] })
    expect(parseBoard(board)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/Unknown node "ghost-node"/)
    })
  })

  it('rejects a card inside a group that does not exist', () => {
    const board = makeBoard({ nodes: [makeNode({ parentGroupId: 'missing' })] })
    expect(parseBoard(board)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/Unknown group/)
    })
  })

  it('rejects the research question inside a group', () => {
    const board = makeBoard({
      nodes: [makeQuestion({ parentGroupId: 'group-1' })],
      groups: [makeGroup()]
    })
    expect(parseBoard(board).ok).toBe(false)
  })
})

describe('parseWorkspaceFile', () => {
  it('accepts a file with and without thumbnails', () => {
    expect(parseWorkspaceFile(makeWorkspaceFile()).ok).toBe(true)
    const withThumbs = makeWorkspaceFile({
      thumbs: { 'node-1': 'data:image/png;base64,iVBORw0KGgo=' }
    })
    expect(parseWorkspaceFile(withThumbs).ok).toBe(true)
  })

  it('rejects files that are not WebAtlas workspaces', () => {
    const packageJson = { name: 'webatlas', version: '0.1.0', scripts: {} }
    expect(parseWorkspaceFile(packageJson).ok).toBe(false)
    expect(parseWorkspaceFile({ ...makeWorkspaceFile(), format: 'obsidian' }).ok).toBe(false)
    expect(parseWorkspaceFile({ ...makeWorkspaceFile(), version: 2 }).ok).toBe(false)
    expect(parseWorkspaceFile(null).ok).toBe(false)
  })

  it('rejects thumbnails that are not PNG data URLs', () => {
    const bad = makeWorkspaceFile({ thumbs: { 'node-1': 'https://evil.example/x.png' } })
    expect(parseWorkspaceFile(bad).ok).toBe(false)
  })

  it('rejects a file whose workspace is invalid', () => {
    const file = mutated(makeWorkspaceFile(), (f) => {
      delete (f.workspace as Partial<Workspace>).board
    })
    expect(parseWorkspaceFile(file)).toMatchObject({
      ok: false,
      error: expect.stringContaining('board')
    })
  })
})
