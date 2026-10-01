// Shared steps for tests that drive the workspace screen and canvas.
import { expect, type Locator, type Page } from '@playwright/test'
import type { Board, CanvasNode } from '../../src/shared/types'

export type Point = { x: number; y: number }

export const getBoard = (page: Page): Promise<Board> =>
  page.evaluate(() => window.__waDebug!.getBoard())

export const history = (page: Page): Promise<{ past: number; future: number }> =>
  page.evaluate(() => window.__waDebug!.getHistorySizes())

export const nodeEl = (page: Page, id: string): Locator =>
  page.locator(`.react-flow__node[data-id="${id}"]`)

export const pane = (page: Page): Locator => page.locator('.react-flow__pane')

export async function notes(page: Page): Promise<CanvasNode[]> {
  return Object.values((await getBoard(page)).nodes).filter((n) => n.kind === 'note')
}

/** Creates a workspace from Home (or the welcome screen) and waits for the canvas. */
export async function createWorkspace(
  page: Page,
  name: string,
  question = 'Why?',
  options: { hideBrowser?: boolean } = {}
): Promise<void> {
  await page.getByRole('button', { name: /^(Create workspace|New workspace)$/ }).click()
  await page.getByRole('textbox', { name: 'Name' }).fill(name)
  if (question) await page.getByRole('textbox', { name: /Research question/ }).fill(question)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.locator('.react-flow__node-question')).toBeVisible()
  if (options.hideBrowser) {
    await page.getByRole('button', { name: 'Hide browser', exact: true }).click()
  }
}

/** Double-clicks empty canvas at (x, y) (relative to the pane), types and clicks away. */
export async function addNote(page: Page, x: number, y: number, text: string): Promise<string> {
  const before = new Set((await notes(page)).map((n) => n.id))
  await pane(page).dblclick({ position: { x, y } })
  await page.waitForFunction(() => document.activeElement?.tagName === 'TEXTAREA')
  await page.keyboard.type(text)
  await clickEmpty(page)
  await expect
    .poll(async () => (await notes(page)).find((n) => !before.has(n.id))?.title)
    .toBe(text)
  return (await notes(page)).find((n) => !before.has(n.id))!.id
}

/** Clicks an empty spot of the canvas (bottom middle). */
export async function clickEmpty(page: Page): Promise<void> {
  const box = (await pane(page).boundingBox())!
  await pane(page).click({ position: { x: box.width / 2, y: box.height - 60 } })
}

export async function drag(page: Page, from: Point, to: Point): Promise<void> {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 12 })
  await page.mouse.up()
}

export async function centreOf(page: Page, id: string): Promise<Point> {
  const b = (await nodeEl(page, id).boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

/** Draws a link from one card's right handle onto another card. */
export async function link(page: Page, from: string, to: string): Promise<void> {
  await nodeEl(page, from).hover()
  const handle = (await nodeEl(page, from).locator('.react-flow__handle-right').boundingBox())!
  await drag(page, { x: handle.x + 5, y: handle.y + 5 }, await centreOf(page, to))
}
