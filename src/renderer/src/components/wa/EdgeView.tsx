import type { CSSProperties, ReactElement } from 'react'
import type { Cat } from '@shared/types'
import { cn } from '@renderer/lib/utils'
import { edgeColor, edgePath } from './format'

export interface EdgeViewProps {
  /** Unique per edge; used for the arrowhead marker id. */
  id: string
  from: [number, number]
  to: [number, number]
  /** A sentence-case verb: opened from, supports, contradicts, answers, cites. */
  label?: string
  color?: Cat
  ghost?: boolean
}

/** DESIGN.md Edge: a standalone curved arrow with a label pill (the canvas uses React Flow). */
export function EdgeView(p: EdgeViewProps): ReactElement {
  const [x1, y1] = p.from
  const [x2, y2] = p.to
  const col = edgeColor(p.color, p.ghost)
  const marker = `wa-ah-${p.id}`
  const w = Math.max(x1, x2) + 20
  const h = Math.max(y1, y2) + 20
  return (
    <div className="wa wa-edge" style={{ width: w, height: h, '--ec': col } as CSSProperties}>
      <svg width={w} height={h} aria-hidden="true">
        <defs>
          <marker id={marker} markerWidth={8} markerHeight={8} refX={7} refY={4} orient="auto">
            <path d="M0 0L8 4L0 8z" fill={col} />
          </marker>
        </defs>
        <path
          d={edgePath(p.from, p.to)}
          fill="none"
          stroke={col}
          strokeWidth={2}
          strokeDasharray={p.ghost ? '6 5' : undefined}
          markerEnd={`url(#${marker})`}
        />
      </svg>
      {p.label ? (
        <span
          className={cn('wa-edge__label', p.ghost && 'wa-edge__label--ghost')}
          style={{ left: (x1 + x2) / 2, top: (y1 + y2) / 2 }}
        >
          {p.label}
        </span>
      ) : null}
    </div>
  )
}
