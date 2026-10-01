// Opening and leaving workspaces: swaps the board and session in and out around
// autosave so the swap itself is never saved and pending edits are never lost.
import type { CreateWorkspaceInput } from '@shared/api'
import type { Workspace } from '@shared/types'
import { useAppStore } from './appStore'
import { emptyBoard, useBoardStore } from './boardStore'
import { autosave } from './persistence'

/** Shows a loaded workspace exactly where the student left it. */
export function openWorkspace(ws: Workspace): void {
  autosave.pause()
  const { board, session, ...meta } = ws
  useBoardStore.getState().load(board)
  useAppStore.getState().showWorkspace(meta, session)
  autosave.resume()
}

export async function openWorkspaceById(id: string): Promise<void> {
  openWorkspace(await window.api.workspace.load(id))
}

export async function createAndOpenWorkspace(input: CreateWorkspaceInput): Promise<void> {
  openWorkspace(await window.api.workspace.create(input))
}

/** Saves pending changes, then returns to the home screen. */
export async function closeWorkspace(): Promise<void> {
  await autosave.flush()
  autosave.pause()
  useAppStore.getState().showHome()
  useBoardStore.getState().load(emptyBoard())
}
