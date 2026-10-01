// Similarity structure from local embeddings: clusters of cards that read alike, pairs
// of cards worth linking, and cards close to the research question. Pure and
// deterministic (same input, same output), so the Organize prompt is reproducible.
// Vectors are unit length, so cosine similarity is a dot product.

/** Merge clusters while their average similarity is at least this. Tuned in Spike 3. */
export const CLUSTER_THRESHOLD = 0.45
export const MAX_CLUSTERS = 6
/** Candidate links: pairs at least this similar, best first. */
export const EDGE_MIN_SIM = 0.5
export const EDGE_TOP_K = 12
/** Cards related to the research question. */
export const QUESTION_MIN_SIM = 0.35
export const QUESTION_TOP_K = 6

export type Vectors = Record<string, number[]>

export interface Cluster {
  ids: string[]
  /** Mean pairwise similarity inside the cluster (0–1). */
  cohesion: number
}

export interface Pair {
  a: string
  b: string
  sim: number
}

export interface Scored {
  id: string
  sim: number
}

export function dot(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  let s = 0
  for (let i = 0; i < n; i++) s += a[i] * b[i]
  return s
}

const round = (n: number): number => Math.round(n * 1000) / 1000

/** Ids that have a vector, in input order, without duplicates. */
function withVectors(ids: string[], vecs: Vectors): string[] {
  return [...new Set(ids)].filter((id) => Array.isArray(vecs[id]) && vecs[id].length > 0)
}

/**
 * Average-linkage agglomerative clustering: start from single cards and keep merging
 * the two clusters with the highest mean pairwise similarity while it is at least
 * `threshold`. Returns clusters of 2+ cards, largest first, at most `maxClusters`.
 */
export function clusterNodes(
  ids: string[],
  vecs: Vectors,
  { threshold = CLUSTER_THRESHOLD, maxClusters = MAX_CLUSTERS } = {}
): Cluster[] {
  const items = withVectors(ids, vecs)
  const sim: number[][] = items.map((a, i) =>
    items.map((b, j) => (i === j ? 1 : dot(vecs[a], vecs[b])))
  )
  // Each cluster is a list of item indices; `sum[i][j]` is the total similarity between
  // clusters i and j, so the average is sum / (|i| * |j|).
  let clusters: number[][] = items.map((_, i) => [i])
  let sum: number[][] = sim.map((row) => [...row])

  for (;;) {
    let best = -Infinity
    let bi = -1
    let bj = -1
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const avg = sum[i][j] / (clusters[i].length * clusters[j].length)
        if (avg > best + 1e-12) {
          best = avg
          bi = i
          bj = j
        }
      }
    }
    if (bi < 0 || best < threshold) break
    // Merge cluster bj into bi; the merged row is the sum of both rows.
    const keep = clusters.map((_, i) => i).filter((i) => i !== bj)
    const row = (i: number, j: number): number =>
      i === bi && j === bi
        ? 0
        : i === bi
          ? sum[bi][j] + sum[bj][j]
          : j === bi
            ? sum[i][bi] + sum[i][bj]
            : sum[i][j]
    sum = keep.map((i) => keep.map((j) => row(i, j)))
    clusters = keep.map((i) =>
      i === bi ? [...clusters[bi], ...clusters[bj]].sort((x, y) => x - y) : clusters[i]
    )
  }

  const cohesion = (members: number[]): number => {
    let total = 0
    let pairs = 0
    for (let x = 0; x < members.length; x++) {
      for (let y = x + 1; y < members.length; y++) {
        total += sim[members[x]][members[y]]
        pairs++
      }
    }
    return pairs ? total / pairs : 1
  }

  return clusters
    .filter((c) => c.length >= 2)
    .map((c) => ({ members: c, cohesion: cohesion(c) }))
    .sort(
      (a, b) =>
        b.members.length - a.members.length ||
        b.cohesion - a.cohesion ||
        a.members[0] - b.members[0]
    )
    .slice(0, Math.max(0, maxClusters))
    .map((c) => ({ ids: c.members.map((i) => items[i]), cohesion: round(c.cohesion) }))
}

const pairKey = (a: string, b: string): string => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`)

/**
 * The most similar pairs of cards that are not linked yet (in either direction), best
 * first. Ties are ordered by input position so the output is stable.
 */
export function candidateEdges(
  ids: string[],
  vecs: Vectors,
  existingPairs: { source: string; target: string }[] = [],
  { minSim = EDGE_MIN_SIM, topK = EDGE_TOP_K } = {}
): Pair[] {
  const items = withVectors(ids, vecs)
  const linked = new Set(existingPairs.map((p) => pairKey(p.source, p.target)))
  const out: (Pair & { i: number; j: number })[] = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]
      const b = items[j]
      if (linked.has(pairKey(a, b))) continue
      const s = dot(vecs[a], vecs[b])
      if (s >= minSim) out.push({ a, b, sim: round(s), i, j })
    }
  }
  return out
    .sort((x, y) => y.sim - x.sim || x.i - y.i || x.j - y.j)
    .slice(0, Math.max(0, topK))
    .map(({ a, b, sim }) => ({ a, b, sim }))
}

/** Cards most similar to the research question, best first. */
export function questionLinks(
  questionVec: number[] | undefined,
  ids: string[],
  vecs: Vectors,
  { minSim = QUESTION_MIN_SIM, topK = QUESTION_TOP_K } = {}
): Scored[] {
  if (!questionVec?.length) return []
  return withVectors(ids, vecs)
    .map((id, i) => ({ id, sim: dot(questionVec, vecs[id]), i }))
    .filter((s) => s.sim >= minSim)
    .sort((x, y) => y.sim - x.sim || x.i - y.i)
    .slice(0, Math.max(0, topK))
    .map(({ id, sim }) => ({ id, sim: round(sim) }))
}
