import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cosine, embedTexts, EMBEDDING_DIMS, SAMPLE_SENTENCES } from './embeddingModel'

// Real-model tests share the app's model cache (downloaded once, ~23 MB).
// Set WA_SKIP_MODEL=1 to skip them, e.g. offline before the first download.
const CACHE =
  process.env.WA_MODEL_CACHE ||
  join(process.env.APPDATA ?? join(process.env.HOME ?? '.', '.config'), 'webatlas', 'models')
const skipModel = process.env.WA_SKIP_MODEL === '1'

describe('cosine', () => {
  it('is 1 for identical direction and ignores magnitude', () => {
    expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1)
    expect(cosine([1, 2, 3], [2, 4, 6])).toBeCloseTo(1)
  })

  it('is 0 for orthogonal and -1 for opposite vectors', () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0)
    expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1)
  })

  it('returns 0 for a zero vector instead of NaN', () => {
    expect(cosine([0, 0], [1, 1])).toBe(0)
  })

  it('throws on a length mismatch', () => {
    expect(() => cosine([1, 2], [1, 2, 3])).toThrow(/length mismatch/)
  })
})

describe('embedTexts (no model needed)', () => {
  it('returns an empty list for no input', async () => {
    expect(await embedTexts(CACHE, [])).toEqual([])
  })
})

describe.skipIf(skipModel)('embedTexts with the real MiniLM model', () => {
  it('returns one unit-length 384-dim vector per text, in order', async () => {
    const vectors = await embedTexts(CACHE, [SAMPLE_SENTENCES.seaWallA, SAMPLE_SENTENCES.pasta])
    expect(vectors).toHaveLength(2)
    for (const v of vectors) {
      expect(v).toHaveLength(EMBEDDING_DIMS)
      expect(Math.hypot(...v)).toBeCloseTo(1, 4)
    }
    // Batching pads shorter texts; with the 8-bit model that shifts vectors very slightly
    // (measured ~0.994 vs embedding alone), so order is checked by similarity, not equality.
    const [single] = await embedTexts(CACHE, [SAMPLE_SENTENCES.pasta])
    expect(cosine(single, vectors[1])).toBeGreaterThan(0.99)
    expect(cosine(single, vectors[0])).toBeLessThan(0.25)
  }, 180_000)

  it('scores related sentences clearly above unrelated ones', async () => {
    const [a, b, c] = await embedTexts(CACHE, [
      SAMPLE_SENTENCES.seaWallA,
      SAMPLE_SENTENCES.seaWallB,
      SAMPLE_SENTENCES.pasta
    ])
    const related = cosine(a, b)
    const unrelated = cosine(a, c)
    expect(related).toBeGreaterThan(0.45)
    expect(unrelated).toBeLessThan(0.25)
    expect(related - unrelated).toBeGreaterThan(0.2)
  }, 60_000)

  it('is deterministic for the same text', async () => {
    const [first] = await embedTexts(CACHE, [SAMPLE_SENTENCES.seaWallB])
    const [second] = await embedTexts(CACHE, [SAMPLE_SENTENCES.seaWallB])
    expect(second).toEqual(first)
  }, 60_000)
})
