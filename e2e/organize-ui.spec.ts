// T18: the Organize button, ghosts on the canvas, and the Suggestions panel, in AI mock
// mode (the scripted Haiku stand-in, through the real agent loop).
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type Locator, type Page } from '@playwright/test'
import type { Board, Ghost } from '../src/shared/types'
import { clickEmpty, getBoard, history } from './helpers/canvas'
import { launchApp, type LaunchedApp } from './helpers/launch'
import { seedWorkspace } from './helpers/seed'

let launched: LaunchedApp
let userData: string
const SHOTS = process.env.WA_SHOTS_DIR

test.beforeEach(async () => {
  userData = mkdtempSync(join(tmpdir(), 'webatlas-e2e-'))
  seedWorkspace(userData)
  launched = await launchApp({ userData, env: { WA_AI_MOCK: '1' } })
  await openSeeded()
})

test.afterEach(async () => {
  await launched.close()
  rmSync(userData, { recursive: true, force: true })
})

async function openSeeded(): Promise<void> {
  const { page } = launched
  await page.getByRole('button', { name: 'Open Seeded research' }).click()
  await expect(page.getByTestId('workspace-screen')).toBeVisible()
  await expect(page.locator('.react-flow__node-card')).toHaveCount(6)
  // First-run hints sit over the canvas; dismiss them as a student would.
  const gotIt = page.getByTestId('hint-got-it')
  if (await gotIt.isVisible()) await gotIt.click()
}

async function relaunch(): Promise<void> {
  await launched.close()
  launched = await launchApp({ userData, env: { WA_AI_MOCK: '1' } })
  await openSeeded()
}

const ghosts = async (page: Page): Promise<Ghost[]> =>
  Object.values((await getBoard(page)).ghosts).sort((a, b) => (a.id < b.id ? -1 : 1))
const panelCards = (page: Page): Locator => page.getByRole('group', { name: /^Suggestion:/ })

async function organize(page: Page): Promise<void> {
  const button = page.getByTestId('organize-button')
  await button.click()
  await expect(button).toHaveText('Organizing…')
  await expect(button).toBeDisabled()
  await expect(button).toHaveText('Organize', { timeout: 20_000 })
  await expect(button).toBeEnabled()
}

const shot = async (page: Page, name: string): Promise<void> => {
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`) })
}

function groupGhostOf(list: Ghost[]): Ghost {
  return list.find((g) => g.kind === 'group')!
}

test('Organize shows a busy state, then dashed ghosts on the canvas and N cards in the panel', async () => {
  const { page } = launched
  await expect(page.getByTestId('suggestions-toggle')).toHaveAccessibleName('Suggestions (0)')
  await organize(page)
  const list = await ghosts(page)
  expect(list.length).toBeGreaterThanOrEqual(4)

  // Toast and the Suggestions tab.
  await expect(page.getByText(`${list.length} suggestions to review`)).toBeVisible()
  await expect(page.getByTestId('suggestions-panel')).toBeVisible()
  await expect(page.getByRole('tab', { name: `Suggestions (${list.length})` })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(panelCards(page)).toHaveCount(list.length)
  await expect(panelCards(page).first()).toContainText('Suggested group')
  await expect(panelCards(page).first()).toContainText('% match')

  // Dashed group frames labelled "(suggested)" and dashed links ending in "?".
  const groupCount = list.filter((g) => g.kind === 'group').length
  const edgeCount = list.filter((g) => g.kind === 'edge').length
  await expect(page.locator('.react-flow__node-ghostGroup .wa-group--ghost')).toHaveCount(
    groupCount
  )
  const pills = page.locator('.wa-ghost-pill')
  await expect(pills).toHaveCount(groupCount)
  await expect(pills.first()).toContainText('(suggested)')
  // Each label is on top (not covered by a card or another frame) at its centre.
  for (const pill of await pills.all()) {
    const onTop = await pill.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return hit !== null && el.contains(hit)
    })
    expect(onTop).toBe(true)
  }
  await expect(page.locator('.wa-ghost-edge')).toHaveCount(edgeCount)
  await expect(page.locator('.wa-ghost-edge').first()).toHaveAttribute(
    'style',
    /stroke-dasharray: 6(px)?,? 5/
  )
  await expect(page.locator('.wa-ghost-label').first()).toContainText('?')
  // The tag suggestion shows as a dashed chip on its card.
  await expect(page.locator('.wa-tag--ghost')).toHaveCount(
    list.filter((g) => g.kind === 'tag').length
  )
  // Nothing solid was added, and suggestions are not undo steps.
  const board = await getBoard(page)
  expect(Object.keys(board.groups)).toHaveLength(0)
  expect(Object.keys(board.edges)).toHaveLength(0)
  expect((await history(page)).past).toBe(0)
  await shot(page, 'organize-ghosts')

  // Pointing at a suggestion in the panel emphasises its ghost on the canvas.
  await panelCards(page).first().hover()
  await expect(page.locator('.wa-group--ghost.wa-ghost-hot')).toHaveCount(1)
  await expect(page.locator('.wa-ghost-head.wa-ghost-hot')).toHaveCount(1)
  await shot(page, 'organize-hover')
})

test('accept a group → a solid group holding its cards; Ctrl+Z brings the ghost back', async () => {
  const { page } = launched
  await organize(page)
  const group = groupGhostOf(await ghosts(page))
  if (group.command.type !== 'createGroup') throw new Error('expected a group')
  const members = group.command.payload.memberIds
  const groupId = group.command.payload.group.id
  const before = await getBoard(page)

  await panelCards(page)
    .filter({ hasText: group.title })
    .getByRole('button', { name: 'Accept' })
    .click()
  await expect.poll(async () => Object.keys((await getBoard(page)).groups)).toEqual([groupId])
  const after = await getBoard(page)
  expect(after.groups[groupId].label).toBe(group.command.payload.group.label)
  for (const id of members) expect(after.nodes[id].parentGroupId).toBe(groupId)
  expect(after.ghosts[group.id]).toBeUndefined()
  await expect(page.locator('.react-flow__node-frame')).toHaveCount(1)
  await expect(page.locator(`.react-flow__node-frame`)).toContainText(
    group.command.payload.group.label,
    { ignoreCase: true }
  )
  await expect(page.locator('.react-flow__node-ghostGroup')).toHaveCount(
    (await ghosts(page)).filter((g) => g.kind === 'group').length
  )
  // The view frames the new group: it is fully inside the canvas.
  const frame = page.locator('.react-flow__node-frame')
  const pane = page.locator('.react-flow__pane')
  await expect
    .poll(async () => {
      const f = await frame.boundingBox()
      const p = await pane.boundingBox()
      if (!f || !p) return false
      return (
        f.x >= p.x &&
        f.y >= p.y &&
        f.x + f.width <= p.x + p.width &&
        f.y + f.height <= p.y + p.height
      )
    })
    .toBe(true)
  await page.waitForTimeout(400)
  await shot(page, 'organize-accepted-group')

  await clickEmpty(page)
  await page.keyboard.press('Control+z')
  await expect.poll(async () => Object.keys((await getBoard(page)).groups)).toEqual([])
  const undone = await getBoard(page)
  expect(undone.ghosts[group.id]).toEqual(group)
  for (const id of members) {
    expect(undone.nodes[id].parentGroupId).toBeUndefined()
    expect(undone.nodes[id].position).toEqual(before.nodes[id].position)
  }
  await expect(panelCards(page).filter({ hasText: group.title })).toHaveCount(1)
})

test('accept and reject a link from the canvas label; reject is undoable', async () => {
  const { page } = launched
  await organize(page)
  const edges = (await ghosts(page)).filter((g) => g.kind === 'edge')
  expect(edges.length).toBeGreaterThanOrEqual(2)
  const [first, second] = edges

  // Hovering the dashed label shows ✓ and ✕.
  const label1 = page.locator(`.wa-ghost-label[data-ghost-id="${first.id}"]`)
  await label1.hover()
  await label1.getByRole('button', { name: /^Accept suggested link/ }).click()
  await expect.poll(async () => Object.values((await getBoard(page)).edges).length).toBe(1)
  const made = Object.values((await getBoard(page)).edges)[0]
  expect(made).toMatchObject({ origin: 'ai', relation: 'supports' })
  await expect(page.locator(`.wa-ghost-label[data-ghost-id="${first.id}"]`)).toHaveCount(0)

  const label2 = page.locator(`.wa-ghost-label[data-ghost-id="${second.id}"]`)
  await label2.hover()
  await label2.getByRole('button', { name: /^Reject suggested link/ }).click()
  await expect.poll(async () => (await getBoard(page)).ghosts[second.id]).toBeUndefined()
  expect(Object.values((await getBoard(page)).edges)).toHaveLength(1)

  await clickEmpty(page)
  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await getBoard(page)).ghosts[second.id]).toEqual(second)
  await expect(page.locator(`.wa-ghost-label[data-ghost-id="${second.id}"]`)).toHaveCount(1)
})

test('Accept all applies everything, each as its own undo step', async () => {
  const { page } = launched
  await organize(page)
  const list = await ghosts(page)
  const steps = (await history(page)).past
  await page.getByRole('button', { name: 'Accept all' }).click()
  await expect.poll(async () => (await ghosts(page)).length).toBe(0)
  await expect(page.getByTestId('suggestions-empty')).toBeVisible()
  const board: Board = await getBoard(page)
  expect(Object.keys(board.groups).length).toBe(list.filter((g) => g.kind === 'group').length)
  expect((await history(page)).past).toBe(steps + list.length)
  await expect(page.locator('.react-flow__node-ghostGroup')).toHaveCount(0)
  await expect(page.locator('.wa-ghost-edge')).toHaveCount(0)
  await shot(page, 'organize-accept-all')

  // Undo one at a time: each press brings one suggestion back.
  await clickEmpty(page)
  for (let i = 1; i <= list.length; i++) {
    await page.keyboard.press('Control+z')
    await expect.poll(async () => (await ghosts(page)).length).toBe(i)
  }
  expect(Object.keys((await getBoard(page)).groups)).toHaveLength(0)
})

test('running Organize again replaces pending suggestions and skips accepted ones', async () => {
  const { page } = launched
  await organize(page)
  const firstRun = await ghosts(page)
  const group = groupGhostOf(firstRun)
  await panelCards(page)
    .filter({ hasText: group.title })
    .getByRole('button', { name: 'Accept' })
    .click()
  await expect.poll(async () => Object.keys((await getBoard(page)).groups).length).toBe(1)

  await organize(page)
  const secondRun = await ghosts(page)
  // Fresh suggestions (none of the old pending ids remain)…
  const oldIds = new Set(firstRun.map((g) => g.id))
  expect(secondRun.some((g) => oldIds.has(g.id))).toBe(false)
  // …and the accepted group's cards are not proposed as a group again.
  if (group.command.type !== 'createGroup') throw new Error('expected a group')
  const accepted = new Set(group.command.payload.memberIds)
  for (const g of secondRun) {
    if (g.command.type === 'createGroup') {
      expect(g.command.payload.memberIds.some((id) => accepted.has(id))).toBe(false)
    }
  }
  await expect(panelCards(page)).toHaveCount(secondRun.length)
})

test('pending suggestions survive a relaunch', async () => {
  const { page } = launched
  await organize(page)
  const list = await ghosts(page)
  // Let autosave write the board.
  await page.waitForTimeout(900)
  await relaunch()
  expect(await ghosts(launched.page)).toEqual(list)
  await expect(launched.page.getByTestId('suggestions-toggle')).toHaveAccessibleName(
    `Suggestions (${list.length})`
  )
  await expect(launched.page.locator('.react-flow__node-ghostGroup')).toHaveCount(
    list.filter((g) => g.kind === 'group').length
  )
  await launched.page.getByTestId('suggestions-toggle').click()
  await expect(panelCards(launched.page)).toHaveCount(list.length)
})

test('the Suggestions tab shows the empty state before any Organize', async () => {
  const { page } = launched
  await page.getByTestId('suggestions-toggle').click()
  await expect(page.getByTestId('suggestions-empty')).toHaveText(
    'No suggestions yet. Capture a few pages, then press Organize.'
  )
  await shot(page, 'organize-empty')
  await page.getByRole('button', { name: 'Close suggestions' }).click()
  await expect(page.getByTestId('suggestions-panel')).toHaveCount(0)
})
