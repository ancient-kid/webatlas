// Real local embeddings through the app's IPC (transformers.js in Electron's main
// process). Uses the shared model cache so the ~23 MB model downloads only once.
// Set WA_SKIP_MODEL=1 to skip (e.g. offline before the first download).
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { launchApp, type LaunchedApp } from './helpers/launch'
import { seedWorkspace } from './helpers/seed'

const MODEL_CACHE =
  process.env.WA_MODEL_CACHE || join(process.env.APPDATA ?? '.', 'webatlas', 'models')

let launched: LaunchedApp | undefined
let userData: string

test.beforeEach(() => {
  userData = mkdtempSync(join(tmpdir(), 'webatlas-e2e-'))
  seedWorkspace(userData)
})

test.afterEach(async () => {
  await launched?.close()
  launched = undefined
  rmSync(userData, { recursive: true, force: true })
})

const dot = (a: number[], b: number[]): number => a.reduce((s, x, i) => s + x * b[i], 0)

test('ai.embed runs the real model in main, caches vectors, and only re-embeds changes', async () => {
  test.skip(process.env.WA_SKIP_MODEL === '1', 'model tests disabled with WA_SKIP_MODEL=1')
  test.setTimeout(180_000)
  launched = await launchApp({ userData, env: { WA_MODEL_CACHE: MODEL_CACHE } })
  const { page } = launched
  await expect(page.getByTestId('app-root')).toBeVisible()

  const items = [
    { id: 'a', text: 'Rotterdam builds sea walls and storm barriers against coastal flooding.' },
    { id: 'b', text: 'Coastal cities invest in dikes and sea walls against rising seas.' },
    { id: 'c', text: 'Boil the pasta in salted water, then toss it with garlic and olive oil.' }
  ]
  const t0 = Date.now()
  const first = await page.evaluate((it) => window.api.ai.embed('seeded-ws', it), items)
  const firstMs = Date.now() - t0
  expect(first.a).toHaveLength(384)
  expect(dot(first.a, first.a)).toBeCloseTo(1, 3)
  expect(dot(first.a, first.b)).toBeGreaterThan(0.45)
  expect(dot(first.a, first.c)).toBeLessThan(0.25)

  const cache = join(userData, 'workspaces', 'seeded-ws', 'embeddings.json')
  expect(existsSync(cache)).toBe(true)
  const stored = JSON.parse(readFileSync(cache, 'utf8')) as Record<string, { hash: string }>
  expect(Object.keys(stored).sort()).toEqual(['a', 'b', 'c'])

  // Same texts again: served from the cache (identical vectors, much faster).
  const t1 = Date.now()
  const second = await page.evaluate((it) => window.api.ai.embed('seeded-ws', it), items)
  expect(Date.now() - t1).toBeLessThan(Math.max(500, firstMs))
  expect(second).toEqual(first)

  // One changed text: only that hash changes.
  const changed = [...items.slice(0, 2), { id: 'c', text: 'Pasta with garlic, tomato and basil.' }]
  await page.evaluate((it) => window.api.ai.embed('seeded-ws', it), changed)
  const after = JSON.parse(readFileSync(cache, 'utf8')) as Record<string, { hash: string }>
  expect(after.a.hash).toBe(stored.a.hash)
  expect(after.c.hash).not.toBe(stored.c.hash)
})

test('test runs do not load the model at startup', async () => {
  launched = await launchApp({ userData })
  await expect(launched.page.getByTestId('app-root')).toBeVisible()
  await launched.page.waitForTimeout(1500)
  expect(launched.output.filter((l) => l.includes('[embed]'))).toEqual([])
})
