import { expect, test, type Locator, type Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Board, CanvasNode } from '../src/shared/types'
import { launchApp, type LaunchedApp } from './helpers/launch'

let launched: LaunchedApp
let userData: string

test.beforeEach(async () => {
  userData = mkdtempSync(join(tmpdir(), 'webatlas-e2e-'))
  launched = await launchApp({ userData })
  const { page } = launched
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('button', { name: 'Create workspace' }).click()
  await page.getByRole('textbox', { name: 'Name' }).fill('Canvas test')
  await page.getByRole('textbox', { name: /Research question/ }).fill('Why?')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  // More room: hide the browser pane.
  await page.getByRole('button', { name: 'Hide browser', exact: true }).click()
  await expect(page.locator('.react-flow__node-question')).toBeVisible()
})
test.afterEach(async () => {
  await launched.close()
  rmSync(userData, { recursive: true, force: true })
})

const getBoard = (page: Page): Promise<Board> => page.evaluate(() => window.__waDebug!.getBoard())
const history = (page: Page): Promise<{ past: number; future: number }> =>
  page.evaluate(() => window.__waDebug!.getHistorySizes())
const notes = async (page: Page): Promise<CanvasNode[]> =>
  Object.values((await getBoard(page)).nodes).filter((n) => n.kind === 'note')
const nodeEl = (page: Page, id: string): Locator =>
  page.locator(`.react-flow__node[data-id="${id}"]`)
const pane = (page: Page): Locator => page.locator('.react-flow__pane')

/** Double-clicks empty canvas at (x, y), types the note text and clicks away. */
async function addNote(page: Page, x: number, y: number, text: string): Promise<string> {
  const before = new Set((await notes(page)).map((n) => n.id))
  await pane(page).dblclick({ position: { x, y } })
  await page.waitForFunction(() => document.activeElement?.tagName === 'TEXTAREA')
  await page.keyboard.type(text)
  await pane(page).click({ position: { x: 700, y: 820 } })
  await expect
    .poll(async () => (await notes(page)).find((n) => !before.has(n.id))?.title)
    .toBe(text)
  return (await notes(page)).find((n) => !before.has(n.id))!.id
}

async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number }
): Promise<void> {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 12 })
  await page.mouse.up()
}

const centreOf = async (page: Page, id: string): Promise<{ x: number; y: number }> => {
  const b = (await nodeEl(page, id).boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

test('double-click adds a note; typing and clicking away saves its text', async () => {
  const { page } = launched
  const id = await addNote(page, 200, 160, 'Green bonds')
  await expect(nodeEl(page, id)).toContainText('Green bonds')
  expect(await history(page)).toEqual({ past: 2, future: 0 }) // add + edit
})

test('dragging a note snaps to the 32px grid and is one undo step', async () => {
  const { page } = launched
  const id = await addNote(page, 200, 160, 'Drag me')
  const before = (await getBoard(page)).nodes[id].position
  const steps = (await history(page)).past
  const c = await centreOf(page, id)
  await drag(page, c, { x: c.x + 157, y: c.y + 71 })
  await expect.poll(async () => (await getBoard(page)).nodes[id].position).not.toEqual(before)
  const after = (await getBoard(page)).nodes[id].position
  expect(Math.abs(after.x % 32)).toBe(0)
  expect(Math.abs(after.y % 32)).toBe(0)
  expect((await history(page)).past).toBe(steps + 1)
  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await getBoard(page)).nodes[id].position).toEqual(before)
})

test('dragging from a handle onto another card links them as "related"', async () => {
  const { page } = launched
  const a = await addNote(page, 200, 160, 'From')
  const b = await addNote(page, 900, 160, 'To')
  await nodeEl(page, a).hover()
  const handle = (await nodeEl(page, a).locator('.react-flow__handle-right').boundingBox())!
  await drag(page, { x: handle.x + 5, y: handle.y + 5 }, await centreOf(page, b))
  await expect
    .poll(async () => Object.values((await getBoard(page)).edges))
    .toEqual([
      expect.objectContaining({ source: a, target: b, relation: 'related', origin: 'user' })
    ])
  await expect(page.locator('.wa-edge__label')).toHaveText('related')
})

test('Delete removes a card and its links; undo and redo work', async () => {
  const { page } = launched
  const a = await addNote(page, 200, 160, 'Keep')
  const b = await addNote(page, 900, 160, 'Delete me')
  await nodeEl(page, a).hover()
  const handle = (await nodeEl(page, a).locator('.react-flow__handle-right').boundingBox())!
  await drag(page, { x: handle.x + 5, y: handle.y + 5 }, await centreOf(page, b))
  await expect.poll(async () => Object.keys((await getBoard(page)).edges).length).toBe(1)

  await nodeEl(page, b).click()
  await page.keyboard.press('Delete')
  await expect.poll(async () => (await getBoard(page)).nodes[b]).toBeUndefined()
  expect(Object.keys((await getBoard(page)).edges)).toEqual([])

  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await getBoard(page)).nodes[b]?.title).toBe('Delete me')
  expect(Object.keys((await getBoard(page)).edges)).toHaveLength(1)

  await page.keyboard.press('Control+Shift+Z')
  await expect.poll(async () => (await getBoard(page)).nodes[b]).toBeUndefined()
})

test('the research question card cannot be deleted', async () => {
  const { page } = launched
  await page.locator('.react-flow__node-question').click()
  await page.keyboard.press('Delete')
  await page.waitForTimeout(200)
  const questions = Object.values((await getBoard(page)).nodes).filter((n) => n.kind === 'question')
  expect(questions).toHaveLength(1)
  expect((await history(page)).past).toBe(0)
})

test('dragging a note into and out of a group sets and clears its parent', async () => {
  const { page } = launched
  const anchor = await addNote(page, 160, 160, 'In the group')
  const loose = await addNote(page, 700, 640, 'Loose')
  await nodeEl(page, anchor).click()
  const groupId = await page.evaluate(() => window.__waDev!.groupSelected('Funding models'))
  expect(groupId).toBeTruthy()
  await expect(page.locator('.react-flow__node-frame')).toContainText('Funding models')

  const frame = (await nodeEl(page, groupId!).boundingBox())!
  const steps = (await history(page)).past
  await drag(page, await centreOf(page, loose), {
    x: frame.x + frame.width - 60,
    y: frame.y + frame.height - 40
  })
  await expect.poll(async () => (await getBoard(page)).nodes[loose].parentGroupId).toBe(groupId)
  expect((await history(page)).past).toBe(steps + 1)

  // Dragging the group moves the note with it.
  const relative = (await getBoard(page)).nodes[loose].position
  const label = page.locator('.react-flow__node-frame .wa-group')
  const lb = (await label.boundingBox())!
  await drag(
    page,
    { x: lb.x + 10, y: lb.y + lb.height - 10 },
    { x: lb.x + 106, y: lb.y + lb.height + 54 }
  )
  await expect
    .poll(async () => (await getBoard(page)).groups[groupId!].position)
    .not.toEqual({
      x: frame.x,
      y: frame.y
    })
  expect((await getBoard(page)).nodes[loose].position).toEqual(relative)

  await drag(page, await centreOf(page, loose), { x: 1200, y: 760 })
  await expect.poll(async () => (await getBoard(page)).nodes[loose].parentGroupId).toBeUndefined()
  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await getBoard(page)).nodes[loose].parentGroupId).toBe(groupId)
})

test('Ctrl+A selects everything; an arrow key moves the selection one grid step', async () => {
  const { page } = launched
  const id = await addNote(page, 200, 160, 'Nudge')
  await pane(page).click({ position: { x: 700, y: 820 } })
  await page.keyboard.press('Control+a')
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(2)
  const before = await getBoard(page)
  await page.keyboard.press('ArrowRight')
  await expect
    .poll(async () => (await getBoard(page)).nodes[id].position.x)
    .toBe(before.nodes[id].position.x + 32)
  const question = Object.values(before.nodes).find((n) => n.kind === 'question')!
  expect((await getBoard(page)).nodes[question.id].position.x).toBe(question.position.x + 32)
  await page.keyboard.press('Escape')
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(0)
})

test('the viewport and cards survive a relaunch; minimap and controls are shown', async () => {
  let { page } = launched
  await expect(page.locator('.react-flow__minimap')).toBeVisible()
  await expect(page.locator('.react-flow__controls')).toBeVisible()
  await addNote(page, 200, 160, 'Persisted')
  await drag(page, { x: 700, y: 700 }, { x: 560, y: 600 }) // pan
  await page.mouse.move(700, 450)
  await page.mouse.wheel(0, -300) // zoom in
  await expect
    .poll(async () => (await page.evaluate(() => window.__waDebug!.getSession()!.viewport)).zoom)
    .not.toBe(1)
  await page.waitForTimeout(300)
  const viewport = await page.evaluate(() => window.__waDebug!.getSession()!.viewport)

  await launched.close()
  launched = await launchApp({ userData })
  page = launched.page
  await page.getByRole('button', { name: 'Open Canvas test' }).click()
  await expect(page.locator('.react-flow__node-note')).toContainText('Persisted')
  expect(await page.evaluate(() => window.__waDebug!.getSession()!.viewport)).toEqual(viewport)
  const transform = await page.locator('.react-flow__viewport').getAttribute('style')
  // The browser rounds the scale it prints, so compare numerically.
  const scale = Number(/scale\(([\d.]+)\)/.exec(transform ?? '')?.[1])
  expect(scale).toBeCloseTo(viewport.zoom, 4)
})

test('resizing a note from its corner is one undo step', async () => {
  const { page } = launched
  const id = await addNote(page, 200, 160, 'Resize me')
  await nodeEl(page, id).click()
  const corner = (await nodeEl(page, id)
    .locator('.react-flow__resize-control.bottom.right')
    .boundingBox())!
  await drag(page, { x: corner.x + 4, y: corner.y + 4 }, { x: corner.x + 124, y: corner.y + 84 })
  await expect.poll(async () => (await getBoard(page)).nodes[id].size?.w ?? 0).toBeGreaterThan(300)
  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await getBoard(page)).nodes[id].size).toBeUndefined()
})

test('editing: Escape cancels; the question is edited in place and undoable', async () => {
  const { page } = launched
  const id = await addNote(page, 200, 160, 'Original')
  await nodeEl(page, id).dblclick()
  await page.waitForFunction(() => document.activeElement?.tagName === 'TEXTAREA')
  await page.keyboard.type('Changed')
  await page.keyboard.press('Escape')
  await expect(nodeEl(page, id)).toContainText('Original')
  expect((await getBoard(page)).nodes[id].title).toBe('Original')

  const question = page.locator('.react-flow__node-question')
  await question.dblclick()
  await page.waitForFunction(() => document.activeElement?.tagName === 'TEXTAREA')
  await page.keyboard.press('Control+a')
  await page.keyboard.type('How do cities pay for sea walls?')
  await page.keyboard.press('Control+Enter')
  await expect(question).toContainText('How do cities pay for sea walls?')
  // Ctrl+Z inside a text box would undo text; on the canvas it undoes the edit.
  await page.keyboard.press('Control+z')
  await expect(question).toContainText('Why?')
})
