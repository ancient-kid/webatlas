import { expect, test, type Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FIXTURE_ORIGIN } from '../playwright.config'
import { launchApp, type LaunchedApp } from './helpers/launch'

const ARTICLE = `${FIXTURE_ORIGIN}/article.html`
const LINKED = `${FIXTURE_ORIGIN}/linked.html`
const THIRD = `${FIXTURE_ORIGIN}/third.html`

let launched: LaunchedApp
let userData: string

test.beforeEach(async () => {
  userData = mkdtempSync(join(tmpdir(), 'webatlas-e2e-'))
  launched = await launchApp({ userData })
})
test.afterEach(async () => {
  await launched.close()
  rmSync(userData, { recursive: true, force: true })
})

async function relaunch(): Promise<void> {
  await launched.close()
  launched = await launchApp({ userData })
}

/** The URL the embedded browser is showing (read from its guest webContents). */
const guestUrl = (l: LaunchedApp): Promise<string> =>
  l.app.evaluate(({ webContents }) => {
    const g = webContents.getAllWebContents().find((w) => w.getType() === 'webview')
    return g ? g.getURL() : ''
  })

/** Runs a script inside the embedded web page. */
const inGuest = <T>(l: LaunchedApp, code: string): Promise<T> =>
  l.app.evaluate(({ webContents }, js) => {
    const g = webContents.getAllWebContents().find((w) => w.getType() === 'webview')!
    return g.executeJavaScript(js, true)
  }, code) as Promise<T>

async function createWorkspace(page: Page, name: string, question = ''): Promise<void> {
  const button = page.getByRole('button', { name: /^(Create workspace|New workspace)$/ })
  await button.click()
  await page.getByRole('textbox', { name: 'Name' }).fill(name)
  if (question) await page.getByRole('textbox', { name: /Research question/ }).fill(question)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByTestId('workspace-screen')).toBeVisible()
}

async function navigate(l: LaunchedApp, url: string): Promise<void> {
  const address = l.page.getByRole('textbox', { name: 'Address' })
  await address.click()
  await address.fill(url)
  await address.press('Enter')
  await expect.poll(() => guestUrl(l)).toBe(url)
}

test('an empty data folder shows Welcome', async () => {
  const { page } = launched
  await expect(page.getByRole('heading', { name: 'WebAtlas' })).toBeVisible()
  await expect(page.getByText('Your browsing, drawn as a map.')).toBeVisible()
  await expect(page.getByText('Everything stays on your device.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create workspace' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open sample workspace' })).toBeVisible()
})

test('create → browse with the address bar, back, forward and popups', async () => {
  const { page } = launched
  await createWorkspace(page, 'Flood finance', 'How do coastal cities fund adaptation?')
  await expect(page.getByTestId('workspace-name')).toHaveText('Flood finance')

  await navigate(launched, ARTICLE)
  await expect(page.getByRole('textbox', { name: 'Address' })).toHaveValue(ARTICLE)

  await inGuest(launched, `document.getElementById('link-linked').click()`)
  await expect.poll(() => guestUrl(launched)).toBe(LINKED)
  await expect(page.getByRole('textbox', { name: 'Address' })).toHaveValue(LINKED)

  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect.poll(() => guestUrl(launched)).toBe(ARTICLE)
  await page.getByRole('button', { name: 'Forward' }).click()
  await expect.poll(() => guestUrl(launched)).toBe(LINKED)

  // A target=_blank link opens in the same pane, never a new window.
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect.poll(() => guestUrl(launched)).toBe(ARTICLE)
  await inGuest(launched, `document.getElementById('link-popup').click()`)
  await expect.poll(() => guestUrl(launched)).toBe(THIRD)
  expect(
    await launched.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)
  ).toBe(1)
})

test('close and relaunch → the workspace is listed and resumes on the last page', async () => {
  await createWorkspace(launched.page, 'Resume me')
  await navigate(launched, LINKED)
  await launched.page.getByRole('button', { name: 'Auto' }).click()
  await relaunch()

  const { page } = launched
  await expect(page.getByRole('heading', { name: 'Your workspaces' })).toBeVisible()
  await expect(page.getByText('Opened just now')).toBeVisible()
  await page.getByRole('button', { name: 'Open Resume me' }).click()
  await expect(page.getByTestId('workspace-screen')).toBeVisible()
  await expect.poll(() => guestUrl(launched)).toBe(LINKED)
  await expect(page.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true')
})

test('duplicate, then delete with confirmation', async () => {
  const { page } = launched
  await createWorkspace(page, 'Original')
  await page.getByRole('button', { name: 'Back to home' }).click()

  await page.getByRole('button', { name: 'Options for Original' }).click()
  await page.getByRole('menuitem', { name: 'Duplicate' }).click()
  await expect(page.getByRole('button', { name: /^Open / })).toHaveCount(2)

  await page.getByRole('button', { name: 'Options for Original (copy)' }).click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  const dialog = page.getByRole('dialog', { name: 'Delete workspace' })
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('button', { name: /^Open / })).toHaveCount(2)

  await page.getByRole('button', { name: 'Options for Original (copy)' }).click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await dialog.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('button', { name: /^Open / })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Open Original' })).toBeVisible()
})

test('hiding the browser keeps the page loaded; Ctrl+B and the menu toggle it', async () => {
  const { page, app } = launched
  await createWorkspace(page, 'Toggle')
  await navigate(launched, ARTICLE)
  await inGuest(
    launched,
    `window.__marker = 'still here'; document.body.style.minHeight = '3000px'; window.scrollTo(0, 1200)`
  )

  await page.getByRole('button', { name: 'Hide browser', exact: true }).click()
  await expect(page.getByTestId('browser-webview')).toBeHidden()
  const widths = await page.evaluate(() => ({
    canvas: document.querySelector('[data-testid="canvas-area"]')!.getBoundingClientRect().width,
    window: window.innerWidth
  }))
  expect(widths.canvas).toBeGreaterThan(widths.window - 10)

  await page.getByRole('button', { name: 'Show browser' }).click()
  await expect(page.getByTestId('browser-webview')).toBeVisible()
  // Same document (not reloaded) and same scroll position.
  expect(await inGuest(launched, `[window.__marker, window.scrollY]`)).toEqual(['still here', 1200])

  await page.getByTestId('workspace-name').click()
  await page.keyboard.press('Control+b')
  await expect(page.getByTestId('browser-webview')).toBeHidden()
  await page.keyboard.press('Control+b')
  await expect(page.getByTestId('browser-webview')).toBeVisible()

  // The menu accelerator path (used while focus is inside the web page).
  // (Wait past the window in which a menu event is treated as the same key press.)
  await page.waitForTimeout(300)
  await app.evaluate(({ Menu }) =>
    Menu.getApplicationMenu()?.getMenuItemById('toggle-browser')?.click()
  )
  await expect(page.getByTestId('browser-webview')).toBeHidden()
})

test('dragging the divider resizes the panes; width and open state survive a relaunch', async () => {
  await createWorkspace(launched.page, 'Layout')
  const { page } = launched
  const divider = page.getByRole('separator', { name: 'Resize browser and canvas' })
  const before = (await page.getByTestId('browser-panel').boundingBox())!.width
  const box = (await divider.boundingBox())!
  const y = box.y + box.height / 2
  await page.mouse.move(box.x + box.width / 2, y)
  await page.mouse.down()
  await page.mouse.move(box.x + 200, y, { steps: 8 })
  await page.mouse.up()
  const after = (await page.getByTestId('browser-panel').boundingBox())!.width
  expect(after).toBeGreaterThan(before + 150)
  const ratio = Number(await divider.getAttribute('aria-valuenow'))

  // Dragging far left stops at the minimum instead of closing the pane.
  const again = (await divider.boundingBox())!
  await page.mouse.move(again.x + 2, y)
  await page.mouse.down()
  await page.mouse.move(5, y, { steps: 8 })
  await page.mouse.up()
  await expect(divider).toHaveAttribute('aria-valuenow', '20')
  await divider.focus()
  for (let i = 0; i < 100 && Number(await divider.getAttribute('aria-valuenow')) < ratio; i++) {
    await page.keyboard.press('ArrowRight')
  }
  const kept = Number(await divider.getAttribute('aria-valuenow'))

  await page.getByRole('button', { name: 'Hide browser', exact: true }).click()
  await relaunch()
  await launched.page.getByRole('button', { name: 'Open Layout' }).click()
  await expect(launched.page.getByTestId('workspace-screen')).toBeVisible()
  await expect(launched.page.getByTestId('browser-webview')).toBeHidden()
  await launched.page.getByRole('button', { name: 'Show browser' }).click()
  await expect(
    launched.page.getByRole('separator', { name: 'Resize browser and canvas' })
  ).toHaveAttribute('aria-valuenow', String(kept))
})

test('the session is visible to the test hooks while a workspace is open', async () => {
  const { page } = launched
  expect(await page.evaluate(() => window.__waDebug?.getSession())).toBeNull()
  await createWorkspace(page, 'Hooks')
  expect(await page.evaluate(() => window.__waDebug?.getSession()?.browserOpen)).toBe(true)
})
