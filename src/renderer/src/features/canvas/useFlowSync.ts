// Store ↔ React Flow bridge. React Flow owns the transient state (measured sizes,
// positions mid-drag, selection); the board store owns everything else. The local
// arrays are rebuilt whenever the board changes, and each gesture commits exactly one
// command when it ends (a drag on drop, a resize on release, a link on connect).
import {
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type OnConnectEnd,
  type OnNodeDrag
} from '@xyflow/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { commitDrag, connectNodes, type DragResult } from '@renderer/store/actions'
import { useAppStore } from '@renderer/store/appStore'
import { useBoardStore } from '@renderer/store/boardStore'
import { focusSet } from '../views/focus'
import { boardToEdges, boardToFlow, type FlowEdge, type FlowNode } from './boardToFlow'
import { findDropGroup, type Rect } from './geometry'

export interface FlowSync {
  nodes: FlowNode[]
  edges: FlowEdge[]
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void
  onConnect: (connection: Connection) => void
  onConnectEnd: OnConnectEnd
  onNodeDragStop: OnNodeDrag<FlowNode>
  selectAll: () => void
  clearSelection: () => void
  /** Selects exactly these ids (cards, groups or links). */
  selectOnly: (ids: string[]) => void
}

const withSelection = <T extends { id: string; selected?: boolean }>(
  items: T[],
  pick: (id: string) => boolean
): T[] =>
  items.map((x) => (Boolean(x.selected) === pick(x.id) ? x : { ...x, selected: pick(x.id) }))

export function useFlowSync(): FlowSync {
  const board = useBoardStore((s) => s.board)
  const rf = useReactFlow<FlowNode, FlowEdge>()
  const [nodes, setNodes] = useState(() =>
    boardToFlow(board, [], useAppStore.getState().session.selectedIds)
  )
  const [edges, setEdges] = useState(() => boardToEdges(board))
  const [syncedBoard, setSyncedBoard] = useState(board)

  // Rebuild from the store when the board changes (adjusting state during render).
  if (syncedBoard !== board) {
    setSyncedBoard(board)
    setNodes(boardToFlow(board, nodes))
    setEdges(boardToEdges(board, edges))
  }

  // Mirror the selection into the session (saved, and read by keyboard and toolbar).
  useEffect(() => {
    const selectedIds = [...nodes, ...edges].filter((x) => x.selected).map((x) => x.id)
    useAppStore.getState().patchSession({ selectedIds })
  }, [nodes, edges])

  // Deletion never comes from React Flow itself (deleteKeyCode is off); it goes through
  // the command layer so it can be undone.
  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    setNodes((ns) =>
      applyNodeChanges(
        changes.filter((c) => c.type !== 'remove'),
        ns
      )
    )
  }, [])
  const onEdgesChange = useCallback((changes: EdgeChange<FlowEdge>[]) => {
    setEdges((es) =>
      applyEdgeChanges(
        changes.filter((c) => c.type !== 'remove'),
        es
      )
    )
  }, [])

  const onConnect = useCallback((c: Connection) => {
    if (c.source && c.target) connectNodes(c.source, c.target)
  }, [])

  // Like Obsidian, a link can be dropped anywhere on a card, not only on a handle.
  const onConnectEnd: OnConnectEnd = useCallback((event, state) => {
    if (state.isValid || !state.fromNode) return
    const point = 'changedTouches' in event ? event.changedTouches[0] : event
    const hit = document
      .elementFromPoint(point.clientX, point.clientY)
      ?.closest<HTMLElement>('.react-flow__node')
    const target = hit?.dataset.id
    if (target && target !== state.fromNode.id) connectNodes(state.fromNode.id, target)
  }, [])

  const onNodeDragStop: OnNodeDrag<FlowNode> = useCallback(
    (_event, _node, dragged) => {
      const rectOf = (id: string): Rect | null => {
        const n = rf.getInternalNode(id)
        if (!n) return null
        return {
          x: n.internals.positionAbsolute.x,
          y: n.internals.positionAbsolute.y,
          w: n.measured.width ?? n.width ?? 0,
          h: n.measured.height ?? n.height ?? 0
        }
      }
      const draggedIds = new Set(dragged.map((n) => n.id))
      const frames = rf
        .getNodes()
        .filter((n) => n.type === 'frame' && !draggedIds.has(n.id))
        .flatMap((n) => {
          const r = rectOf(n.id)
          return r ? [{ id: n.id, ...r }] : []
        })
      const results: DragResult[] = dragged.flatMap((n) => {
        const rect = rectOf(n.id)
        if (!rect) return []
        const groupId = n.type === 'frame' ? null : findDropGroup(rect, frames)
        return [{ id: n.id, position: n.position, absolute: { x: rect.x, y: rect.y }, groupId }]
      })
      commitDrag(results)
    },
    [rf]
  )

  const selectOnly = useCallback((ids: string[]) => {
    const keep = new Set(ids)
    setNodes((ns) => withSelection(ns, (id) => keep.has(id)))
    setEdges((es) => withSelection(es, (id) => keep.has(id)))
  }, [])
  const viewMode = useAppStore((s) => s.session.viewMode)
  const selectedIds = useAppStore((s) => s.session.selectedIds)

  const displayNodes = useMemo(() => {
    if (viewMode !== 'focus') {
      return nodes.map((n) =>
        n.className?.includes('wa-dim')
          ? { ...n, className: n.className.replace(/\bwa-dim\b/g, '').trim() }
          : n
      )
    }
    const set = focusSet(board, selectedIds)
    return nodes.map((n) => {
      const isDim = !set.has(n.id)
      const base = n.className?.replace(/\bwa-dim\b/g, '').trim() || ''
      const className = isDim ? (base ? `${base} wa-dim` : 'wa-dim') : base
      return n.className === className ? n : { ...n, className }
    })
  }, [nodes, viewMode, selectedIds, board])

  const displayEdges = useMemo(() => {
    if (viewMode !== 'focus') {
      return edges.map((e) =>
        e.className?.includes('wa-dim')
          ? { ...e, className: e.className.replace(/\bwa-dim\b/g, '').trim() }
          : e
      )
    }
    const set = focusSet(board, selectedIds)
    return edges.map((e) => {
      const isDim = !set.has(e.source) || !set.has(e.target)
      const base = e.className?.replace(/\bwa-dim\b/g, '').trim() || ''
      const className = isDim ? (base ? `${base} wa-dim` : 'wa-dim') : base
      return e.className === className ? e : { ...e, className }
    })
  }, [edges, viewMode, selectedIds, board])

  const selectAll = useCallback(() => {
    setNodes((ns) => withSelection(ns, () => true))
    setEdges((es) => withSelection(es, () => false))
  }, [])
  const clearSelection = useCallback(() => selectOnly([]), [selectOnly])

  return {
    nodes: displayNodes,
    edges: displayEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onConnectEnd,
    onNodeDragStop,
    selectAll,
    clearSelection,
    selectOnly
  }
}
