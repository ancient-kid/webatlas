// React Flow node components. Each reads its own record from the board store by id
// (a fine-grained selector), renders the matching DESIGN.md view and adds handles, a
// resizer and in-place editing.
import { NodeResizer, type NodeProps } from '@xyflow/react'
import { memo, type ReactElement } from 'react'
import { GroupFrameView } from '@renderer/components/wa/GroupFrameView'
import { NodeCardView } from '@renderer/components/wa/NodeCardView'
import { NoteCardView } from '@renderer/components/wa/NoteCardView'
import { QuestionCardView } from '@renderer/components/wa/QuestionCardView'
import { cn } from '@renderer/lib/utils'
import {
  resizeCommitted,
  updateGroupFields,
  updateNodeFields,
  updateQuestion
} from '@renderer/store/actions'
import { useBoardStore } from '@renderer/store/boardStore'
import { useShallow } from 'zustand/react/shallow'
import { suggestedTagsFor } from '../../ai/ghostsToFlow'
import type { FlowNode } from '../boardToFlow'
import { useCanvasUi } from '../canvasUi'
import { CardHandles } from './CardHandles'
import { InlineText } from './InlineText'

type Props = NodeProps<FlowNode>

const MIN_CARD = { w: 200, h: 120 }
const MIN_GROUP = { w: 240, h: 160 }

function Resizer({
  id,
  visible,
  min
}: {
  id: string
  visible: boolean
  min: { w: number; h: number }
}): ReactElement {
  return (
    <NodeResizer
      isVisible={visible}
      minWidth={min.w}
      minHeight={min.h}
      lineClassName="wa-rf-resize-line"
      handleClassName="wa-rf-resize-handle"
      onResizeEnd={(_, p) =>
        resizeCommitted(
          id,
          { w: Math.round(p.width), h: Math.round(p.height) },
          { x: Math.round(p.x), y: Math.round(p.y) }
        )
      }
    />
  )
}

const useEditing = (id: string): [boolean, (on: boolean) => void] => {
  const editing = useCanvasUi((s) => s.editingId === id)
  const set = (on: boolean): void => useCanvasUi.getState().setEditing(on ? id : null)
  return [editing, set]
}

export const QuestionNode = memo(function QuestionNode({ id, selected }: Props) {
  const title = useBoardStore((s) => s.board.nodes[id]?.title ?? '')
  const meta = useBoardStore((s) => {
    const nodes = Object.values(s.board.nodes)
    const sources = nodes.filter((n) => n.kind !== 'question' && n.kind !== 'note').length
    const groups = Object.keys(s.board.groups).length
    return `${sources} source${sources === 1 ? '' : 's'} · ${groups} group${groups === 1 ? '' : 's'}`
  })
  const [editing, setEditing] = useEditing(id)
  return (
    <div onDoubleClick={() => setEditing(true)}>
      <QuestionCardView
        question={title}
        meta={meta}
        selected={selected}
        body={
          editing ? (
            <InlineText
              multiline
              label="Research question"
              placeholder="What are you trying to answer?"
              className="wa-q__text wa-inline--question"
              initial={title}
              onCommit={(text) => updateQuestion(text.trim())}
              onDone={() => setEditing(false)}
            />
          ) : undefined
        }
      />
      <CardHandles />
    </div>
  )
})

/** Pending tag suggestions for one card (a stable array while they don't change). */
const useSuggestedTags = (id: string): string[] =>
  useBoardStore(useShallow((s) => suggestedTagsFor(s.board, id)))

export const CardNode = memo(function CardNode({ id, selected, dragging }: Props) {
  const node = useBoardStore((s) => s.board.nodes[id])
  const suggested = useSuggestedTags(id)
  const openedFrom = useBoardStore((s) => {
    const from = node?.capturedFromNodeId
    return from ? s.board.nodes[from]?.title : undefined
  })
  if (!node || node.kind === 'note' || node.kind === 'question') return null
  return (
    <>
      <Resizer id={id} visible={selected} min={MIN_CARD} />
      <NodeCardView
        kind={node.kind}
        title={node.title}
        url={node.url}
        thumbnail={node.thumbnailPath}
        faviconUrl={node.faviconUrl}
        summary={node.summary}
        highlights={node.highlights}
        tags={node.tags}
        suggestedTags={suggested}
        openedFrom={openedFrom}
        hasNote={node.note.trim() !== ''}
        color={node.color}
        selected={selected}
        showHandles={false}
        width={node.size?.w}
        className={cn(node.size && 'wa-fill', dragging && 'wa-card--lifted')}
      />
      <CardHandles />
    </>
  )
})

export const NoteNode = memo(function NoteNode({ id, selected, dragging }: Props) {
  const node = useBoardStore((s) => s.board.nodes[id])
  const suggested = useSuggestedTags(id)
  const [editing, setEditing] = useEditing(id)
  if (!node) return null
  return (
    <div className={cn(node.size && 'wa-fill')} onDoubleClick={() => setEditing(true)}>
      <Resizer id={id} visible={selected} min={MIN_CARD} />
      <NoteCardView
        text={node.title}
        tags={node.tags}
        suggestedTags={suggested}
        color={node.color}
        selected={selected}
        width={node.size?.w}
        className={cn(node.size && 'wa-fill', dragging && 'wa-note--lifted')}
        body={
          editing ? (
            <InlineText
              multiline
              label="Note text"
              placeholder="Write a note"
              className="wa-note-text"
              initial={node.title}
              onCommit={(text) => updateNodeFields(id, { title: text })}
              onDone={() => setEditing(false)}
            />
          ) : undefined
        }
      />
      <CardHandles />
    </div>
  )
})

export const FrameNode = memo(function FrameNode({ id, selected }: Props) {
  const group = useBoardStore((s) => s.board.groups[id])
  const [editing, setEditing] = useEditing(id)
  if (!group) return null
  return (
    <>
      <Resizer id={id} visible={selected} min={MIN_GROUP} />
      <GroupFrameView
        label={group.label || 'Untitled group'}
        color={group.color}
        selected={selected}
        width="100%"
        height="100%"
        labelSlot={
          editing ? (
            <InlineText
              label="Group name"
              className="wa-inline--label"
              initial={group.label}
              onCommit={(label) => updateGroupFields(id, { label: label.trim() })}
              onDone={() => setEditing(false)}
            />
          ) : (
            <span onDoubleClick={() => setEditing(true)}>{group.label || 'Untitled group'}</span>
          )
        }
      />
    </>
  )
})
