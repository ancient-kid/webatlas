import type { CanvasNode, Workspace } from '../types'

/** Formats a kind for display in markdown. */
function kindTitle(kind: string): string {
  if (kind === 'webpage') return 'Web'
  if (kind === 'video') return 'Video'
  if (kind === 'pdf') return 'PDF'
  if (kind === 'note') return 'Note'
  return 'Resource'
}

/** Formats one card as markdown. */
function formatCard(node: CanvasNode, boardNodes: Record<string, CanvasNode>): string[] {
  const lines: string[] = []
  const kind = kindTitle(node.kind)
  if (node.url) {
    lines.push(`### [${node.title}](${node.url}) · ${kind}`)
  } else {
    lines.push(`### ${node.title} · ${kind}`)
  }

  if (node.summary) {
    lines.push(`- Summary: ${node.summary}`)
  }

  if (node.capturedFromNodeId && boardNodes[node.capturedFromNodeId]) {
    const parent = boardNodes[node.capturedFromNodeId]
    if (parent.url) {
      lines.push(`- Opened from [${parent.title}](${parent.url})`)
    } else {
      lines.push(`- Opened from ${parent.title}`)
    }
  }

  if (node.note) {
    lines.push(`- Note: ${node.note}`)
  }

  for (const h of node.highlights ?? []) {
    const quote = typeof h === 'string' ? h : (h as unknown as { quote: string }).quote
    lines.push(`> “${quote}”`)
  }

  if (node.tags && node.tags.length > 0) {
    lines.push(`Tags: ${node.tags.map((t) => `#${t}`).join(' ')}`)
  }

  lines.push('')
  return lines
}

/** Exports a workspace to Markdown format. Ghosts are strictly excluded. */
export function toMarkdown(ws: Workspace): string {
  const lines: string[] = []
  const board = ws.board

  lines.push(`# ${ws.name}`)
  if (ws.researchQuestion) {
    lines.push(`> Research question: ${ws.researchQuestion}`)
  }
  lines.push(
    `*Exported on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}*`
  )
  lines.push('')

  // Filter out ghosts
  const validNodes: Record<string, CanvasNode> = {}
  for (const [id, node] of Object.entries(board.nodes)) {
    if (!(node as unknown as { ghost?: boolean }).ghost) {
      validNodes[id] = node
    }
  }

  const validGroups = Object.values(board.groups).filter(
    (g) => !(g as unknown as { ghost?: boolean }).ghost
  )

  // 1. Groups
  for (const group of validGroups) {
    lines.push(`## ${group.label}`)
    if (group.category) {
      lines.push(`*${group.category}*`)
    }
    lines.push('')

    const members = Object.values(validNodes).filter((n) => n.parentGroupId === group.id)
    for (const node of members) {
      lines.push(...formatCard(node, validNodes))
    }
  }

  // 2. Not in a group (web, video, pdf)
  const ungrouped = Object.values(validNodes).filter(
    (n) => !n.parentGroupId && n.kind !== 'note' && n.kind !== 'question'
  )
  if (ungrouped.length > 0) {
    lines.push('## Not in a group')
    lines.push('')
    for (const node of ungrouped) {
      lines.push(...formatCard(node, validNodes))
    }
  }

  // 3. Notes
  const notes = Object.values(validNodes).filter((n) => n.kind === 'note')
  if (notes.length > 0) {
    lines.push('## Notes')
    lines.push('')
    for (const node of notes) {
      lines.push(...formatCard(node, validNodes))
    }
  }

  // 4. Relationships (edges)
  const validEdges = Object.values(board.edges).filter(
    (e) =>
      !(e as unknown as { ghost?: boolean }).ghost && validNodes[e.source] && validNodes[e.target]
  )

  if (validEdges.length > 0) {
    lines.push('## Relationships')
    lines.push('')
    for (const edge of validEdges) {
      const from = validNodes[edge.source].title
      const to = validNodes[edge.target].title
      const relation = edge.label ?? edge.relation ?? 'relates to'
      lines.push(`- ${from} → ${relation} → ${to}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
