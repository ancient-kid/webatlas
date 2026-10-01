import { app, shell, BrowserWindow, Menu, protocol, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { installCloseHandshake } from './closeHandshake'
import { loadEnv } from './env'
import { buildAppMenu } from './menu'
import { registerIpc } from './ipc'
import { pendingWrites } from './storage/atomicWrite'
import { initPaths } from './storage/paths'
import { serveThumb, THUMB_SCHEME } from './thumbs'

/** Session partition used by the embedded browser pane (its own cookie jar). */
export const BROWSE_PARTITION = 'persist:webatlas-browse'

const isE2E = process.env.WA_E2E === '1'

// Test-only: isolate app data per E2E run. Must run before `app` is ready.
if (isE2E && process.env.WA_USER_DATA) {
  app.setPath('userData', process.env.WA_USER_DATA)
}

loadEnv()

// Thumbnails are served to the sandboxed renderer through wa-thumb:// (must be registered before ready).
protocol.registerSchemesAsPrivileged([
  {
    scheme: THUMB_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
  }
])

let mainWindow: BrowserWindow | null = null

function isAppUrl(url: string): boolean {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (is.dev && devUrl && url.startsWith(devUrl)) return true
  return url.startsWith('file://')
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'WebAtlas',
    autoHideMenuBar: true,
    backgroundColor: '#f3efe6',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      // Tells the preload to expose the read-only test hooks (window.waE2E).
      additionalArguments: isE2E ? ['--wa-e2e'] : []
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Pending saves are flushed before the window really closes.
  installCloseHandshake(mainWindow, pendingWrites)

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // The app window itself never opens popups or navigates away from the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) event.preventDefault()
  })

  // Every <webview> guest is forced into an isolated, preload-free sandbox.
  mainWindow.webContents.on('will-attach-webview', (_event, webPreferences, params) => {
    delete webPreferences.preload
    webPreferences.nodeIntegration = false
    webPreferences.nodeIntegrationInSubFrames = false
    webPreferences.contextIsolation = true
    webPreferences.sandbox = true
    // Guests always use the browsing partition, whatever the renderer asked for.
    // (Electron reads it from webPreferences; params is kept in sync for clarity.)
    webPreferences.partition = BROWSE_PARTITION
    params.partition = BROWSE_PARTITION
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Popups from the embedded browser open in the same pane: the renderer is told
// the URL and navigates its webview to it.
app.on('web-contents-created', (_event, contents) => {
  if (contents.getType() !== 'webview') return
  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) mainWindow?.webContents.send('browser:open-url', url)
    return { action: 'deny' }
  })
})

/** Development: switches the window between the app and the component gallery (?gallery). */
function toggleGallery(): void {
  const wc = mainWindow?.webContents
  if (!wc) return
  const url = new URL(wc.getURL())
  if (url.searchParams.has('gallery')) url.searchParams.delete('gallery')
  else url.searchParams.set('gallery', '')
  void wc.loadURL(url.toString())
}

/** Where the embedding model is cached. Tests may share one cache via WA_MODEL_CACHE. */
function modelCacheDir(): string {
  return process.env.WA_MODEL_CACHE || join(app.getPath('userData'), 'models')
}

/** Spike 2 (T03): load MiniLM in main, embed three sentences and log the result. */
async function runEmbeddingSpike(): Promise<void> {
  const cacheDir = modelCacheDir()
  console.info(`[embed-spike] loading ${cacheDir}`)
  try {
    const { runEmbedSpike } = await import('./ai/embedSpike')
    console.info(`[embed-spike] ${JSON.stringify(await runEmbedSpike(cacheDir))}`)
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    console.error(`[embed-spike] ${JSON.stringify({ ok: false, error: message })}`)
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.webatlas.app')

  // F12 toggles DevTools in development; Ctrl+R reload is ignored in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Browsing pages get no device permissions beyond fullscreen video and clipboard writes.
  session
    .fromPartition(BROWSE_PARTITION)
    .setPermissionRequestHandler((_wc, permission, callback) => {
      callback(permission === 'fullscreen' || permission === 'clipboard-sanitized-write')
    })

  initPaths(join(app.getPath('userData'), 'workspaces'))
  protocol.handle(THUMB_SCHEME, (request) => serveThumb(request.url))
  registerIpc(() => mainWindow)

  createWindow()
  Menu.setApplicationMenu(
    buildAppMenu({
      send: (action) => mainWindow?.webContents.send('menu:action', action),
      devTools: is.dev || isE2E,
      toggleGallery
    })
  )

  if (process.env.WA_SPIKE_EMBED === '1') void runEmbeddingSpike()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
