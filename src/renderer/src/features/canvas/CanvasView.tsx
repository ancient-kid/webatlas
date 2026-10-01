// The research canvas: React Flow wired to the board store, styled like Obsidian
// Canvas with the DESIGN.md tokens. Double-click empty space for a note; drag from a
// card's handle to link it; drag cards into a group frame to group them.
import '@xyflow/react/dist/style.css'
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node as RFNode
} from '@xyflow/react'
import { useEffect, useRef, useState, type MouseEvent, type ReactElement } from 'react'
import { GRID } from '@shared/export/geometry'
import { addNoteAt, deleteSelection, nudge } from '@renderer/store/actions'
import { useAppStore } from '@renderer/store/appStore'
import { useBoardStore } from '@renderer/store/boardStore'
import type { FlowEdge, FlowNode } from './boardToFlow'
import { useCanvasUi } from './canvasUi'
import { ArrowMarkers } from './edges/LabeledEdge'
import { EDGE_TYPES, NODE_TYPES } from './flowTypes'
import { keyToAction } from './keyboard'
import { useFlowSync, type FlowSync } from './useFlowSync'

const snap = (v: number): number => Math.round(v / GRID) * GRID

/** Mini-map colours: the question in brand teal, groups and coloured cards in their category. */
function miniMapClass(node: RFNode): string {
  const board = useBoardStore.getState().board
  if (node.type === 'question') return 'wa-mm wa-mm--brand'
  const colour = node.type === 'frame' ? board.groups[node.id]?.color : board.nodes[node.id]?.color
  return colour ? `wa-mm wa-mm--${colour}` : 'wa-mm'
}

/** Canvas shortcuts; the latest flow callbacks are read through a ref. */
function useCanvasKeys(flow: FlowSync): void {
  const latest = useRef(flow)
  useEffect(() => {
    latest.current = flow
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const action = keyToAction(e)
      if (!action) return
      const selected = useAppStore.getState().session.selectedIds
      const board = useBoardStore.getState()
      e.preventDefault()
      switch (action.type) {
        case 'delete':
          deleteSelection(selected)
          break
        case 'undo':
          board.undo()
          break
        case 'redo':
          board.redo()
          break
        case 'selectAll':
          latest.current.selectAll()
          break
        case 'clearSelection':
          latest.current.clearSelection()
          break
        case 'nudge':
          nudge(selected, action.dx, action.dy)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

function Canvas(): ReactElement {
  const flow = useFlowSync()
  const rf = useReactFlow()
  const [viewport] = useState(() => useAppStore.getState().session.viewport)
  useCanvasKeys(flow)

  const onDoubleClick = (e: MouseEvent<HTMLDivElement>): void => {
    if (!(e.target as Element).classList.contains('react-flow__pane')) return
    const at = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const id = addNoteAt({ x: snap(at.x), y: snap(at.y) })
    flow.selectOnly([id])
    useCanvasUi.getState().setEditing(id)
  }

  return (
    <div className="wa-canvas-rf" data-testid="canvas" onDoubleClick={onDoubleClick}>
      <ArrowMarkers />
      <ReactFlow<FlowNode, FlowEdge>
        nodes={flow.nodes}
        edges={flow.edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={flow.onNodesChange}
        onEdgesChange={flow.onEdgesChange}
        onConnect={flow.onConnect}
        onConnectEnd={flow.onConnectEnd}
        onPaneClick={() => useCanvasUi.getState().setEditing(null)}
        onNodeDragStop={flow.onNodeDragStop}
        connectionMode={ConnectionMode.Loose}
        snapToGrid
        snapGrid={[GRID, GRID]}
        zoomOnDoubleClick={false}
        deleteKeyCode={null}
        selectionKeyCode="Shift"
        multiSelectionKeyCode="Shift"
        selectionOnDrag={false}
        panOnDrag
        elevateNodesOnSelect={false}
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={viewport}
        onMoveEnd={(_, vp) => useAppStore.getState().patchSession({ viewport: vp })}
        proOptions={{ hideAttribution: true }}
        colorMode="system"
      >
        <Background variant={BackgroundVariant.Dots} gap={GRID} size={1.5} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeClassName={miniMapClass} />
      </ReactFlow>
    </div>
  )
}

export function CanvasView(): ReactElement {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  )
}
