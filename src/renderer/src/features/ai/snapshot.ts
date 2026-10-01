// What Organize sends to the main process: the board's content without positions,
// thumbnails, comments or pending suggestions.
import type { Board, BoardSnapshot } from '@shared/types'

export function buildSnapshot(
  board: Board,
  workspace: { id: string; researchQuestion?: string }
): BoardSnapshot {
  const nodes = Object.values(board.nodes)
  const question = nodes.find((n) => n.kind === 'question')
  const groupIds = new Set(Object.keys(board.groups))
  return {
    workspaceId: workspace.id,
    // The question card is the source of truth (the workspace field is synced on save).
    researchQuestion: question?.title.trim() || workspace.researchQuestion || undefined,
    questionNodeId: question?.id ?? '',
    nodes: nodes.map((n) => {
      const out: BoardSnapshot['nodes'][number] = {
        id: n.id,
        kind: n.kind,
        title: n.title,
        tags: [...n.tags],
        note: n.note,
        highlights: n.highlights.map((h) => h.quote)
      }
      if (n.url) out.url = n.url
      if (n.summary) out.summary = n.summary
      if (n.text) out.text = n.text
      if (n.parentGroupId && groupIds.has(n.parentGroupId)) out.groupId = n.parentGroupId
      return out
    }),
    groups: Object.values(board.groups).map((g) => ({
      id: g.id,
      label: g.label,
      memberIds: nodes.filter((n) => n.parentGroupId === g.id).map((n) => n.id)
    })),
    edges: Object.values(board.edges).map((e) => ({
      source: e.source,
      target: e.target,
      relation: e.relation
    }))
  }
}
