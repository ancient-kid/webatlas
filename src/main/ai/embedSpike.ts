// T02/T03 spike 2: does transformers.js run inside Electron's main process?
// Enabled with WA_SPIKE_EMBED=1; prints one `[embed-spike]` JSON line. Replaced by the
// real embedding pipeline tests in T17.
import { cosine, embedTexts, EMBEDDING_DIMS, EMBEDDING_MODEL } from './embeddingModel'

export const SPIKE_SENTENCES = {
  seaWallA:
    'Rotterdam builds sea walls and storm barriers to protect the city from coastal flooding.',
  seaWallB:
    'Coastal cities invest in flood defences such as dikes and sea walls against rising seas.',
  pasta: 'Boil the pasta in salted water for nine minutes, then toss it with garlic and olive oil.'
}

export interface EmbedSpikeResult {
  ok: true
  model: string
  dims: number
  loadAndEmbedMs: number
  secondRunMs: number
  similarity: { related: number; unrelated: number }
}

export async function runEmbedSpike(cacheDir: string): Promise<EmbedSpikeResult> {
  const texts = [SPIKE_SENTENCES.seaWallA, SPIKE_SENTENCES.seaWallB, SPIKE_SENTENCES.pasta]
  const t0 = performance.now()
  const [a, b, c] = await embedTexts(cacheDir, texts)
  const t1 = performance.now()
  await embedTexts(cacheDir, texts)
  const t2 = performance.now()
  if (a.length !== EMBEDDING_DIMS)
    throw new Error(`Expected ${EMBEDDING_DIMS} dims, got ${a.length}`)
  const round = (n: number): number => Math.round(n * 1000) / 1000
  return {
    ok: true,
    model: EMBEDDING_MODEL,
    dims: a.length,
    loadAndEmbedMs: Math.round(t1 - t0),
    secondRunMs: Math.round(t2 - t1),
    similarity: { related: round(cosine(a, b)), unrelated: round(cosine(a, c)) }
  }
}
