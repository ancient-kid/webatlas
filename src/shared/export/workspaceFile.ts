import type { Workspace, WorkspaceFile } from '../types'

/** Wraps a workspace in the WebAtlas exchange format. */
export function toWorkspaceFile(ws: Workspace): WorkspaceFile {
  return {
    format: 'webatlas',
    version: 1,
    workspace: ws
  }
}
