import { expect, test, type Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FIXTURE_ORIGIN } from '../playwright.config'
import type { CanvasNode } from '../src/shared/types'
import { createWorkspace, getBoard, nodeEl } from './helpers/canvas'
import { launchApp, type LaunchedApp } from './helpers/launch'

const ARTICLE = `${FIXTURE_ORIGIN}/article.html`
const MOCK_SUMMARY = 'A one-line summary from the test model.'

let launched: LaunchedApp
let userData: string

test.beforeEach(async () => {
  userData = mkdtempSync(join(tmpdir(), 'webatlas-e2e-'))
  launched = await launchApp({ userData, env: { WA_AI_MOCK: '1' } })
  await launched.page.setViewportSize({ width: 1440, height: 900 })
  await createWorkspace(launched.page, 'Inspector test')
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

async function cards(page: Page): Promise<CanvasNode[]> {
  return Object.values((await getBoard(page)).nodes).filter(
    (n) => n.kind !== 'question' && n.kind !== 'note'
  )
}

const add = (page: Page): Promise<void> =>
  page.getByRole('button', { name: /Add to canvas/ }).click()

test('select a captured card → inspector shows URL and summary; editing note persists after relaunch', async () => {
  const { page } = launched

  // When nothing is selected, inspector shows empty state
  await expect(page.getByTestId('inspector-empty')).toHaveText('Select a card to see its details')

  // Capture fixture page
  await go(launched, ARTICLE)
  await add(page)
  await expect.poll(async () => (await cards(page)).length).toBe(1)
  const [card] = await cards(page)

  // Wait for mock summary to appear
  await expect.poll(async () => (await cards(page))[0].summary).toBe(MOCK_SUMMARY)

  // Select the card on the canvas
  await nodeEl(page, card.id).click()

  // Inspector shows URL, summary and title
  const panel = page.getByTestId('inspector-panel')
  await expect(panel).toBeVisible()
  await expect(panel.getByText(ARTICLE)).toBeVisible()
  await expect(panel.getByText(MOCK_SUMMARY)).toBeVisible()
  await expect(panel.getByLabel('Title')).toHaveValue('Green bonds and coastal adaptation')

  // Edit the note
  const noteField = panel.getByLabel('Your note')
  await noteField.fill('Crucial evidence for municipal bond financing.')
  await noteField.blur()

  await expect
    .poll(async () => (await cards(page))[0].note)
    .toBe('Crucial evidence for municipal bond financing.')

  // Relaunch the app reusing userData
  await relaunch()
  const newPage = launched.page
  await newPage.setViewportSize({ width: 1440, height: 900 })

  // Open the workspace from home
  await newPage.getByRole('button', { name: 'Open Inspector test' }).click()
  await expect(newPage.getByTestId('workspace-screen')).toBeVisible()

  // Select the card again
  await nodeEl(newPage, card.id).click()

  // Check that the note persisted
  const reloadedPanel = newPage.getByTestId('inspector-panel')
  await expect(reloadedPanel.getByLabel('Your note')).toHaveValue(
    'Crucial evidence for municipal bond financing.'
  )
})
