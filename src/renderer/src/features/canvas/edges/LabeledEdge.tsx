// A link between two cards: a curved arrow from the side facing the other card, with
// the relationship as a label pill (DESIGN.md Edge). Colour: the link's category
// colour, AI teal for accepted suggestions, otherwise neutral.
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Position,
  useInternalNode,
  type EdgeProps,
  type InternalNode
} from '@xyflow/react'
import { memo, type CSSProperties, type ReactElement } from 'react'
import { CATS } from '@shared/types'
import { cn } from '@renderer/lib/utils'
import { useBoardStore } from '@renderer/store/boardStore'
import { useCanvasUi } from '../canvasUi'
import type { FlowEdge } from '../boardToFlow'
import { linkEnds, type Rect, type Side } from '../geometry'
import { edgeTone, relationLabel, toneColor } from '../relations'

const POSITION: Record<Side, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left
}

function rectOf(n: InternalNode): Rect {
  return {
    x: n.internals.positionAbsolute.x,
    y: n.internals.positionAbsolute.y,
    w: n.measured.width ?? n.width ?? 0,
    h: n.measured.height ?? n.height ?? 0
  }
}

export const LabeledEdge = memo(function LabeledEdge({
  id,
  source,
  target,
  selected
}: EdgeProps<FlowEdge>) {
  const edge = useBoardStore((s) => s.board.edges[id])
  const from = useInternalNode(source)
  const to = useInternalNode(target)
  if (!edge || !from || !to) return null

  const ends = linkEnds(rectOf(from), rectOf(to))
  const [path, labelX, labelY] = getBezierPath({
    sourceX: ends.source.x,
    sourceY: ends.source.y,
    sourcePosition: POSITION[ends.sourceSide],
    targetX: ends.target.x,
    targetY: ends.target.y,
    targetPosition: POSITION[ends.targetSide]
  })
  const tone = edgeTone(edge)
  const colour = toneColor(tone)
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={`url(#wa-arrow-${tone})`}
        style={{ stroke: colour, strokeWidth: selected ? 3 : 2 }}
        interactionWidth={16}
      />
      <EdgeLabelRenderer>
        <span
          className={cn('wa-edge__label nodrag nopan', selected && 'wa-edge__label--selected')}
          data-edge-id={id}
          onDoubleClick={(e) => {
            e.stopPropagation()
            useCanvasUi.getState().openEdgeMenu({ id, x: e.clientX, y: e.clientY })
          }}
          style={
            {
              '--ec': colour,
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all'
            } as CSSProperties
          }
        >
          {relationLabel(edge)}
        </span>
      </EdgeLabelRenderer>
    </>
  )
})

/** Arrowhead markers for every link tone, coloured through CSS so they follow the theme. */
export function ArrowMarkers(): ReactElement {
  const tones = ['neutral', 'brand', 'ghost', ...CATS.map((c) => `cat-${c}`)]
  return (
    <svg className="wa-rf-markers" aria-hidden="true">
      <defs>
        {tones.map((tone) => (
          <marker
            key={tone}
            id={`wa-arrow-${tone}`}
            viewBox="0 0 10 10"
            refX={9}
            refY={5}
            markerWidth={12}
            markerHeight={12}
            markerUnits="userSpaceOnUse"
            orient="auto-start-reverse"
          >
            <path d="M0 0L10 5L0 10z" style={{ fill: toneColor(tone) }} />
          </marker>
        ))}
      </defs>
    </svg>
  )
}
