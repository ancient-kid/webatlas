import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  makeNode,
  makeWorkspace,
  makeWorkspaceFile,
  TINY_PNG_DATA_URL
} from '@shared/testing/factories'
import type { CanvasNode, Workspace } from '@shared/types'
import { saveThumb } from '../thumbs'
import { bakFile, indexFile, initPaths, thumbFile, wsDir, wsFile } from './paths'
import {
  createWorkspace,
  deleteWorkspace,
  duplicateWorkspace,
  importWorkspaceFile,
  listWorkspaces,
  loadWorkspace,
  saveWorkspace
} from './workspaceStore'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'wa-store-'))
  initPaths(dir)
})
afterEach(() => {
  vi.useRealTimers()
  rmSync(dir, { recursive: true, force: true })
})

const readIndex = (): unknown[] => JSON.parse(readFileSync(indexFile(), 'utf8'))

/** Adds a captured card to a workspace (as the renderer would before saving). */
function withCard(ws: Workspace, id: string, extra: Partial<CanvasNode> = {}): Workspace {
  return {
    ...ws,
    board: { ...ws.board, nodes: { ...ws.board.nodes, [id]: makeNode({ id, ...extra }) } }
  }
}

describe('createWorkspace', () => {
  it('creates a question card, a default session and an index entry', async () => {
    const ws = await createWorkspace({ name: '  Flood finance ', researchQuestion: ' Why? ' })
    expect(ws.name).toBe('Flood finance')
    expect(ws.researchQuestion).toBe('Why?')
    const nodes = Object.values(ws.board.nodes)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({ kind: 'question', title: 'Why?', position: { x: 0, y: 0 } })
    expect(ws.session).toMatchObject({
      viewMode: 'graph',
      captureMode: 'manual',
      browserOpen: true
    })
    expect(JSON.parse(readFileSync(wsFile(ws.id), 'utf8')).name).toBe('Flood finance')
    expect(readIndex()).toEqual([expect.objectContaining({ id: ws.id, nodeCount: 0 })])
  })

  it('needs a name; the question is optional', async () => {
    await expect(createWorkspace({ name: '   ' })).rejects.toThrow('A workspace needs a name')
    await expect(createWorkspace(null)).rejects.toThrow('A workspace needs a name')
    const ws = await createWorkspace({ name: 'No question' })
    expect(ws.researchQuestion).toBeUndefined()
  })
})

describe('listWorkspaces', () => {
  it('is empty when nothing exists yet', async () => {
    expect(await listWorkspaces()).toEqual([])
  })

  it('is sorted by last change, newest first', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1000)
    const a = await createWorkspace({ name: 'A' })
    vi.setSystemTime(2000)
    const b = await createWorkspace({ name: 'B' })
    vi.setSystemTime(3000)
    await saveWorkspace(a)
    expect((await listWorkspaces()).map((w) => w.name)).toEqual(['A', 'B'])
    expect(b.updatedAt).toBe(2000)
  })

  it('rebuilds a lost or damaged index from the workspace folders', async () => {
    const ws = await createWorkspace({ name: 'Survivor' })
    writeFileSync(indexFile(), '{ not json')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await listWorkspaces()).map((w) => w.id)).toEqual([ws.id])
    rmSync(indexFile())
    expect((await listWorkspaces()).map((w) => w.id)).toEqual([ws.id])
  })
})

describe('saveWorkspace', () => {
  it('updates the index counts without counting the question card', async () => {
    const ws = await createWorkspace({ name: 'Counts' })
    const next = withCard(withCard(ws, 'c1'), 'c2', {
      thumbnailPath: `wa-thumb://${ws.id}/c2.png?v=1`,
      capturedAt: 99
    })
    next.board.groups = {
      g1: {
        id: 'g1',
        label: 'G',
        color: 'teal',
        category: 'topic',
        position: { x: 0, y: 0 },
        size: { w: 100, h: 100 },
        note: '',
        comments: []
      }
    }
    await saveWorkspace(next)
    expect(readIndex()).toEqual([
      expect.objectContaining({
        nodeCount: 2,
        groupCount: 1,
        coverThumb: `wa-thumb://${ws.id}/c2.png?v=1`
      })
    ])
  })

  it('keeps the previous version as .bak', async () => {
    const ws = await createWorkspace({ name: 'First' })
    await saveWorkspace({ ...ws, name: 'Second' })
    expect(JSON.parse(readFileSync(bakFile(ws.id), 'utf8')).name).toBe('First')
    expect(JSON.parse(readFileSync(wsFile(ws.id), 'utf8')).name).toBe('Second')
  })

  it('rejects invalid data and never re-creates a deleted workspace', async () => {
    await expect(saveWorkspace({ hello: 'world' })).rejects.toThrow('Invalid workspace')
    await expect(saveWorkspace(makeWorkspace({ id: 'gone' }))).rejects.toThrow(
      'Workspace not found'
    )
    expect(existsSync(wsDir('gone'))).toBe(false)
  })

  it('rejects an id that could escape the workspaces folder', async () => {
    await expect(saveWorkspace(makeWorkspace({ id: '../evil' }))).rejects.toThrow(
      'Invalid workspace id'
    )
    await expect(loadWorkspace('../../etc')).rejects.toThrow('Invalid workspace id')
    await expect(deleteWorkspace('..')).rejects.toThrow('Invalid workspace id')
  })

  it('concurrent saves all land and the file stays valid', async () => {
    const ws = await createWorkspace({ name: 'Busy' })
    await Promise.all(Array.from({ length: 10 }, (_, i) => saveWorkspace({ ...ws, name: `v${i}` })))
    expect((await loadWorkspace(ws.id)).name).toBe('v9')
    expect(readdirSync(wsDir(ws.id)).sort()).toEqual(['workspace.json', 'workspace.json.bak'])
  })
})

describe('loadWorkspace', () => {
  it('falls back to .bak when workspace.json is damaged, and repairs it', async () => {
    const ws = await createWorkspace({ name: 'Original' })
    await saveWorkspace({ ...ws, name: 'Latest' })
    writeFileSync(wsFile(ws.id), '{"broken":')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await loadWorkspace(ws.id)).name).toBe('Original')
    expect(JSON.parse(readFileSync(wsFile(ws.id), 'utf8')).name).toBe('Original')
  })

  it('throws when both files are damaged', async () => {
    const ws = await createWorkspace({ name: 'Doomed' })
    await saveWorkspace(ws)
    writeFileSync(wsFile(ws.id), 'nope')
    writeFileSync(bakFile(ws.id), 'nope')
    await expect(loadWorkspace(ws.id)).rejects.toThrow('Workspace file is damaged')
  })

  it('reports a missing workspace', async () => {
    await expect(loadWorkspace('missing-1')).rejects.toThrow('Workspace not found')
  })
})

describe('deleteWorkspace', () => {
  it('removes the folder and the index entry', async () => {
    const keep = await createWorkspace({ name: 'Keep' })
    const drop = await createWorkspace({ name: 'Drop' })
    await deleteWorkspace(drop.id)
    expect(existsSync(wsDir(drop.id))).toBe(false)
    expect((await listWorkspaces()).map((w) => w.id)).toEqual([keep.id])
  })
})

describe('duplicateWorkspace', () => {
  it('copies thumbnails and points the copy’s cards at them', async () => {
    const ws = await createWorkspace({ name: 'Flood finance' })
    const url = await saveThumb(ws.id, 'c1', TINY_PNG_DATA_URL)
    await saveWorkspace(withCard(withCard(ws, 'c1', { thumbnailPath: url }), 'c2'))

    const copy = await duplicateWorkspace(ws.id)
    expect(copy.name).toBe('Flood finance (copy)')
    expect(copy.id).not.toBe(ws.id)
    const loaded = await loadWorkspace(copy.id)
    expect(loaded.board.nodes.c1.thumbnailPath).toMatch(
      new RegExp(`^wa-thumb://${copy.id}/c1\\.png`)
    )
    expect(loaded.board.nodes.c2.thumbnailPath).toBeUndefined()
    expect(existsSync(thumbFile(copy.id, 'c1'))).toBe(true)
    expect(copy.coverThumb).toBe(loaded.board.nodes.c1.thumbnailPath)
    expect((await listWorkspaces()).map((w) => w.name).sort()).toEqual([
      'Flood finance',
      'Flood finance (copy)'
    ])
  })
})

describe('importWorkspaceFile', () => {
  it('validates, assigns a new id and writes the thumbnails', async () => {
    const shared = makeWorkspace({ id: 'theirs' })
    const card = makeNode({ id: 'c1', thumbnailPath: 'wa-thumb://theirs/c1.png?v=1' })
    const orphan = makeNode({ id: 'c2', thumbnailPath: 'wa-thumb://theirs/c2.png?v=1' })
    shared.board.nodes = { ...shared.board.nodes, c1: card, c2: orphan }
    const file = makeWorkspaceFile({ workspace: shared, thumbs: { c1: TINY_PNG_DATA_URL } })

    const ws = await importWorkspaceFile(JSON.parse(JSON.stringify(file)))
    expect(ws.id).not.toBe('theirs')
    expect(ws.board.nodes.c1.thumbnailPath).toMatch(new RegExp(`^wa-thumb://${ws.id}/c1\\.png`))
    expect(ws.board.nodes.c2.thumbnailPath).toBeUndefined() // no image was shipped
    expect(existsSync(thumbFile(ws.id, 'c1'))).toBe(true)
    expect((await loadWorkspace(ws.id)).name).toBe(shared.name)
  })

  it('rejects anything that is not a WebAtlas workspace file', async () => {
    await expect(importWorkspaceFile({ name: 'package.json' })).rejects.toThrow(
      "This file isn't a WebAtlas workspace"
    )
    expect(await listWorkspaces()).toEqual([])
  })
})
