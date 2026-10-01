// Fast tests with transformers.js mocked: how the pipeline is configured and called,
// and that a failed load (e.g. offline on first run) can be retried.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const env = { cacheDir: null as string | null, allowLocalModels: true }
  const run = vi.fn(async (texts: string[]) => ({
    tolist: () => texts.map((_, i) => [i, 0, 0])
  }))
  const pipeline = vi.fn(async () => run)
  return { env, run, pipeline }
})

vi.mock('@huggingface/transformers', () => ({ env: mocks.env, pipeline: mocks.pipeline }))

async function freshModule(): Promise<typeof import('./embeddingModel')> {
  vi.resetModules()
  return import('./embeddingModel')
}

beforeEach(() => {
  mocks.pipeline.mockClear()
  mocks.run.mockClear()
  mocks.env.cacheDir = null
  mocks.env.allowLocalModels = true
})

describe('getExtractor configuration', () => {
  it('uses the given cache dir, remote models only, and the 8-bit MiniLM model', async () => {
    const { embedTexts, EMBEDDING_MODEL } = await freshModule()
    await embedTexts('C:/cache/models', ['hello'])
    expect(mocks.env.cacheDir).toBe('C:/cache/models')
    expect(mocks.env.allowLocalModels).toBe(false)
    expect(mocks.pipeline).toHaveBeenCalledWith('feature-extraction', EMBEDDING_MODEL, {
      dtype: 'q8'
    })
  })

  it('embeds with mean pooling and L2 normalisation, preserving order', async () => {
    const { embedTexts } = await freshModule()
    const out = await embedTexts('c', ['a', 'b', 'c'])
    expect(mocks.run).toHaveBeenCalledWith(['a', 'b', 'c'], { pooling: 'mean', normalize: true })
    expect(out.map((v) => v[0])).toEqual([0, 1, 2])
  })

  it('loads the model once and reuses it', async () => {
    const { embedTexts } = await freshModule()
    await embedTexts('c', ['a'])
    await embedTexts('c', ['b'])
    await Promise.all([embedTexts('c', ['x']), embedTexts('c', ['y'])])
    expect(mocks.pipeline).toHaveBeenCalledTimes(1)
  })

  it('does not load the model for an empty batch', async () => {
    const { embedTexts } = await freshModule()
    expect(await embedTexts('c', [])).toEqual([])
    expect(mocks.pipeline).not.toHaveBeenCalled()
  })

  it('retries loading after a failure instead of caching the error', async () => {
    const { embedTexts } = await freshModule()
    mocks.pipeline.mockRejectedValueOnce(new Error('fetch failed (offline)'))
    await expect(embedTexts('c', ['a'])).rejects.toThrow('offline')
    await expect(embedTexts('c', ['a'])).resolves.toHaveLength(1)
    expect(mocks.pipeline).toHaveBeenCalledTimes(2)
  })
})
