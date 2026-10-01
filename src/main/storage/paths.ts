// Where workspaces live on disk, under <userData>/workspaces:
//   index.json                       the home-screen list
//   <id>/workspace.json (+ .bak)     the workspace
//   <id>/embeddings.json             cached vectors (T17)
//   <id>/thumbs/<nodeId>.png         card thumbnails
// Every id is validated before it becomes part of a path (no "../" tricks).
import { join } from 'node:path'

/** Workspace ids are lowercase: they are the host of `wa-thumb://` URLs, which Chromium lowercases. */
const WORKSPACE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/
const NODE_ID = /^[A-Za-z0-9_-]{1,128}$/

let root: string | null = null

/** Sets the workspaces folder. Called once at startup (and by tests with a temp dir). */
export function initPaths(workspacesRoot: string): void {
  root = workspacesRoot
}

export function workspacesRoot(): string {
  if (!root) throw new Error('Storage paths are not initialised')
  return root
}

export function isWorkspaceId(id: unknown): id is string {
  return typeof id === 'string' && WORKSPACE_ID.test(id)
}

export function isNodeId(id: unknown): id is string {
  return typeof id === 'string' && NODE_ID.test(id)
}

export function assertWorkspaceId(id: unknown): string {
  if (!isWorkspaceId(id)) throw new Error('Invalid workspace id')
  return id
}

export function assertNodeId(id: unknown): string {
  if (!isNodeId(id)) throw new Error('Invalid card id')
  return id
}

export const indexFile = (): string => join(workspacesRoot(), 'index.json')
export const wsDir = (id: string): string => join(workspacesRoot(), assertWorkspaceId(id))
export const wsFile = (id: string): string => join(wsDir(id), 'workspace.json')
export const bakFile = (id: string): string => join(wsDir(id), 'workspace.json.bak')
export const embFile = (id: string): string => join(wsDir(id), 'embeddings.json')
export const thumbDir = (id: string): string => join(wsDir(id), 'thumbs')
export const thumbFile = (id: string, nodeId: string): string =>
  join(thumbDir(id), `${assertNodeId(nodeId)}.png`)
