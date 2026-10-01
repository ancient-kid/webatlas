// A suggested group on the canvas: a dashed frame around the cards it would contain.
// It is not a real item (not selectable, not draggable) and lets the canvas work through
// it. Its "… (suggested)" label and Accept/Reject buttons live in a node toolbar, which
// sits above every card, so they stay visible and readable even when frames overlap.
import { NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import { memo } from 'react'
import { Button } from '@renderer/components/wa/Button'
import { GroupFrameView } from '@renderer/components/wa/GroupFrameView'
import { Icon } from '@renderer/components/wa/Icon'
import { cn } from '@renderer/lib/utils'
import { useAppStore } from '@renderer/store/appStore'
import { useBoardStore } from '@renderer/store/boardStore'
import { acceptSuggestion, rejectSuggestion } from '../../ai/suggestionActions'
import type { FlowNode } from '../boardToFlow'

export const GhostGroupNode = memo(function GhostGroupNode({ data }: NodeProps<FlowNode>) {
  const ghostId = data.id
  const ghost = useBoardStore((s) => s.board.ghosts[ghostId])
  const hot = useAppStore((s) => s.hoveredGhostId === ghostId)
  if (!ghost || ghost.command.type !== 'createGroup') return null
  const label = ghost.command.payload.group.label
  const hover = (on: boolean): void => useAppStore.getState().setHoveredGhost(on ? ghostId : null)
  return (
    <>
      <GroupFrameView
        ghost
        label={label}
        width="100%"
        height="100%"
        className={cn('wa-ghost-frame', hot && 'wa-ghost-hot')}
      />
      <NodeToolbar
        isVisible
        position={Position.Top}
        align="start"
        offset={-12}
        style={{ zIndex: 1000 }}
        className={cn('wa-ghost-head nodrag nopan', hot && 'wa-ghost-hot')}
      >
        <div
          role="group"
          aria-label={`Suggested group ${label}`}
          className="wa-ghost-head__row"
          onPointerEnter={() => hover(true)}
          onPointerLeave={() => hover(false)}
        >
          <span className="wa-ghost-pill">
            <Icon name="focus" size={12} />
            {label} (suggested)
          </span>
          <span className="wa-ghost-head__actions">
            <Button
              variant="accept"
              size="sm"
              icon="check"
              aria-label={`Accept suggested group ${label}`}
              onClick={(e) => {
                e.stopPropagation()
                acceptSuggestion(ghostId)
              }}
            >
              Accept
            </Button>
            <Button
              variant="reject"
              size="sm"
              icon="x"
              aria-label={`Reject suggested group ${label}`}
              onClick={(e) => {
                e.stopPropagation()
                rejectSuggestion(ghostId)
              }}
            >
              Reject
            </Button>
          </span>
        </div>
      </NodeToolbar>
    </>
  )
})
