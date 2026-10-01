import { expect, test } from '@playwright/test'
import { launchApp, type LaunchedApp } from './helpers/launch'
import { attachWebview } from './helpers/webview'
import { FIXTURE_ORIGIN } from '../playwright.config'

let launched: LaunchedApp

/** `getLastWebPreferences` exists at runtime in Electron 39 but is missing from its typings. */
type PrefsReader = { getLastWebPreferences(): Record<string, unknown> | null }

test.beforeEach(async () => {
  launched = await launchApp()
})

test.afterEach(async () => {
  await launched.close()
})

test('launches with one window titled WebAtlas', async () => {
  const { app, page } = launched
  await expect(page.getByTestId('app-root')).toBeVisible()
  const windowCount = await app.evaluate(
    ({ BrowserWindow }) => BrowserWindow.getAllWindows().length
  )
  expect(windowCount).toBe(1)
  await expect(page).toHaveTitle('WebAtlas')
})

test('app window is sandboxed with context isolation and no Node integration', async () => {
  const prefs = await launched.app.evaluate(({ BrowserWindow }) => {
    const wc = BrowserWindow.getAllWindows()[0].webContents as unknown as PrefsReader
    const p = wc.getLastWebPreferences()
    return {
      sandbox: p?.sandbox,
      contextIsolation: p?.contextIsolation,
      nodeIntegration: p?.nodeIntegration,
      webviewTag: p?.webviewTag
    }
  })
  expect(prefs).toEqual({
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    webviewTag: true
  })
})

test('renderer has no access to Node', async () => {
  const globals = await launched.page.evaluate(() => ({
    require: typeof (window as unknown as { require?: unknown }).require,
    process: typeof (globalThis as unknown as { process?: unknown }).process,
    api: typeof (window as unknown as { api?: unknown }).api
  }))
  expect(globals).toEqual({ require: 'undefined', process: 'undefined', api: 'object' })
})

test('starts without console errors', async () => {
  await expect(launched.page.getByTestId('app-root')).toBeVisible()
  await launched.page.waitForTimeout(500)
  expect(launched.errors).toEqual([])
})

test('uses the isolated app-data folder in test mode', async () => {
  const userData = await launched.app.evaluate(({ app }) => app.getPath('userData'))
  expect(userData).toBe(launched.userData)
})

test('content security policy allows thumbnails but not remote scripts', async () => {
  const csp = await launched.page.evaluate(
    () =>
      document
        .querySelector('meta[http-equiv="Content-Security-Policy"]')
        ?.getAttribute('content') ?? ''
  )
  expect(csp).toContain("script-src 'self'")
  expect(csp).toContain('wa-thumb:')
  expect(csp).not.toContain('unsafe-eval')
})

test('app window refuses to navigate away from the app', async () => {
  const { app } = launched
  // Drive this from main: Playwright would otherwise wait forever for the blocked navigation.
  const mainState = (): Promise<{ url: string; hasRoot: boolean }> =>
    app.evaluate(async ({ BrowserWindow }) => {
      const wc = BrowserWindow.getAllWindows()[0].webContents
      const hasRoot = await wc.executeJavaScript(
        `!!document.querySelector('[data-testid="app-root"]')`
      )
      return { url: wc.getURL(), hasRoot }
    })
  const before = await mainState()
  await app.evaluate(({ BrowserWindow }, url) => {
    void BrowserWindow.getAllWindows()[0].webContents.executeJavaScript(
      `window.location.href = ${JSON.stringify(url)}`
    )
  }, `${FIXTURE_ORIGIN}/article.html`)
  await new Promise((r) => setTimeout(r, 1000))
  expect(await mainState()).toEqual({ url: before.url, hasRoot: true })
})

test('webview guests are forced into an isolated, preload-free sandbox', async () => {
  const { app, page } = launched
  await attachWebview(app, page, `${FIXTURE_ORIGIN}/article.html`)
  const guest = await app.evaluate(async ({ webContents, session }) => {
    const wc = webContents.getAllWebContents().find((w) => w.getType() === 'webview')!
    const p = (wc as unknown as PrefsReader).getLastWebPreferences()
    // Behavioural checks inside the guest page: no Node, no preload-injected globals.
    const inside = await wc.executeJavaScript(
      `({ require: typeof require, process: typeof process, api: typeof window.api })`
    )
    return {
      nodeIntegration: p?.nodeIntegration,
      nodeIntegrationInSubFrames: p?.nodeIntegrationInSubFrames,
      contextIsolation: p?.contextIsolation,
      sandbox: p?.sandbox,
      inside,
      // The renderer asked for 'persist:something-else'; main must have forced the browse partition.
      usesBrowsePartition:
        wc.session.storagePath === session.fromPartition('persist:webatlas-browse').storagePath
    }
  })
  expect(guest).toEqual({
    nodeIntegration: false,
    nodeIntegrationInSubFrames: false,
    contextIsolation: true,
    sandbox: true,
    inside: { require: 'undefined', process: 'undefined', api: 'undefined' },
    usesBrowsePartition: true
  })
})

test('popups from the webview open no window and are forwarded to the renderer', async () => {
  const { app, page } = launched
  await attachWebview(app, page, `${FIXTURE_ORIGIN}/article.html`)
  await app.evaluate(({ BrowserWindow }) => {
    const wc = BrowserWindow.getAllWindows()[0].webContents
    const g = globalThis as unknown as { __sent: unknown[][] }
    g.__sent = []
    const original = wc.send.bind(wc)
    wc.send = (channel: string, ...args: unknown[]) => {
      g.__sent.push([channel, ...args])
      original(channel, ...args)
    }
  })
  await app.evaluate(async ({ webContents }) => {
    const wc = webContents.getAllWebContents().find((w) => w.getType() === 'webview')!
    await wc.executeJavaScript(`document.getElementById('link-popup').click()`, true)
  })
  await expect
    .poll(() => app.evaluate(() => (globalThis as unknown as { __sent: unknown[][] }).__sent))
    .toContainEqual(['browser:open-url', `${FIXTURE_ORIGIN}/third.html`])
  // (Playwright lists the webview guest as a page, so count real windows in main instead.)
  const windowCount = await app.evaluate(
    ({ BrowserWindow }) => BrowserWindow.getAllWindows().length
  )
  expect(windowCount).toBe(1)
})

test('pages in the webview are denied device permissions', async () => {
  const { app, page } = launched
  await attachWebview(app, page, `${FIXTURE_ORIGIN}/article.html`)
  const result = await app.evaluate(async ({ webContents }) => {
    const wc = webContents.getAllWebContents().find((w) => w.getType() === 'webview')!
    return wc.executeJavaScript(
      `Promise.all([
        Notification.requestPermission(),
        navigator.mediaDevices.getUserMedia({ audio: true }).then(() => 'granted', (e) => e.name)
      ])`,
      true
    )
  })
  expect(result).toEqual(['denied', 'NotAllowedError'])
})
