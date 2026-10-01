import type { Cat, Workspace } from '../types'
import { absolutePosition, CARD_HEIGHT, CARD_WIDTH } from './geometry'

export interface JsonCanvasNode {
  id: string
  type: 'text' | 'file' | 'link' | 'group'
  text?: string
  url?: string
  label?: string
  x: number
  y: number
  width: number
  height: number
  color?: string
}

export interface JsonCanvasEdge {
  id: string
  fromNode: string
  fromSide?: 'top' | 'right' | 'bottom' | 'left'
  fromEnd?: 'none' | 'arrow'
  toNode: string
  toSide?: 'top' | 'right' | 'bottom' | 'left'
  toEnd?: 'none' | 'arrow'
  label?: string
  color?: string
}

export interface JsonCanvas {
  nodes: JsonCanvasNode[]
  edges: JsonCanvasEdge[]
}

const COLOR_MAP: Record<Cat, string> = {
  rose: '1',
  amber: '2',
  moss: '4',
  teal: '5',
  plum: '6',
  blue: '#2c62b8'
}

export function mapColor(color?: Cat): string | undefined {
  if (!color) return undefined
  return COLOR_MAP[color] ?? color
}

/** Exports a workspace to JSON Canvas 1.0 (.canvas) format for Obsidian. Ghosts are excluded. */
export function toJsonCanvas(ws: Workspace): JsonCanvas {
  const nodes: JsonCanvasNode[] = []
  const edges: JsonCanvasEdge[] = []
  const board = ws.board

  // Filter out ghosts
  const validGroups = Object.values(board.groups).filter(
    (g) => !(g as unknown as { ghost?: boolean }).ghost
  )
  const validNodes = Object.values(board.nodes).filter(
    (n) => !(n as unknown as { ghost?: boolean }).ghost
  )

  const nodeMap = new Map(validNodes.map((n) => [n.id, n]))
  const groupMap = new Map(validGroups.map((g) => [g.id, g]))

  // 1. Group nodes FIRST (Obsidian z-order convention)
  for (const group of validGroups) {
    nodes.push({
      id: group.id,
      type: 'group',
      label: group.label,
      x: Math.round(group.position.x),
      y: Math.round(group.position.y),
      width: Math.round(group.size.w),
      height: Math.round(group.size.h),
      color: mapColor(group.color)
    })
  }

  // 2. Card nodes with absolute coordinates
  for (const node of validNodes) {
    const abs = absolutePosition(node, board)
    const w = node.size?.w ?? CARD_WIDTH[node.kind] ?? 260
    const h = node.size?.h ?? CARD_HEIGHT

    if (node.kind === 'question') {
      nodes.push({
        id: node.id,
        type: 'text',
        text: `## ${node.title || ws.researchQuestion || 'Research Question'}`,
        x: Math.round(abs.x),
        y: Math.round(abs.y),
        width: Math.round(w),
        height: Math.round(h),
        color: '5' // teal
      })
    } else if (node.kind === 'note') {
      nodes.push({
        id: node.id,
        type: 'text',
        text: node.note || node.title,
        x: Math.round(abs.x),
        y: Math.round(abs.y),
        width: Math.round(w),
        height: Math.round(h),
        color: mapColor(node.color)
      })
    } else {
      // web, video, pdf
      nodes.push({
        id: node.id,
        type: 'link',
        url: node.url || '',
        x: Math.round(abs.x),
        y: Math.round(abs.y),
        width: Math.round(w),
        height: Math.round(h),
        color: mapColor(node.color)
      })
    }
  }

  // 3. Edges
  for (const edge of Object.values(board.edges)) {
    if ((edge as unknown as { ghost?: boolean }).ghost) continue
    const sourceExists = nodeMap.has(edge.source) || groupMap.has(edge.source)
    const targetExists = nodeMap.has(edge.target) || groupMap.has(edge.target)
    if (!sourceExists || !targetExists) continue

    const label = edge.label ?? edge.relation
    edges.push({
      id: edge.id,
      fromNode: edge.source,
      toNode: edge.target,
      toEnd: 'arrow',
      label: label || undefined,
      color: mapColor(edge.color)
    })
  }

  return { nodes, edges }
}
