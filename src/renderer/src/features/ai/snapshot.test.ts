import { describe, expect, it } from 'vitest'
import { BoardSnapshotSchema } from '@shared/schema'
import {
  makeBoard,
  makeEdge,
  makeGhost,
  makeGroup,
  makeNode,
  makeQuestion
} from '@shared/testing/factories'
import { buildSnapshot } from './snapshot'

const board = makeBoard({
  nodes: [
    makeQuestion({ title: '  How do cities fund adaptation?  ' }),
    makeNode({
      id: 'a',
      summary: 'One line',
      text: 'Body text',
      tags: ['flooding'],
      note: 'mine',
      highlights: [{ id: 'h', quote: 'a quote', createdAt: 1 }],
      parentGroupId: 'group-1',
      thumbnailPath: 'wa-thumb://ws/a.png',
      comments: [{ id: 'c', text: 'private', createdAt: 1 }],
      position: { x: 10, y: 20 }
    }),
    makeNode({ id: 'b', url: undefined })
  ],
  groups: [makeGroup()],
  edges: [makeEdge({ source: 'a', target: 'b' })],
  ghosts: [makeGhost()]
})

describe('buildSnapshot', () => {
  it('carries content, group membership and links, and passes the main-process schema', () => {
    const snap = buildSnapshot(board, { id: 'ws-1' })
    expect(BoardSnapshotSchema.safeParse(snap).success).toBe(true)
    expect(snap.workspaceId).toBe('ws-1')
    expect(snap.questionNodeId).toBe('question')
    expect(snap.researchQuestion).toBe('How do cities fund adaptation?')
    const a = snap.nodes.find((n) => n.id === 'a')!
    expect(a).toEqual({
      id: 'a',
      kind: 'webpage',
      title: 'Page a',
      url: 'https://example.com/a',
      summary: 'One line',
      text: 'Body text',
      tags: ['flooding'],
      note: 'mine',
      highlights: ['a quote'],
      groupId: 'group-1'
    })
    expect(snap.nodes.find((n) => n.id === 'b')).not.toHaveProperty('url')
    expect(snap.groups).toEqual([{ id: 'group-1', label: 'Funding models', memberIds: ['a'] }])
    expect(snap.edges).toEqual([{ source: 'a', target: 'b', relation: 'supports' }])
  })

  it('leaves out positions, thumbnails, comments and ghosts', () => {
    const json = JSON.stringify(buildSnapshot(board, { id: 'ws-1' }))
    expect(json).not.toContain('wa-thumb')
    expect(json).not.toContain('private')
    expect(json).not.toContain('position')
    expect(json).not.toContain('ghost')
  })

  it('falls back to the workspace question when the card is blank', () => {
    const b = makeBoard({ nodes: [makeQuestion({ title: ' ' })] })
    expect(buildSnapshot(b, { id: 'w', researchQuestion: 'Q?' }).researchQuestion).toBe('Q?')
    expect(buildSnapshot(b, { id: 'w' }).researchQuestion).toBeUndefined()
  })
})
