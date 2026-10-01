// Regression tests for the embedded browser capabilities that capture depends on
// (spike 1, T02). Everything runs against local fixture pages, driven from the
// renderer through the <webview> element exactly as the app will do it.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { launchApp, type LaunchedApp } from './helpers/launch'
import { attachWebview, execInWebview, TEST_WEBVIEW_ID, webviewEvents } from './helpers/webview'
import { FIXTURE_ORIGIN } from '../playwright.config'
import {
  META_SCRIPT,
  SELECTION_SCRIPT,
  readabilityScript,
  type PageMeta
} from '../src/renderer/src/features/browser/webviewScripts'

const READABILITY = readabilityScript(
  readFileSync(resolve(__dirname, '../node_modules/@mozilla/readability/Readability.js'), 'utf8')
)
const ARTICLE = `${FIXTURE_ORIGIN}/article.html`

let launched: LaunchedApp

test.beforeEach(async () => {
  launched = await launchApp()
  await attachWebview(launched.app, launched.page, ARTICLE)
})

test.afterEach(async () => {
  await launched.close()
})

test('capturePage works from the sandboxed renderer and resizes to a thumbnail', async () => {
  const shot = await launched.page.evaluate(async (id) => {
    const wv = document.getElementById(id) as unknown as Electron.WebviewTag
    const img = await wv.capturePage()
    const thumb = img.resize({ width: 520 })
    return {
      empty: img.isEmpty(),
      size: img.getSize(),
      thumbWidth: thumb.getSize().width,
      dataUrlPrefix: thumb.toDataURL().slice(0, 22),
      dataUrlLength: thumb.toDataURL().length
    }
  }, TEST_WEBVIEW_ID)
  expect(shot.empty).toBe(false)
  expect(shot.size.width).toBeGreaterThan(0)
  expect(shot.thumbWidth).toBe(520)
  expect(shot.dataUrlPrefix).toBe('data:image/png;base64,')
  expect(shot.dataUrlLength).toBeGreaterThan(1000)
})

test('reads page metadata', async () => {
  const meta = await execInWebview<PageMeta>(launched.page, META_SCRIPT)
  expect(meta).toMatchObject({
    title: 'Green bonds and coastal adaptation | Fixture Journal',
    ogTitle: 'Green bonds and coastal adaptation',
    ogImage: `${FIXTURE_ORIGIN}/cover.svg`,
    siteName: 'Fixture Journal',
    contentType: 'text/html',
    favicon: `${FIXTURE_ORIGIN}/favicon.ico`
  })
  expect(meta.description).toMatch(/green bonds/)
})

test('extracts article text with Readability', async () => {
  const text = await execInWebview<string>(launched.page, READABILITY)
  expect(text.length).toBeGreaterThan(200)
  expect(text).toContain('Rotterdam pioneered water squares')
})

test('reads the user selection', async () => {
  expect(await execInWebview<string>(launched.page, SELECTION_SCRIPT)).toBe('')
  await execInWebview(
    launched.page,
    `(() => { const r = document.createRange(); r.selectNodeContents(document.getElementById('lead')); getSelection().addRange(r); return true })()`
  )
  expect(await execInWebview<string>(launched.page, SELECTION_SCRIPT)).toMatch(
    /^Coastal cities fund climate adaptation/
  )
})

test('reports link navigation and in-page navigation', async () => {
  const { page } = launched
  await execInWebview(page, `document.getElementById('link-linked').click(); true`, true)
  await expect
    .poll(() => webviewEvents(page))
    .toContain(`did-navigate ${FIXTURE_ORIGIN}/linked.html`)
  await execInWebview(page, `history.pushState({}, '', '#section-2'); true`)
  await expect
    .poll(() => webviewEvents(page))
    .toContain(`did-navigate-in-page ${FIXTURE_ORIGIN}/linked.html#section-2`)
})

test('navigates with loadURL, back and forward', async () => {
  const { page } = launched
  const nav = (fn: string): Promise<void> =>
    page.evaluate(
      ({ id, call }) => {
        const wv = document.getElementById(id) as unknown as Electron.WebviewTag
        if (call === 'back') wv.goBack()
        else if (call === 'forward') wv.goForward()
        else void wv.loadURL(call)
      },
      { id: TEST_WEBVIEW_ID, call: fn }
    )
  const current = (): Promise<string> =>
    page.evaluate(
      (id) => (document.getElementById(id) as unknown as Electron.WebviewTag).getURL(),
      TEST_WEBVIEW_ID
    )
  await nav(`${FIXTURE_ORIGIN}/third.html`)
  await expect.poll(current).toBe(`${FIXTURE_ORIGIN}/third.html`)
  await nav('back')
  await expect.poll(current).toBe(ARTICLE)
  await nav('forward')
  await expect.poll(current).toBe(`${FIXTURE_ORIGIN}/third.html`)
})

test('opens a PDF and can thumbnail it', async () => {
  const { page } = launched
  await page.evaluate(
    ({ id, url }) =>
      void (document.getElementById(id) as unknown as Electron.WebviewTag).loadURL(url),
    { id: TEST_WEBVIEW_ID, url: `${FIXTURE_ORIGIN}/doc.pdf` }
  )
  await expect.poll(() => webviewEvents(page)).toContain(`did-navigate ${FIXTURE_ORIGIN}/doc.pdf`)
  await page.waitForTimeout(1500) // let the PDF viewer paint
  const shot = await page.evaluate(async (id) => {
    const img = await (document.getElementById(id) as unknown as Electron.WebviewTag).capturePage()
    return { empty: img.isEmpty(), width: img.getSize().width }
  }, TEST_WEBVIEW_ID)
  expect(shot.empty).toBe(false)
  expect(shot.width).toBeGreaterThan(0)
})
