import Fuse, { type IFuseOptions } from 'fuse.js'
import { hostOf } from '@shared/kind'
import type { Board } from '@shared/types'
import type { PaletteResultType } from '@renderer/components/wa/CommandPaletteView'

export interface SearchDoc {
  id: string
  type: PaletteResultType
  title: string
  url?: string
  note?: string
  highlights?: string[]
  tags?: string[]
  comments?: string[]
  summary?: string
  groupLabel?: string
  ids?: string[]
}

export interface SearchResult {
  id: string
  type: PaletteResultType
  title: string
  match: string
  ids?: string[]
}

const FUSE_OPTIONS: IFuseOptions<SearchDoc> = {
  keys: [
    { name: 'title', weight: 3 },
    { name: 'tags', weight: 2 },
    { name: 'highlights', weight: 1.5 },
    { name: 'note', weight: 1.5 },
    { name: 'url', weight: 1 },
    { name: 'summary', weight: 1 },
    { name: 'comments', weight: 1 },
    { name: 'groupLabel', weight: 1 }
  ],
  includeMatches: true,
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 2
}

/** Formats a text snippet around a match index with an ellipsis. */
function makeSnippet(text: string, [start, end]: [number, number]): string {
  const padBefore = 15
  const padAfter = 25
  const snippetStart = Math.max(0, start - padBefore)
  const snippetEnd = Math.min(text.length, end + padAfter + 1)
  const before = snippetStart > 0 ? '…' : ''
  const after = snippetEnd < text.length ? '…' : ''
  return `${before}${text.slice(snippetStart, snippetEnd).trim()}${after}`
}

/** Determines the match line describing why this doc matched. */
function buildMatchLine(
  doc: SearchDoc,
  matches?: readonly { key?: string; value?: string; indices: readonly [number, number][] }[]
): string {
  if (doc.type === 'tag') {
    const count = doc.ids?.length ?? 1
    return `Tag · ${count} ${count === 1 ? 'node' : 'nodes'}`
  }

  if (doc.type === 'group') {
    return 'Group'
  }

  const primaryMatch = matches?.[0]
  const matchKey = primaryMatch?.key

  if (matchKey === 'highlights' && primaryMatch?.value) {
    const indices = primaryMatch.indices[0] ?? [0, primaryMatch.value.length - 1]
    const snippet = makeSnippet(primaryMatch.value, [indices[0], indices[1]])
    return `Highlight · “${snippet}”`
  }

  if (matchKey === 'note') {
    return doc.groupLabel
      ? `Note · in group ${doc.groupLabel}`
      : `Note · ${doc.note?.slice(0, 30) ?? ''}`.trim()
  }

  if (matchKey === 'tags') {
    return `Tag · #${primaryMatch?.value ?? doc.tags?.[0] ?? ''}`
  }

  if (matchKey === 'summary' && primaryMatch?.value) {
    const indices = primaryMatch.indices[0] ?? [0, primaryMatch.value.length - 1]
    const snippet = makeSnippet(primaryMatch.value, [indices[0], indices[1]])
    return `Summary · “${snippet}”`
  }

  if (doc.url) {
    const host = hostOf(doc.url)
    return host ? `Title · ${host}` : 'Title'
  }

  if (doc.type === 'note') {
    return doc.groupLabel ? `Note · in group ${doc.groupLabel}` : 'Note'
  }

  return 'Title'
}

/** Builds indexable docs from a board. Excludes ghosts. */
export function buildDocs(board: Board): SearchDoc[] {
  const docs: SearchDoc[] = []
  const tagToNodes: Record<string, string[]> = {}

  // 1. Nodes (excluding ghosts)
  for (const node of Object.values(board.nodes)) {
    if ((node as unknown as { ghost?: boolean }).ghost) continue

    let type: PaletteResultType
    if (node.kind === 'webpage') type = 'web'
    else if (node.kind === 'video') type = 'video'
    else if (node.kind === 'pdf') type = 'pdf'
    else type = 'note'

    const groupLabel = node.parentGroupId ? board.groups[node.parentGroupId]?.label : undefined

    docs.push({
      id: node.id,
      type,
      title: node.title,
      url: node.url,
      note: node.note,
      highlights: node.highlights?.map((h: string | { quote: string }) =>
        typeof h === 'string' ? h : h.quote
      ),
      tags: node.tags,
      comments: node.comments?.map((c) => c.text),
      summary: node.summary,
      groupLabel,
      ids: [node.id]
    })

    for (const tag of node.tags) {
      const clean = tag.trim()
      if (!clean) continue
      if (!tagToNodes[clean]) tagToNodes[clean] = []
      tagToNodes[clean].push(node.id)
    }
  }

  // 2. Groups (excluding ghosts)
  for (const group of Object.values(board.groups)) {
    if ((group as unknown as { ghost?: boolean }).ghost) continue
    docs.push({
      id: group.id,
      type: 'group',
      title: group.label,
      groupLabel: group.label,
      ids: [group.id]
    })
  }

  // 3. Unique Tags
  for (const [tag, ids] of Object.entries(tagToNodes)) {
    docs.push({
      id: `tag:${tag}`,
      type: 'tag',
      title: `#${tag}`,
      tags: [tag],
      ids
    })
  }

  return docs
}

let cachedNodes: Board['nodes'] | null = null
let cachedGroups: Board['groups'] | null = null
let cachedFuse: Fuse<SearchDoc> | null = null

export function clearSearchIndexCache(): void {
  cachedNodes = null
  cachedGroups = null
  cachedFuse = null
}

export function getSearchIndex(board: Board): Fuse<SearchDoc> {
  if (cachedFuse && cachedNodes === board.nodes && cachedGroups === board.groups) {
    return cachedFuse
  }
  const docs = buildDocs(board)
  cachedFuse = new Fuse(docs, FUSE_OPTIONS)
  cachedNodes = board.nodes
  cachedGroups = board.groups
  return cachedFuse
}

/** Searches the board with fuzzy matching, returning top 8 results. */
export function searchBoard(board: Board, query: string): SearchResult[] {
  const q = query.trim()
  if (!q) return []

  const fuse = getSearchIndex(board)
  const results = fuse.search(q, { limit: 8 })

  return results.map((r) => ({
    id: r.item.id,
    type: r.item.type,
    title: r.item.title,
    match: buildMatchLine(r.item, r.matches),
    ids: r.item.ids
  }))
}
