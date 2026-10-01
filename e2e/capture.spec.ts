import { expect, test, type Page } from '@playwright/test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { FIXTURE_ORIGIN } from '../playwright.config'
import type { CanvasNode } from '../src/shared/types'
import { createWorkspace, getBoard, history } from './helpers/canvas'
import { launchApp, type LaunchedApp } from './helpers/launch'

const ARTICLE = `${FIXTURE_ORIGIN}/article.html`
const LINKED = `${FIXTURE_ORIGIN}/linked.html`
const THIRD = `${FIXTURE_ORIGIN}/third.html`
const PDF = `${FIXTURE_ORIGIN}/doc.pdf`
const MOCK_SUMMARY = 'A one-line summary from the test model.'

let launched: LaunchedApp
test.beforeEach(async () => {
  launched = await launchApp({ env: { WA_AI_MOCK: '1' } })
  await launched.page.setViewportSize({ width: 1440, height: 900 })
  await createWorkspace(launched.page, 'Capture test')
})
test.afterEach(async () => {
  await launched.close()
})

const guestUrl = (l: LaunchedApp): Promise<string> =>
  l.app.evaluate(({ webContents }) => {
    const g = webContents.getAllWebContents().find((w) => w.getType() === 'webview')
    return g ? g.getURL() : ''
  })

const inGuest = (l: LaunchedApp, code: string): Promise<unknown> =>
  l.app.evaluate(({ webContents }, js) => {
    const g = webContents.getAllWebContents().find((w) => w.getType() === 'webview')!
    return g.executeJavaScript(js, true)
  }, code)

async function go(l: LaunchedApp, url: string): Promise<void> {
  const address = l.page.getByRole('textbox', { name: 'Address' })
  await address.fill(url)
  await address.press('Enter')
  await expect.poll(() => guestUrl(l)).toBe(url)
}

async function cards(page: Page): Promise<CanvasNode[]> {
  return Object.values((await getBoard(page)).nodes).filter(
    (n) => n.kind !== 'question' && n.kind !== 'note'
  )
}

const add = (page: Page): Promise<void> =>
  page.getByRole('button', { name: /Add to canvas/ }).click()

test('Add to canvas creates a card with title, thumbnail, text and the mock summary', async () => {
  const { page } = launched
  await go(launched, ARTICLE)
  await add(page)
  await expect.poll(async () => (await cards(page)).length).toBe(1)
  const [card] = await cards(page)
  expect(card).toMatchObject({
    kind: 'webpage',
    title: 'Green bonds and coastal adaptation',
    url: ARTICLE
  })
  expect(card.text!.length).toBeGreaterThan(200)
  expect(card.thumbnailPath).toMatch(/^wa-thumb:\/\//)
  const wsId = /^wa-thumb:\/\/([^/]+)\//.exec(card.thumbnailPath!)![1]
  expect(existsSync(join(launched.userData, 'workspaces', wsId, 'thumbs', `${card.id}.png`))).toBe(
    true
  )
  await expect(page.getByText('Added to canvas')).toBeVisible()
  await expect.poll(async () => (await cards(page))[0].summary).toBe(MOCK_SUMMARY)
  await expect(page.locator(`.react-flow__node[data-id="${card.id}"]`)).toContainText(MOCK_SUMMARY)
  await expect(
    page.locator(`.react-flow__node[data-id="${card.id}"] .wa-card__thumb img`)
  ).toBeVisible()
})

test('a page opened from a captured page is linked "opened from", in one undo step', async () => {
  const { page } = launched
  await go(launched, ARTICLE)
  await add(page)
  await expect.poll(async () => (await cards(page)).length).toBe(1)
  const [first] = await cards(page)
  const steps = (await history(page)).past

  await inGuest(launched, `document.getElementById('link-linked').click()`)
  await expect.poll(() => guestUrl(launched)).toBe(LINKED)
  await add(page)
  await expect.poll(async () => (await cards(page)).length).toBe(2)
  const second = (await cards(page)).find((c) => c.url === LINKED)!
  expect(second.capturedFromNodeId).toBe(first.id)
  expect(Object.values((await getBoard(page)).edges)).toEqual([
    expect.objectContaining({
      source: first.id,
      target: second.id,
      relation: 'opened-from',
      origin: 'provenance'
    })
  ])
  expect((await history(page)).past).toBe(steps + 1)
  await expect(page.locator('.wa-edge__label')).toHaveText('opened from')

  // Capturing the same page again selects the existing card.
  await add(page)
  await expect(page.getByText('Already on your canvas.')).toBeVisible()
  expect(await cards(page)).toHaveLength(2)
  await expect(page.locator(`.react-flow__node[data-id="${second.id}"]`)).toHaveClass(/selected/)
})

test('a typed address is not "opened from" anything; PDFs become PDF cards', async () => {
  const { page } = launched
  await go(launched, ARTICLE)
  await add(page)
  await go(launched, THIRD)
  await add(page)
  await expect.poll(async () => (await cards(page)).length).toBe(2)
  expect(Object.keys((await getBoard(page)).edges)).toEqual([])
  expect((await cards(page)).find((c) => c.url === THIRD)!.title).toBe(
    'OECD overview: financing climate adaptation in cities'
  )

  await go(launched, PDF)
  await page.waitForTimeout(500)
  await add(page)
  await expect.poll(async () => (await cards(page)).find((c) => c.url === PDF)?.kind).toBe('pdf')
})

test('Auto mode captures each page it visits, without duplicates', async () => {
  const { page } = launched
  await page.getByRole('button', { name: 'Auto' }).click()
  await go(launched, ARTICLE)
  await expect.poll(async () => (await cards(page)).length, { timeout: 15_000 }).toBe(1)
  await inGuest(launched, `document.getElementById('link-linked').click()`)
  await expect.poll(async () => (await cards(page)).length, { timeout: 15_000 }).toBe(2)
  await inGuest(launched, `document.getElementById('link-third').click()`)
  await expect.poll(async () => (await cards(page)).length, { timeout: 15_000 }).toBe(3)
  // Going back to a captured page does not duplicate it.
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect.poll(() => guestUrl(launched)).toBe(LINKED)
  await page.waitForTimeout(2500)
  expect(await cards(page)).toHaveLength(3)
  expect(Object.values((await getBoard(page)).edges).map((e) => e.relation)).toEqual([
    'opened-from',
    'opened-from'
  ])
})

test('Add to canvas on a blank page shows a toast and adds nothing', async () => {
  const { page } = launched
  await launched.app.evaluate(({ webContents }) => {
    const g = webContents.getAllWebContents().find((w) => w.getType() === 'webview')!
    return g.loadURL('about:blank')
  })
  await expect.poll(() => guestUrl(launched)).toBe('about:blank')
  await add(page)
  await expect(page.getByText('Open a page first, then add it.')).toBeVisible()
  expect(await cards(page)).toHaveLength(0)
})

test('Undo in the toast removes the new card', async () => {
  const { page } = launched
  await go(launched, ARTICLE)
  await add(page)
  await expect.poll(async () => (await cards(page)).length).toBe(1)
  await page.locator('[data-sonner-toast]').getByRole('button', { name: 'Undo' }).click()
  await expect.poll(async () => (await cards(page)).length).toBe(0)
})

test('Open in browser pane loads a card’s page (and shows a hidden browser)', async () => {
  const { page } = launched
  await go(launched, ARTICLE)
  await add(page)
  await expect.poll(async () => (await cards(page)).length).toBe(1)
  const [card] = await cards(page)
  await go(launched, THIRD)
  await page.getByRole('button', { name: 'Hide browser', exact: true }).click()
  await page.locator(`.react-flow__node[data-id="${card.id}"]`).click()
  await page
    .getByRole('toolbar', { name: 'Selection' })
    .getByRole('button', { name: 'Open in browser pane' })
    .click()
  await expect(page.getByTestId('browser-webview')).toBeVisible()
  await expect.poll(() => guestUrl(launched)).toBe(ARTICLE)
})
