// The typed bridge: window.api is the renderer's only way to reach the main process.
// Sandboxed preloads may only require('electron'); @shared/api contributes types and
// constants that are bundled in.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { CHANNELS, RENDERER_EVENTS, type RendererEvent, type WebAtlasApi } from '@shared/api'

const on: WebAtlasApi['on'] = (event, callback) => {
  if (!(RENDERER_EVENTS as readonly string[]).includes(event)) {
    throw new Error(`Unknown event: ${String(event)}`)
  }
  const listener = (_e: IpcRendererEvent, ...args: unknown[]): void =>
    (callback as (...a: unknown[]) => void)(...args)
  ipcRenderer.on(event as RendererEvent, listener)
  return () => {
    ipcRenderer.removeListener(event, listener)
  }
}

const api: WebAtlasApi = {
  workspace: {
    list: () => ipcRenderer.invoke(CHANNELS['workspace.list']),
    load: (id) => ipcRenderer.invoke(CHANNELS['workspace.load'], id),
    save: (workspace) => ipcRenderer.invoke(CHANNELS['workspace.save'], workspace),
    create: (input) => ipcRenderer.invoke(CHANNELS['workspace.create'], input),
    delete: (id) => ipcRenderer.invoke(CHANNELS['workspace.delete'], id),
    duplicate: (id) => ipcRenderer.invoke(CHANNELS['workspace.duplicate'], id)
  },
  thumb: {
    save: (workspaceId, nodeId, pngDataUrl) =>
      ipcRenderer.invoke(CHANNELS['thumb.save'], workspaceId, nodeId, pngDataUrl)
  },
  ai: {
    embed: (workspaceId, items) => ipcRenderer.invoke(CHANNELS['ai.embed'], workspaceId, items),
    summarize: (text) => ipcRenderer.invoke(CHANNELS['ai.summarize'], text),
    organize: (snapshot) => ipcRenderer.invoke(CHANNELS['ai.organize'], snapshot),
    status: () => ipcRenderer.invoke(CHANNELS['ai.status'])
  },
  export: {
    save: (format, content, suggestedName) =>
      ipcRenderer.invoke(CHANNELS['export.save'], format, content, suggestedName)
  },
  import: {
    workspace: () => ipcRenderer.invoke(CHANNELS['import.workspace']),
    sample: () => ipcRenderer.invoke(CHANNELS['import.sample'])
  },
  app: {
    readyToClose: () => ipcRenderer.send(CHANNELS['app.readyToClose'])
  },
  on
}

contextBridge.exposeInMainWorld('api', api)

// Test runs only: lets the renderer install its read-only window.__waDebug hooks.
if (process.argv.includes('--wa-e2e')) contextBridge.exposeInMainWorld('waE2E', true)
