import { expect, test } from '@playwright/test'
import {
  addNote,
  clickEmpty,
  createWorkspace,
  getBoard,
  history,
  link,
  nodeEl
} from './helpers/canvas'
import { launchApp, type LaunchedApp } from './helpers/launch'

let launched: LaunchedApp
test.beforeEach(async () => {
  launched = await launchApp()
  await launched.page.setViewportSize({ width: 1440, height: 900 })
  await createWorkspace(launched.page, 'Toolbar', 'Why?', { hideBrowser: true })
})
test.afterEach(async () => {
  await launched.close()
})

test('colour, group, rename, relabel a link, then undo everything', async () => {
  const { page } = launched
  const a = await addNote(page, 200, 140, 'Green bonds')
  const b = await addNote(page, 650, 140, 'Insurance pools')
  await link(page, a, b)
  await expect.poll(async () => Object.keys((await getBoard(page)).edges).length).toBe(1)
  const start = await getBoard(page)
  const startSteps = (await history(page)).past

  // Select both: the toolbar sits above them.
  await nodeEl(page, a).click()
  await nodeEl(page, b).click({ modifiers: ['Shift'] })
  const toolbar = page.getByRole('toolbar', { name: 'Selection' })
  await expect(toolbar).toBeVisible()
  const tb = (await toolbar.boundingBox())!
  const card = (await nodeEl(page, a).boundingBox())!
  expect(tb.y + tb.height).toBeLessThanOrEqual(card.y)

  // Colour rose → both rose.
  await toolbar.getByRole('button', { name: 'Colour rose' }).click()
  await expect
    .poll(async () => [
      (await getBoard(page)).nodes[a].color,
      (await getBoard(page)).nodes[b].color
    ])
    .toEqual(['rose', 'rose'])

  // Group → a group containing both, label ready to rename.
  await toolbar.getByRole('button', { name: 'Group' }).click()
  const label = page.getByRole('textbox', { name: 'Group name' })
  await expect(label).toBeFocused()
  await label.fill('Funding models')
  await label.press('Enter')
  await expect
    .poll(async () => Object.values((await getBoard(page)).groups).map((g) => g.label))
    .toEqual(['Funding models'])
  const groupId = Object.keys((await getBoard(page)).groups)[0]
  expect((await getBoard(page)).nodes[a].parentGroupId).toBe(groupId)
  expect((await getBoard(page)).nodes[b].parentGroupId).toBe(groupId)

  // Double-click the link's label → "supports".
  await clickEmpty(page)
  await page.locator('.wa-edge__label').dblclick()
  await page.getByRole('menuitem', { name: 'supports' }).click()
  await expect(page.locator('.wa-edge__label')).toHaveText('supports')

  // Undo each step (colour, group, rename, relabel) → back to the start.
  expect((await history(page)).past).toBe(startSteps + 4)
  for (let i = 0; i < 4; i++) {
    await clickEmpty(page)
    await page.keyboard.press('Control+z')
  }
  await expect.poll(async () => (await history(page)).past).toBe(startSteps)
  expect(await getBoard(page)).toEqual(start)
})

test('Custom… gives a link its own label; Delete link removes it (undoable)', async () => {
  const { page } = launched
  const a = await addNote(page, 200, 140, 'Source')
  const b = await addNote(page, 650, 140, 'Claim')
  await link(page, a, b)
  await page.locator('.wa-edge__label').dblclick()
  await page.getByRole('menuitem', { name: 'Custom…' }).click()
  const field = page.getByRole('textbox', { name: 'Label' })
  await expect(field).toBeFocused()
  await field.fill('cites')
  await field.press('Enter')
  await expect(page.locator('.wa-edge__label')).toHaveText('cites')

  await page.locator('.wa-edge__label').dblclick()
  await page.getByRole('menuitem', { name: 'Delete link' }).click()
  await expect(page.locator('.wa-edge__label')).toHaveCount(0)
  await clickEmpty(page)
  await page.keyboard.press('Control+z')
  await expect(page.locator('.wa-edge__label')).toHaveText('cites')
})

test('a new group never covers the research question', async () => {
  const { page } = launched
  // Two notes just above the question card: their natural group frame would overlap it.
  const q = (await page.locator('.react-flow__node-question').boundingBox())!
  const pane = (await page.locator('.react-flow__pane').boundingBox())!
  const a = await addNote(page, q.x - pane.x + 10, q.y - pane.y - 120, 'One')
  const b = await addNote(page, q.x - pane.x + 260, q.y - pane.y - 120, 'Two')
  await nodeEl(page, a).click()
  await nodeEl(page, b).click({ modifiers: ['Shift'] })
  await page
    .getByRole('toolbar', { name: 'Selection' })
    .getByRole('button', { name: 'Group' })
    .click()
  await page.keyboard.press('Escape')
  const board = await getBoard(page)
  const group = Object.values(board.groups)[0]
  const question = Object.values(board.nodes).find((n) => n.kind === 'question')!
  const overlaps =
    group.position.x < question.position.x + 320 &&
    group.position.x + group.size.w > question.position.x &&
    group.position.y < question.position.y + 160 &&
    group.position.y + group.size.h > question.position.y
  expect(overlaps).toBe(false)
})
