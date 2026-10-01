import { expect, test } from '@playwright/test'
import { FIXTURE_ORIGIN } from '../playwright.config'
import { createWorkspace, getBoard, nodeEl } from './helpers/canvas'
import { launchApp, type LaunchedApp } from './helpers/launch'

const ARTICLE = `${FIXTURE_ORIGIN}/article.html`

let launched: LaunchedApp

test.beforeEach(async () => {
  launched = await launchApp({ env: { WA_AI_MOCK: '1' } })
  await launched.page.setViewportSize({ width: 1440, height: 900 })
  await createWorkspace(launched.page, 'Search test')
})

test.afterEach(async () => {
  await launched.close()
})

const menu = (l: LaunchedApp, id: string): Promise<void> =>
  l.app.evaluate(({ Menu }, itemId) => {
    Menu.getApplicationMenu()!.getMenuItemById(itemId)!.click()
  }, id)

const guestUrl = (l: LaunchedApp): Promise<string> =>
  l.app.evaluate(({ webContents }) => {
    const g = webContents.getAllWebContents().find((w) => w.getType() === 'webview')
    return g ? g.getURL() : ''
  })

async function go(l: LaunchedApp, url: string): Promise<void> {
  const address = l.page.getByRole('textbox', { name: 'Address' })
  await address.fill(url)
  await address.press('Enter')
  await expect.poll(() => guestUrl(l)).toBe(url)
}

test('Ctrl+K opens palette from canvas, menu item opens it from webview, searching jumps to node', async () => {
  const { page } = launched

  // Capture a fixture card
  await go(launched, ARTICLE)
  await page.getByRole('button', { name: /Add to canvas/ }).click()

  await expect.poll(async () => Object.keys((await getBoard(page)).nodes).length).toBe(2)
  const card = Object.values((await getBoard(page)).nodes).find((n) => n.kind === 'webpage')!
  expect(card).toBeDefined()

  // Dismiss hint overlay if present
  const gotIt = page.getByRole('button', { name: 'Got it' })
  if (await gotIt.isVisible()) {
    await gotIt.click()
  }

  // 1. Focus canvas and press Ctrl+K -> palette opens
  await page.getByTestId('canvas').click({ position: { x: 50, y: 50 } })
  await page.keyboard.press('Control+k')
  const palette = page.getByRole('dialog', { name: 'Search workspace' })
  await expect(palette).toBeVisible()

  // Dismiss with Escape
  await page.keyboard.press('Escape')
  await expect(palette).not.toBeVisible()

  // 2. Electron menu item 'palette' opens palette
  await menu(launched, 'palette')
  await expect(palette).toBeVisible()

  // 3. Search fixture title with typo and press Enter -> card selected and framed
  const input = page.getByPlaceholder('Search workspace...')
  await input.fill('Green bnds')
  await expect(palette.getByText('Green bonds and coastal adaptation')).toBeVisible()

  await page.keyboard.press('Enter')
  await expect(palette).not.toBeVisible()

  // Node should now be selected
  await expect(nodeEl(page, card.id)).toHaveClass(/selected/)
})
