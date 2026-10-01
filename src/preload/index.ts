import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { RENDERER_EVENTS, type RendererEvent, type WebAtlasApi } from '@shared/api'

// The request/response methods of window.api are added with their main-process
// handlers in T06. Until then the renderer can only subscribe to whitelisted events.
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

contextBridge.exposeInMainWorld('api', Object.freeze({ on }))
