// Local sentence embeddings with transformers.js (all-MiniLM-L6-v2, 8-bit quantized, 384 dims).
// Runs on the CPU in the main process; the model downloads once (~23 MB) into `cacheDir`
// and is loaded from disk after that. The library is imported lazily so app startup
// never pays for it.
import type { FeatureExtractionPipeline } from '@huggingface/transformers'

export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2'
export const EMBEDDING_DIMS = 384

/** Two related sentences and an unrelated one (model sanity checks in tests). */
export const SAMPLE_SENTENCES = {
  seaWallA:
    'Rotterdam builds sea walls and storm barriers to protect the city from coastal flooding.',
  seaWallB:
    'Coastal cities invest in flood defences such as dikes and sea walls against rising seas.',
  pasta: 'Boil the pasta in salted water for nine minutes, then toss it with garlic and olive oil.'
}

let extractor: Promise<FeatureExtractionPipeline> | null = null
let extractorCacheDir: string | null = null

/** Loads (once) the feature-extraction pipeline, caching model files in `cacheDir`. */
export function getExtractor(cacheDir: string): Promise<FeatureExtractionPipeline> {
  if (extractor && extractorCacheDir === cacheDir) return extractor
  extractorCacheDir = cacheDir
  extractor = (async () => {
    const { env, pipeline } = await import('@huggingface/transformers')
    env.cacheDir = cacheDir
    env.allowLocalModels = false
    return pipeline('feature-extraction', EMBEDDING_MODEL, { dtype: 'q8' })
  })()
  // A failed load must not poison later attempts (e.g. offline on first run).
  extractor.catch(() => {
    extractor = null
    extractorCacheDir = null
  })
  return extractor
}

/** Embeds texts as unit-length vectors (mean pooling + L2 normalisation). */
export async function embedTexts(cacheDir: string, texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const run = await getExtractor(cacheDir)
  const output = await run(texts, { pooling: 'mean', normalize: true })
  return output.tolist() as number[][]
}

/** Cosine similarity of two vectors. For unit-length vectors this is the dot product. */
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`)
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / Math.sqrt(na * nb)
}
