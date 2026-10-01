import { describe, expect, it } from 'vitest'
import { candidateEdges, clusterNodes, dot, questionLinks, type Vectors } from './cluster'

const unit = (v: number[]): number[] => {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
  return v.map((x) => x / n)
}

// Two tight groups (around the x and y axes) and one outlier on z.
const VECS: Vectors = {
  a1: unit([1, 0.05, 0]),
  a2: unit([1, 0.1, 0.02]),
  a3: unit([0.95, 0, 0.05]),
  b1: unit([0.05, 1, 0]),
  b2: unit([0.1, 1, 0.05]),
  out: unit([0, 0, 1])
}
const IDS = Object.keys(VECS)

describe('clusterNodes', () => {
  it('finds two tight groups and leaves the outlier out', () => {
    const clusters = clusterNodes(IDS, VECS)
    expect(clusters.map((c) => c.ids)).toEqual([
      ['a1', 'a2', 'a3'],
      ['b1', 'b2']
    ])
    expect(clusters.flatMap((c) => c.ids)).not.toContain('out')
    for (const c of clusters) {
      expect(c.cohesion).toBeGreaterThan(0.9)
      expect(c.cohesion).toBeLessThanOrEqual(1)
    }
  })

  it('returns no clusters when the threshold is too high', () => {
    expect(clusterNodes(IDS, VECS, { threshold: 0.99999 })).toEqual([])
  })

  it('merges everything with a very low threshold, then caps the count', () => {
    expect(clusterNodes(IDS, VECS, { threshold: -1 })).toHaveLength(1)
    expect(clusterNodes(IDS, VECS, { maxClusters: 1 }).map((c) => c.ids)).toEqual([
      ['a1', 'a2', 'a3']
    ])
    expect(clusterNodes(IDS, VECS, { maxClusters: 0 })).toEqual([])
  })

  it('uses average linkage (a chain of near neighbours does not merge)', () => {
    // p–q close, q–r close, p–r far: average of r to {p,q} stays below the threshold.
    const vecs: Vectors = {
      p: unit([1, 0, 0]),
      q: unit([1, 1, 0]),
      r: unit([0, 1, 0.3])
    }
    const clusters = clusterNodes(['p', 'q', 'r'], vecs, { threshold: 0.6 })
    expect(clusters).toHaveLength(1)
    expect(clusters[0].ids).toHaveLength(2)
  })

  it('is deterministic and ignores ids without vectors or repeated ids', () => {
    const a = clusterNodes([...IDS, 'missing', 'a1'], VECS)
    const b = clusterNodes([...IDS], VECS)
    expect(a).toEqual(b)
    expect(clusterNodes([], {})).toEqual([])
    expect(clusterNodes(['a1'], VECS)).toEqual([])
  })
})

describe('candidateEdges', () => {
  it('lists the most similar pairs first and respects minSim and topK', () => {
    const pairs = candidateEdges(IDS, VECS, [], { minSim: 0.9 })
    expect(pairs.length).toBe(4) // 3 pairs among a*, 1 between b*
    for (let i = 1; i < pairs.length; i++)
      expect(pairs[i - 1].sim).toBeGreaterThanOrEqual(pairs[i].sim)
    expect(candidateEdges(IDS, VECS, [], { minSim: 0.9, topK: 2 })).toHaveLength(2)
  })

  it('excludes pairs that are already linked, in either direction', () => {
    const pairs = candidateEdges(IDS, VECS, [
      { source: 'b2', target: 'b1' },
      { source: 'a1', target: 'a2' }
    ])
    const keys = pairs.map((p) => [p.a, p.b].sort().join('-'))
    expect(keys).not.toContain('b1-b2')
    expect(keys).not.toContain('a1-a2')
    expect(keys).toContain('a1-a3')
  })

  it('has a stable order', () => {
    expect(candidateEdges(IDS, VECS)).toEqual(candidateEdges(IDS, VECS))
  })
})

describe('questionLinks', () => {
  it('returns the cards closest to the question', () => {
    const q = unit([1, 0, 0])
    const links = questionLinks(q, IDS, VECS, { minSim: 0.5 })
    expect(links.map((l) => l.id).sort()).toEqual(['a1', 'a2', 'a3'])
    expect(links[0].id).toBe('a1')
    expect(links[0].sim).toBeGreaterThanOrEqual(links[1].sim)
    expect(questionLinks(q, IDS, VECS, { minSim: 0.5, topK: 1 })).toHaveLength(1)
  })

  it('returns nothing without a question vector', () => {
    expect(questionLinks(undefined, IDS, VECS)).toEqual([])
    expect(questionLinks([], IDS, VECS)).toEqual([])
  })
})

describe('dot', () => {
  it('is the cosine for unit vectors', () => {
    expect(dot(VECS.a1, VECS.a1)).toBeCloseTo(1)
    expect(dot(VECS.a1, VECS.out)).toBeCloseTo(0, 1)
  })
})
