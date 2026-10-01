import { describe, expect, it, vi } from 'vitest'
import { dot } from './cluster'
import { createEmbedder, embeddingText, mockVector, type EmbedderDeps } from './embed'

interface Setup {
  embedder: ReturnType<typeof createEmbedder>
  embedOne: ReturnType<typeof vi.fn<(text: string) => Promise<number[]>>>
  writeFile: ReturnType<typeof vi.fn<(file: string, data: string) => Promise<void>>>
  files: Map<string, string>
}

function setup(initial: Record<string, string> = {}, exists = true): Setup {
  const files = new Map(Object.entries(initial))
  const embedOne = vi.fn(async (text: string) => [text.length, 1])
  const writeFile = vi.fn(async (file: string, data: string) => {
    files.set(file, data)
  })
  const deps: EmbedderDeps = {
    embedOne,
    modelId: 'test-model',
    cacheFile: (id) => `/ws/${id}/embeddings.json`,
    workspaceExists: async () => exists,
    readFile: async (file) => {
      const f = files.get(file)
      if (f === undefined) throw new Error('ENOENT')
      return f
    },
    writeFile
  }
  return { embedder: createEmbedder(deps), embedOne, writeFile, files }
}

describe('createEmbedder', () => {
  it('embeds misses one text per call and writes the cache', async () => {
    const { embedder, embedOne, writeFile, files } = setup()
    const out = await embedder.embed('ws-1', [
      { id: 'a', text: 'alpha' },
      { id: 'b', text: 'bravo!' }
    ])
    expect(out).toEqual({ a: [5, 1], b: [6, 1] })
    expect(embedOne).toHaveBeenCalledTimes(2)
    expect(embedOne.mock.calls.map((c) => c[0])).toEqual(['alpha', 'bravo!'])
    expect(writeFile).toHaveBeenCalledTimes(1)
    const cache = JSON.parse(files.get('/ws/ws-1/embeddings.json')!)
    expect(Object.keys(cache)).toEqual(['a', 'b'])
    expect(cache.a.hash).toMatch(/^[0-9a-f]{40}$/)
  })

  it('skips cards whose text has not changed (hash hit)', async () => {
    const { embedder, embedOne, writeFile } = setup()
    await embedder.embed('ws-1', [
      { id: 'a', text: 'alpha' },
      { id: 'b', text: 'bravo' }
    ])
    embedOne.mockClear()
    writeFile.mockClear()
    const out = await embedder.embed('ws-1', [
      { id: 'a', text: 'alpha' },
      { id: 'b', text: 'bravo, edited' }
    ])
    expect(embedOne).toHaveBeenCalledTimes(1)
    expect(embedOne).toHaveBeenCalledWith('bravo, edited')
    expect(out.a).toEqual([5, 1])
    expect(writeFile).toHaveBeenCalledTimes(1)
  })

  it('does not rewrite the cache when everything is a hit', async () => {
    const { embedder, writeFile } = setup()
    const items = [{ id: 'a', text: 'alpha' }]
    await embedder.embed('ws-1', items)
    writeFile.mockClear()
    await embedder.embed('ws-1', items)
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('prunes cards that are no longer requested', async () => {
    const { embedder, files } = setup()
    await embedder.embed('ws-1', [
      { id: 'a', text: 'alpha' },
      { id: 'b', text: 'bravo' }
    ])
    await embedder.embed('ws-1', [{ id: 'a', text: 'alpha' }])
    expect(Object.keys(JSON.parse(files.get('/ws/ws-1/embeddings.json')!))).toEqual(['a'])
  })

  it('a different model id invalidates the cache', async () => {
    const shared = new Map<string, string>()
    const make = (
      modelId: string
    ): { e: ReturnType<typeof createEmbedder>; embedOne: ReturnType<typeof vi.fn> } => {
      const embedOne = vi.fn(async () => [1])
      const e = createEmbedder({
        embedOne,
        modelId,
        cacheFile: () => 'f',
        workspaceExists: async () => true,
        readFile: async (f) => shared.get(f) ?? '{}',
        writeFile: async (f, d) => void shared.set(f, d)
      })
      return { e, embedOne }
    }
    await make('m1').e.embed('ws-1', [{ id: 'a', text: 'x' }])
    const second = make('m2')
    await second.e.embed('ws-1', [{ id: 'a', text: 'x' }])
    expect(second.embedOne).toHaveBeenCalledTimes(1)
  })

  it('treats a corrupt cache file as empty', async () => {
    const { embedder, embedOne } = setup({ '/ws/ws-1/embeddings.json': 'not json' })
    await embedder.embed('ws-1', [{ id: 'a', text: 'alpha' }])
    expect(embedOne).toHaveBeenCalledTimes(1)
  })

  it('writes nothing when the workspace folder is gone', async () => {
    const { embedder, writeFile } = setup({}, false)
    const out = await embedder.embed('ws-1', [{ id: 'a', text: 'alpha' }])
    expect(out.a).toEqual([5, 1])
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('rejects bad input', async () => {
    const { embedder } = setup()
    await expect(embedder.embed('../x', [])).rejects.toThrow('Invalid workspace id')
    await expect(embedder.embed('ws-1', 'nope' as never)).rejects.toThrow()
    await expect(embedder.embed('ws-1', [{ id: 5, text: 'x' }] as never)).rejects.toThrow()
  })

  it('runs concurrent requests for one workspace one after another', async () => {
    const { embedder, embedOne } = setup()
    await Promise.all([
      embedder.embed('ws-1', [{ id: 'a', text: 'alpha' }]),
      embedder.embed('ws-1', [{ id: 'a', text: 'alpha' }])
    ])
    // The second run sees the first run's cache.
    expect(embedOne).toHaveBeenCalledTimes(1)
  })
})

describe('embeddingText', () => {
  it('joins title, summary, tags, note, highlights and clipped text', () => {
    const text = embeddingText({
      id: 'n',
      kind: 'webpage',
      title: 'Sea walls',
      summary: 'About barriers',
      tags: ['flooding', 'policy'],
      note: 'useful',
      highlights: ['quote one'],
      text: 'x'.repeat(5000)
    })
    expect(text.startsWith('Sea walls. About barriers flooding policy useful quote one ')).toBe(
      true
    )
    expect(text.length).toBeLessThan(1300)
  })
})

describe('mockVector', () => {
  it('is unit length, deterministic, and similar for texts sharing words', () => {
    const a = mockVector('Rotterdam sea walls protect against coastal flooding')
    const b = mockVector('Coastal flooding defences: sea walls and dikes in Rotterdam')
    const c = mockVector('Boil pasta in salted water with garlic')
    expect(dot(a, a)).toBeCloseTo(1)
    expect(mockVector('Rotterdam sea walls protect against coastal flooding')).toEqual(a)
    expect(dot(a, b)).toBeGreaterThan(0.5)
    expect(Math.abs(dot(a, c))).toBeLessThan(0.2)
    expect(a).toHaveLength(384)
  })

  it('gives a zero vector for text without words', () => {
    expect(mockVector('!!').every((x) => x === 0)).toBe(true)
  })
})
