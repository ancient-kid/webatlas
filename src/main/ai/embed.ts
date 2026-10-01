// Cached card embeddings. Each workspace keeps `embeddings.json` ({ [nodeId]: { hash, v } }),
// keyed by a hash of the embedded text, so a card is only re-embedded when its content
// changes. Test runs (WA_AI_MOCK) use deterministic bag-of-words vectors instead of the model.
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import type { EmbedItem } from '@shared/api'
import type { BoardSnapshot } from '@shared/types'
import { atomicWrite, serialize } from '../storage/atomicWrite'
import { embFile, isWorkspaceId, wsDir } from '../storage/paths'
import { EMBEDDING_DIMS, EMBEDDING_MODEL, embedTexts } from './embeddingModel'

/** Characters of page text that go into a card's embedding. */
export const EMBED_TEXT_CHARS = 1200
/** Upper bounds for one request (the renderer is untrusted). */
export const MAX_EMBED_ITEMS = 500
export const MAX_EMBED_TEXT = 6000

export type SnapshotNode = BoardSnapshot['nodes'][number]

/** What gets embedded for a card: what it is, what it says, and what the student added. */
export function embeddingText(node: SnapshotNode): string {
  return [
    `${node.title}.`,
    node.summary ?? '',
    node.tags.join(' '),
    node.note,
    node.highlights.join(' '),
    (node.text ?? '').slice(0, EMBED_TEXT_CHARS)
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ')
}

// ─── Mock vectors (test runs) ──────────────────────────────────────────────

const STOP = new Set(
  'the and for are but not you all any can had her was one our out has his how its may new now see two who did get him let say she too use this that with from they have were been will what when your into than then them these some more most such only over also about which their there would could other after'.split(
    ' '
  )
)

function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * A deterministic stand-in for the model: hashed bag of words (signed buckets), unit
 * length. Texts that share words come out similar, unrelated texts near 0.
 */
export function mockVector(text: string, dims = EMBEDDING_DIMS): number[] {
  const v = new Array<number>(dims).fill(0)
  const words = text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []
  for (const w of words) {
    if (STOP.has(w)) continue
    const h = fnv1a(w)
    v[h % dims] += h & 0x80000000 ? -1 : 1
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
  return norm ? v.map((x) => x / norm) : v
}

// ─── Cache ─────────────────────────────────────────────────────────────────

interface CacheEntry {
  hash: string
  v: number[]
}
type CacheFile = Record<string, CacheEntry>

export interface EmbedderDeps {
  /** Embeds one text (model or mock). */
  embedOne(text: string): Promise<number[]>
  /** Identifies the vectors' source, so switching model (or mock) invalidates the cache. */
  modelId: string
  cacheFile(workspaceId: string): string
  /** False when the workspace was deleted: then nothing is written. */
  workspaceExists(workspaceId: string): Promise<boolean>
  readFile(file: string): Promise<string>
  writeFile(file: string, data: string): Promise<void>
}

export interface Embedder {
  /** Vectors for the items, from the cache where the text is unchanged. */
  embed(workspaceId: string, items: EmbedItem[]): Promise<Record<string, number[]>>
  /** Vector for a text that is not cached (e.g. the research question). */
  embedText(text: string): Promise<number[]>
}

function validItems(items: unknown): EmbedItem[] {
  if (!Array.isArray(items)) throw new Error('Embedding items must be a list')
  if (items.length > MAX_EMBED_ITEMS) throw new Error('Too many items to embed')
  return items.map((it) => {
    const item = it as Partial<EmbedItem> | null
    if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 128) {
      throw new Error('Invalid embedding item id')
    }
    if (typeof item.text !== 'string') throw new Error('Invalid embedding item text')
    return { id: item.id, text: item.text.slice(0, MAX_EMBED_TEXT) }
  })
}

function parseCache(raw: string): CacheFile {
  try {
    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
    const out: CacheFile = {}
    for (const [id, e] of Object.entries(data as Record<string, unknown>)) {
      const entry = e as Partial<CacheEntry> | null
      if (entry && typeof entry.hash === 'string' && Array.isArray(entry.v)) {
        out[id] = { hash: entry.hash, v: entry.v }
      }
    }
    return out
  } catch {
    return {}
  }
}

export function createEmbedder(deps: EmbedderDeps): Embedder {
  const hashOf = (text: string): string =>
    createHash('sha1').update(`${deps.modelId}\n${text}`).digest('hex')

  return {
    embedText: (text) => deps.embedOne(text),

    async embed(workspaceId, rawItems) {
      if (!isWorkspaceId(workspaceId)) throw new Error('Invalid workspace id')
      const items = validItems(rawItems)
      // One read-modify-write at a time per workspace.
      return serialize(`emb:${workspaceId}`, async () => {
        const file = deps.cacheFile(workspaceId)
        const cache = parseCache(await deps.readFile(file).catch(() => '{}'))
        const next: CacheFile = {}
        const out: Record<string, number[]> = {}
        let misses = 0
        for (const { id, text } of items) {
          const hash = hashOf(text)
          const hit =
            cache[id]?.hash === hash ? cache[id] : next[id]?.hash === hash ? next[id] : null
          // One text per call: batching pads inputs, which shifts 8-bit vectors slightly.
          const v = hit ? hit.v : await deps.embedOne(text)
          if (!hit) misses++
          next[id] = { hash, v }
          out[id] = v
        }
        // Rewrite with only the current ids (deleted cards drop out), unless nothing changed.
        const changed = misses > 0 || Object.keys(cache).length !== Object.keys(next).length
        if (changed && (await deps.workspaceExists(workspaceId))) {
          await deps.writeFile(file, JSON.stringify(next))
        }
        return out
      })
    }
  }
}

// ─── The app's embedder ────────────────────────────────────────────────────

export const isAiMock = (): boolean => process.env.WA_E2E === '1' && process.env.WA_AI_MOCK === '1'

let cacheDir = ''

/** Where the model files live; set once at startup. */
export function setModelCacheDir(dir: string): void {
  cacheDir = dir
}

async function embedWithModel(text: string): Promise<number[]> {
  if (!cacheDir) throw new Error('Model cache folder is not set')
  const [v] = await embedTexts(cacheDir, [text])
  return v
}

let appEmbedder: Embedder | null = null

export function embedder(): Embedder {
  if (appEmbedder) return appEmbedder
  const mock = isAiMock()
  appEmbedder = createEmbedder({
    embedOne: mock ? async (t) => mockVector(t) : embedWithModel,
    modelId: mock ? 'mock-bow-384' : `${EMBEDDING_MODEL}:q8`,
    cacheFile: embFile,
    workspaceExists: (id) =>
      fs.stat(wsDir(id)).then(
        (s) => s.isDirectory(),
        () => false
      ),
    readFile: (file) => fs.readFile(file, 'utf8'),
    writeFile: (file, data) => atomicWrite(file, data)
  })
  return appEmbedder
}

/** Loads the model in the background so the first Organize isn't a cold start. */
export function warmUpEmbeddings(): void {
  if (isAiMock() || !cacheDir) return
  const t0 = Date.now()
  embedWithModel('warm up').then(
    () => console.info('[embed] model ready', { ms: Date.now() - t0 }),
    (err) => console.error('[embed] warm-up failed', err instanceof Error ? err.message : err)
  )
}
