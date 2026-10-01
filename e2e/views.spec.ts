import { expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FIXTURE_ORIGIN } from '../playwright.config'
import { createWorkspace, getBoard, nodeEl } from './helpers/canvas'
import { launchApp, type LaunchedApp } from './helpers/launch'

const ARTICLE = `${FIXTURE_ORIGIN}/article.html`
const LINKED = `${FIXTURE_ORIGIN}/linked.html`

let launched: LaunchedApp
let userData: string

test.beforeEach(async () => {
  userData = mkdtempSync(join(tmpdir(), 'webatlas-views-e2e-'))
  launched = await launchApp({ userData, env: { WA_AI_MOCK: '1' } })
  await launched.page.setViewportSize({ width: 1440, height: 900 })
  await createWorkspace(launched.page, 'Views test')
})

test.afterEach(async () => {
  await launched.close()
  rmSync(userData, { recursive: true, force: true })
})

async function relaunch(): Promise<void> {
  await launched.page.waitForTimeout(600)
  await launched.close()
  launched = await launchApp({ userData, env: { WA_AI_MOCK: '1' } })
}

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

test('switch to Focus with a card selected dims non-neighbours; switch to List shows table; view mode persists across relaunch', async () => {
  const { page } = launched

  // Capture two cards
  await go(launched, ARTICLE)
  await page.getByRole('button', { name: /Add to canvas/ }).click()
  await expect.poll(async () => Object.keys((await getBoard(page)).nodes).length).toBe(2)

  await go(launched, LINKED)
  await page.getByRole('button', { name: /Add to canvas/ }).click()

  await expect.poll(async () => Object.keys((await getBoard(page)).nodes).length).toBe(3)
  const board = await getBoard(page)
  const cards = Object.values(board.nodes).filter((n) => n.kind === 'webpage')
  expect(cards.length).toBe(2)

  const card1 = cards[0]
  const card2 = cards[1]

  // Select card1
  await nodeEl(page, card1.id).click()

  // Switch to Focus mode
  await page.getByRole('button', { name: 'Focus' }).click()

  // Card1 is selected, so card2 (not connected to card1) should have wa-dim class
  await expect(nodeEl(page, card2.id)).toHaveClass(/wa-dim/)
  // Card1 should not have wa-dim
  await expect(nodeEl(page, card1.id)).not.toHaveClass(/wa-dim/)

  // Switch to List mode
  await page.getByRole('button', { name: 'List' }).click()
  await expect(page.getByTestId('list-view')).toBeVisible()
  await expect(page.getByText(card1.title)).toBeVisible()
  await expect(page.getByText(card2.title)).toBeVisible()

  // Relaunch the app
  await relaunch()
  const newPage = launched.page
  await newPage.setViewportSize({ width: 1440, height: 900 })

  // Open the workspace from home
  await newPage.getByRole('button', { name: 'Open Views test' }).click()
  await expect(newPage.getByTestId('workspace-screen')).toBeVisible()

  // Verify it restored in List view mode
  await expect(newPage.getByTestId('list-view')).toBeVisible()
  await expect(newPage.getByRole('button', { name: 'List' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
})
