// Spike 2 (T03): transformers.js must run inside Electron's main process, not just in
// plain Node. Uses the shared model cache so the ~23 MB model downloads only once.
// Set WA_SKIP_MODEL=1 to skip (e.g. offline before the first download).
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { launchApp, type LaunchedApp } from './helpers/launch'

const MODEL_CACHE =
  process.env.WA_MODEL_CACHE || join(process.env.APPDATA ?? '.', 'webatlas', 'models')

test.skip(process.env.WA_SKIP_MODEL === '1', 'model tests disabled with WA_SKIP_MODEL=1')

let launched: LaunchedApp | undefined

test.afterEach(async () => {
  await launched?.close()
  launched = undefined
})

function spikeResult(output: string[]): Record<string, unknown> | null {
  const line = output.find((l) => l.startsWith('[embed-spike] {'))
  return line ? (JSON.parse(line.slice('[embed-spike] '.length)) as Record<string, unknown>) : null
}

test('embeds text inside the Electron main process', async () => {
  test.setTimeout(180_000)
  launched = await launchApp({ env: { WA_SPIKE_EMBED: '1', WA_MODEL_CACHE: MODEL_CACHE } })
  // The UI is not blocked while the model loads.
  await expect(launched.page.getByTestId('app-root')).toBeVisible()
  await expect.poll(() => spikeResult(launched!.output), { timeout: 150_000 }).not.toBeNull()
  const result = spikeResult(launched.output) as {
    ok: boolean
    error?: string
    dims: number
    similarity: { related: number; unrelated: number }
    secondRunMs: number
  }
  expect(result.error).toBeUndefined()
  expect(result.ok).toBe(true)
  expect(result.dims).toBe(384)
  expect(result.similarity.related).toBeGreaterThan(0.45)
  expect(result.similarity.unrelated).toBeLessThan(0.25)
  expect(result.similarity.related - result.similarity.unrelated).toBeGreaterThan(0.2)
  expect(result.secondRunMs).toBeLessThan(1000)
  expect(
    existsSync(join(MODEL_CACHE, 'Xenova', 'all-MiniLM-L6-v2', 'onnx', 'model_quantized.onnx'))
  ).toBe(true)
})

test('does not load the model unless asked', async () => {
  launched = await launchApp()
  await expect(launched.page.getByTestId('app-root')).toBeVisible()
  await launched.page.waitForTimeout(1500)
  expect(launched.output.filter((l) => l.includes('[embed-spike]'))).toEqual([])
})
