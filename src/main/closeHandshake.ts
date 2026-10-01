// Closing the window never loses work: main asks the renderer to flush its pending saves
// ('app:before-close'), waits for 'app:ready-to-close' (or a timeout if the renderer is
// stuck), lets main's own queued writes finish, and only then destroys the window.
import { ipcMain, type BrowserWindow, type IpcMainEvent } from 'electron'
import { CHANNELS } from '@shared/api'

export const CLOSE_TIMEOUT_MS = 1500

export function installCloseHandshake(
  win: BrowserWindow,
  flushMain: () => Promise<void>,
  timeoutMs = CLOSE_TIMEOUT_MS
): void {
  let closing = false

  win.on('close', (event) => {
    event.preventDefault()
    if (closing) return
    closing = true

    const rendererReady = new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        console.error('[close] renderer did not confirm its saves in time')
        done()
      }, timeoutMs)
      const onReady = (e: IpcMainEvent): void => {
        if (e.sender === win.webContents) done()
      }
      function done(): void {
        clearTimeout(timer)
        ipcMain.removeListener(CHANNELS['app.readyToClose'], onReady)
        resolve()
      }
      ipcMain.on(CHANNELS['app.readyToClose'], onReady)
    })

    if (!win.webContents.isDestroyed()) win.webContents.send('app:before-close')
    void rendererReady
      .then(flushMain)
      .catch((err) => console.error('[close] flush failed', err))
      .finally(() => {
        if (!win.isDestroyed()) win.destroy()
      })
  })
}
