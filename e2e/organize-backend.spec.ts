// T17: the Organize backend end to end (embeddings → clustering → agent loop → ghosts),
// in AI mock mode: the scripted Haiku stand-in drives the real loop and tool mapping.
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import type { Ghost } from '../src/shared/types'
import { getBoard } from './helpers/canvas'
import { launchApp, type LaunchedApp } from './helpers/launch'
import { seedWorkspace } from './helpers/seed'

let launched: LaunchedApp
let userData: string

test.beforeEach(async () => {
  userData = mkdtempSync(join(tmpdir(), 'webatlas-e2e-'))
  seedWorkspace(userData)
  seedWorkspace(userData, { id: 'two-cards', name: 'Two cards', cards: 2 })
  launched = await launchApp({ userData, env: { WA_AI_MOCK: '1' } })
})

test.afterEach(async () => {
  await launched.close()
  rmSync(userData, { recursive: true, force: true })
})

async function open(name: string): Promise<void> {
  const { page } = launched
  await page.getByRole('button', { name: `Open ${name}` }).click()
  await expect(page.getByTestId('workspace-screen')).toBeVisible()
}

test('Organize on 6 cards returns reasoned ghosts of every kind (mode haiku) without changing the board', async () => {
  await open('Seeded research')
  const { page } = launched
  const before = await getBoard(page)
  const res = await page.evaluate(() => window.__waDebug!.organize())

  expect(res.mode).toBe('haiku')
  expect(res.message).toBeUndefined()
  const kinds = new Set(res.ghosts.map((g: Ghost) => g.kind))
  expect(kinds).toEqual(new Set(['group', 'edge', 'tag']))
  for (const g of res.ghosts) {
    expect(g.rationale.length).toBeGreaterThan(5)
    expect(g.confidence).toBeGreaterThanOrEqual(0.4)
    expect(g.title.length).toBeGreaterThan(5)
  }
  // The two topics come back as two groups, each from one topic.
  const groups = res.ghosts.filter((g: Ghost) => g.command.type === 'createGroup')
  expect(groups).toHaveLength(2)
  for (const g of groups) {
    if (g.command.type !== 'createGroup') continue
    const prefixes = new Set(g.command.payload.memberIds.map((id) => id.split('-')[0]))
    expect(prefixes.size).toBe(1)
    expect(g.command.payload.memberIds.length).toBeGreaterThanOrEqual(2)
  }
  // Every id points at a real card (aliases were mapped back).
  for (const g of res.ghosts) {
    const ids =
      g.command.type === 'connect'
        ? [g.command.payload.edge.source, g.command.payload.edge.target]
        : g.command.type === 'createGroup'
          ? g.command.payload.memberIds
          : g.command.type === 'addTags'
            ? g.command.payload.nodeIds
            : []
    for (const id of ids) expect(before.nodes[id]).toBeDefined()
  }

  // Nothing was applied.
  expect(await getBoard(page)).toEqual(before)

  // Embeddings were cached for the workspace.
  const cache = join(userData, 'workspaces', 'seeded-ws', 'embeddings.json')
  expect(existsSync(cache)).toBe(true)
  expect(Object.keys(JSON.parse(readFileSync(cache, 'utf8'))).sort()).toEqual([
    'coffee-1',
    'coffee-2',
    'coffee-3',
    'flood-1',
    'flood-2',
    'flood-3'
  ])

  // One log line with counts, and no page text.
  await expect.poll(() => launched.output.some((l) => l.includes('[organize]'))).toBe(true)
  const log = launched.output.filter((l) => l.includes('[organize]')).join('\n')
  expect(log).toContain('"mode":"haiku"')
  expect(log).toContain('"toolErrors":1') // the mock's deliberate bad id came back as is_error
  expect(log).not.toContain('storm surge')
})

test('fewer than 3 cards → "Capture a few more pages first."', async () => {
  await open('Two cards')
  const res = await launched.page.evaluate(() => window.__waDebug!.organize())
  expect(res).toEqual({ ghosts: [], mode: 'offline', message: 'Capture a few more pages first.' })
})

test('the main process rejects a malformed snapshot', async () => {
  await open('Seeded research')
  const error = await launched.page.evaluate(() =>
    window.api.ai
      .organize({ nodes: 'nope' } as never)
      .then(() => '')
      .catch((e: Error) => e.message)
  )
  expect(error).toContain('Invalid board snapshot')
})

test('ai.embed returns cached vectors for valid items and rejects bad ones', async () => {
  const { page } = launched
  const vecs = await page.evaluate(() =>
    window.api.ai.embed('seeded-ws', [
      { id: 'x', text: 'sea walls and flood defences' },
      { id: 'y', text: 'sea walls and flood barriers' }
    ])
  )
  expect(vecs.x).toHaveLength(384)
  expect(vecs.y).toHaveLength(384)
  const bad = await page.evaluate(() =>
    window.api.ai
      .embed('../escape', [])
      .then(() => '')
      .catch((e: Error) => e.message)
  )
  expect(bad).toContain('Invalid workspace id')
})
