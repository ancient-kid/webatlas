// Workspace persistence: one JSON file per workspace plus index.json for the home screen.
// Every write is atomic; workspace.json.bak keeps the previous good version, so a damaged
// file falls back to it on load.
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import type { CreateWorkspaceInput } from '@shared/api'
import { parseWorkspace, parseWorkspaceFile, WorkspaceSummarySchema } from '@shared/schema'
import { defaultSession } from '@shared/session'
import type { CanvasNode, Workspace, WorkspaceSummary } from '@shared/types'
import { decodePng, thumbUrl } from '../thumbs'
import { atomicWrite, serialize } from './atomicWrite'
import {
  assertWorkspaceId,
  bakFile,
  embFile,
  indexFile,
  isNodeId,
  isWorkspaceId,
  thumbDir,
  thumbFile,
  workspacesRoot,
  wsDir,
  wsFile
} from './paths'

export const MAX_NAME_LENGTH = 120
export const MAX_QUESTION_LENGTH = 500

const INDEX_KEY = 'index'
const wsKey = (id: string): string => `ws:${id}`

// ─── index.json ────────────────────────────────────────────────────────────

/** The home-screen row for a workspace. The question card isn't counted. */
export function summarize(ws: Workspace): WorkspaceSummary {
  const nodes = Object.values(ws.board.nodes)
  const cover = nodes
    .filter((n) => n.thumbnailPath)
    .sort((a, b) => b.capturedAt - a.capturedAt)[0]?.thumbnailPath
  const summary: WorkspaceSummary = {
    id: ws.id,
    name: ws.name,
    updatedAt: ws.updatedAt,
    nodeCount: nodes.filter((n) => n.kind !== 'question').length,
    groupCount: Object.keys(ws.board.groups).length
  }
  if (ws.researchQuestion) summary.researchQuestion = ws.researchQuestion
  if (cover) summary.coverThumb = cover
  return summary
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

async function exists(file: string): Promise<boolean> {
  return fs.access(file).then(
    () => true,
    () => false
  )
}

/** Rebuilds the index by reading every workspace folder (used when index.json is lost). */
async function rebuildIndex(): Promise<WorkspaceSummary[]> {
  const entries = await fs.readdir(workspacesRoot(), { withFileTypes: true }).catch(() => [])
  const rows: WorkspaceSummary[] = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !isWorkspaceId(entry.name)) continue
    const ws = await readWorkspace(entry.name).catch(() => null)
    if (ws) rows.push(summarize(ws))
  }
  if (rows.length) await atomicWrite(indexFile(), JSON.stringify(rows, null, 2))
  return rows
}

async function readIndex(): Promise<WorkspaceSummary[]> {
  try {
    const data = await readJson(indexFile())
    if (!Array.isArray(data)) throw new Error('index is not a list')
    return data.map((row) => WorkspaceSummarySchema.parse(row) as WorkspaceSummary)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('[storage] index.json unreadable, rebuilding', err)
    }
    return rebuildIndex()
  }
}

/** Read-modify-write of the index, queued so concurrent updates never lose a row. */
function updateIndex(
  change: (rows: WorkspaceSummary[]) => WorkspaceSummary[]
): Promise<WorkspaceSummary[]> {
  return serialize(INDEX_KEY, async () => {
    const rows = change(await readIndex())
    await atomicWrite(indexFile(), JSON.stringify(rows, null, 2))
    return rows
  })
}

const upsertRow = (row: WorkspaceSummary) => (rows: WorkspaceSummary[]) => [
  ...rows.filter((r) => r.id !== row.id),
  row
]

// ─── workspace files ───────────────────────────────────────────────────────

/** Reads and validates one file; throws if it is missing or damaged. */
async function readValid(file: string): Promise<Workspace> {
  const parsed = parseWorkspace(await readJson(file))
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.value
}

/** Loads workspace.json, falling back to (and restoring from) the .bak copy. */
async function readWorkspace(id: string): Promise<Workspace> {
  try {
    return await readValid(wsFile(id))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT' && !(await exists(bakFile(id)))) {
      throw new Error('Workspace not found')
    }
    try {
      const ws = await readValid(bakFile(id))
      console.error('[storage] workspace.json damaged, restored from backup', id)
      await atomicWrite(wsFile(id), JSON.stringify(ws, null, 2))
      return ws
    } catch {
      throw new Error('Workspace file is damaged')
    }
  }
}

/** Writes a workspace and its index row. The current file becomes the .bak if it is valid. */
async function writeWorkspace(ws: Workspace, keepBackup: boolean): Promise<void> {
  if (keepBackup) {
    const current = await readValid(wsFile(ws.id)).catch(() => null)
    if (current) await atomicWrite(bakFile(ws.id), JSON.stringify(current, null, 2))
  }
  await atomicWrite(wsFile(ws.id), JSON.stringify(ws, null, 2))
  await updateIndex(upsertRow(summarize(ws)))
}

function validated(data: unknown): Workspace {
  const parsed = parseWorkspace(data)
  if (!parsed.ok) throw new Error(`Invalid workspace: ${parsed.error}`)
  assertWorkspaceId(parsed.value.id)
  return parsed.value
}

/** Points each card's thumbnail at this workspace when a file for it exists here; drops the rest. */
function retargetThumbs(ws: Workspace, hasThumb: (nodeId: string) => boolean): void {
  for (const node of Object.values(ws.board.nodes)) {
    if (hasThumb(node.id)) node.thumbnailPath = thumbUrl(ws.id, node.id)
    else delete node.thumbnailPath
  }
}

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

// ─── public API (one function per window.api.workspace method) ─────────────

export async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  const rows = await serialize(INDEX_KEY, readIndex)
  return [...rows].sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function loadWorkspace(id: unknown): Promise<Workspace> {
  const wsId = assertWorkspaceId(id)
  return serialize(wsKey(wsId), () => readWorkspace(wsId))
}

/** Saves an existing workspace (never re-creates a deleted one). Returns what was written. */
export async function saveWorkspace(data: unknown): Promise<Workspace> {
  const ws = validated(data)
  return serialize(wsKey(ws.id), async () => {
    if (!(await exists(wsFile(ws.id)))) throw new Error('Workspace not found')
    ws.updatedAt = Date.now()
    await writeWorkspace(ws, true)
    return ws
  })
}

export async function createWorkspace(input: CreateWorkspaceInput | unknown): Promise<Workspace> {
  const raw = (input ?? {}) as Partial<CreateWorkspaceInput>
  const name = cleanText(raw.name, MAX_NAME_LENGTH)
  if (!name) throw new Error('A workspace needs a name')
  const question = cleanText(raw.researchQuestion, MAX_QUESTION_LENGTH)
  const now = Date.now()
  const questionNode: CanvasNode = {
    id: randomUUID(),
    kind: 'question',
    title: question,
    highlights: [],
    note: '',
    comments: [],
    tags: [],
    position: { x: 0, y: 0 },
    capturedAt: now
  }
  const ws: Workspace = {
    version: 1,
    id: randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    session: defaultSession(),
    board: { nodes: { [questionNode.id]: questionNode }, groups: {}, edges: {}, ghosts: {} }
  }
  if (question) ws.researchQuestion = question
  await serialize(wsKey(ws.id), () => writeWorkspace(ws, false))
  return ws
}

export async function deleteWorkspace(id: unknown): Promise<void> {
  const wsId = assertWorkspaceId(id)
  return serialize(wsKey(wsId), async () => {
    await fs.rm(wsDir(wsId), { recursive: true, force: true })
    await updateIndex((rows) => rows.filter((r) => r.id !== wsId))
  })
}

/** Copies a workspace (with thumbnails and embeddings) as "<name> (copy)". */
export async function duplicateWorkspace(id: unknown): Promise<WorkspaceSummary> {
  const source = await loadWorkspace(id)
  const now = Date.now()
  const copy: Workspace = {
    ...structuredClone(source),
    id: randomUUID(),
    name: `${source.name} (copy)`.slice(0, MAX_NAME_LENGTH),
    createdAt: now,
    updatedAt: now
  }
  await serialize(wsKey(copy.id), async () => {
    if (await exists(thumbDir(source.id))) {
      await fs.cp(thumbDir(source.id), thumbDir(copy.id), { recursive: true })
    }
    if (await exists(embFile(source.id))) {
      await fs.mkdir(wsDir(copy.id), { recursive: true })
      await fs.copyFile(embFile(source.id), embFile(copy.id))
    }
    const copied = new Set(
      (await fs.readdir(thumbDir(copy.id)).catch(() => [])).map((f) => f.replace(/\.png$/, ''))
    )
    retargetThumbs(copy, (nodeId) => copied.has(nodeId))
    await writeWorkspace(copy, false)
  })
  return summarize(copy)
}

/** Imports a shared workspace file as a new workspace. Thumbnails come as PNG data URLs. */
export async function importWorkspaceFile(data: unknown): Promise<Workspace> {
  const parsed = parseWorkspaceFile(data)
  if (!parsed.ok) throw new Error("This file isn't a WebAtlas workspace")
  const file = parsed.value
  const now = Date.now()
  const ws: Workspace = {
    ...file.workspace,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    name: file.workspace.name.slice(0, MAX_NAME_LENGTH)
  }
  await serialize(wsKey(ws.id), async () => {
    const written = new Set<string>()
    for (const [nodeId, dataUrl] of Object.entries(file.thumbs ?? {})) {
      if (!isNodeId(nodeId) || !ws.board.nodes[nodeId]) continue
      try {
        await atomicWrite(thumbFile(ws.id, nodeId), decodePng(dataUrl))
        written.add(nodeId)
      } catch (err) {
        console.error('[storage] skipped an imported thumbnail', nodeId, err)
      }
    }
    retargetThumbs(ws, (nodeId) => written.has(nodeId))
    await writeWorkspace(ws, false)
  })
  return ws
}
