// Registers a handler for every window.api request method. This is the only surface
// between the renderer and the main process; arguments are validated here because the
// renderer is untrusted. app.readyToClose is handled by the close handshake instead.
import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { CHANNELS, type ApiMethod } from '@shared/api'
import type { OrganizeResult } from '@shared/types'
import { aiStatus } from './env'
import { importFromDialog, saveExport } from './exportImport'
import {
  createWorkspace,
  deleteWorkspace,
  duplicateWorkspace,
  listWorkspaces,
  loadWorkspace,
  saveWorkspace
} from './storage/workspaceStore'
import { saveThumb } from './thumbs'

type Handler = (...args: unknown[]) => unknown

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  const handle = (method: Exclude<ApiMethod, 'app.readyToClose'>, fn: Handler): void => {
    const channel = CHANNELS[method]
    ipcMain.handle(channel, async (event: IpcMainInvokeEvent, ...args: unknown[]) => {
      // Only the app window may call in (webview guests have no preload, but be explicit).
      if (event.sender !== getWindow()?.webContents) throw new Error('Untrusted sender')
      try {
        return await fn(...args)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[ipc]', channel, message)
        throw new Error(message)
      }
    })
  }

  handle('workspace.list', () => listWorkspaces())
  handle('workspace.load', (id) => loadWorkspace(id))
  // window.api promises void; the saved copy stays in main.
  handle('workspace.save', async (ws) => {
    await saveWorkspace(ws)
  })
  handle('workspace.create', (input) => createWorkspace(input))
  handle('workspace.delete', (id) => deleteWorkspace(id))
  handle('workspace.duplicate', (id) => duplicateWorkspace(id))

  handle('thumb.save', (ws, nodeId, dataUrl) => saveThumb(ws, nodeId, dataUrl))

  // AI: stubs until T11 (summaries) and T17 (embeddings, Organize).
  handle('ai.embed', () => ({}))
  handle('ai.summarize', () => '')
  handle('ai.organize', (): OrganizeResult => ({
    ghosts: [],
    mode: 'offline',
    message: 'Organize is not built yet.'
  }))
  handle('ai.status', () => aiStatus())

  handle('export.save', (format, content, name) => saveExport(getWindow(), format, content, name))
  handle('import.workspace', () => importFromDialog(getWindow()))
  handle('import.sample', () => {
    throw new Error('The sample workspace is not available yet.')
  })
}
