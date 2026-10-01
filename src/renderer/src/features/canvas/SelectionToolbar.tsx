// The floating toolbar above the selection (DESIGN.md SelectionToolbar): colours, tag,
// note, open in browser pane, zoom, group (2+ cards) and delete. Every button acts
// through the action creators, so each click is one undo step.
import { NodeToolbar, Position } from '@xyflow/react'
import { useState, type ReactElement } from 'react'
import type { Cat } from '@shared/types'
import { SelectionToolbarView } from '@renderer/components/wa/SelectionToolbarView'
import { TagChip } from '@renderer/components/wa/TagChip'
import { Popover, PopoverAnchor, PopoverContent } from '@renderer/components/ui/popover'
import {
  deleteSelection,
  groupSelection,
  setColor,
  tagItems,
  updateNodeFields
} from '@renderer/store/actions'
import { useAppStore } from '@renderer/store/appStore'
import { useBoardStore } from '@renderer/store/boardStore'
import { openInBrowser } from '../browser/openInBrowser'
import { canvas } from './canvasControl'
import { useCanvasUi } from './canvasUi'

type Panel = 'tag' | 'note' | null

const RESOURCE_KINDS = new Set(['webpage', 'video', 'pdf'])

/** What the current selection contains, read from the stores. */
function useSelection(): {
  ids: string[]
  nodeIds: string[]
  cardIds: string[]
  colour: Cat | null
} {
  const selected = useAppStore((s) => s.session.selectedIds)
  const board = useBoardStore((s) => s.board)
  const ids = selected.filter((id) => board.nodes[id] || board.groups[id])
  const nodeIds = ids.filter((id) => board.nodes[id])
  const cardIds = nodeIds.filter((id) => board.nodes[id].kind !== 'question')
  const colours = ids.map((id) => board.nodes[id]?.color ?? board.groups[id]?.color ?? null)
  const colour = colours.length && colours.every((c) => c === colours[0]) ? colours[0] : null
  return { ids, nodeIds, cardIds, colour }
}

/** The toolbar's buttons and popovers, driven by the stores (no React Flow needed). */
export function SelectionControls(): ReactElement | null {
  const { ids, nodeIds, cardIds, colour } = useSelection()
  const board = useBoardStore((s) => s.board)
  const [panel, setPanel] = useState<Panel>(null)
  if (!ids.length) return null

  const single = nodeIds.length === 1 && ids.length === 1 ? board.nodes[nodeIds[0]] : undefined
  const resource = single && RESOURCE_KINDS.has(single.kind) && single.url ? single : undefined

  const onNote = (): void => {
    if (!single) return
    // Notes and the question are edited in place; pages keep their note in a popover.
    if (single.kind === 'note' || single.kind === 'question') {
      useCanvasUi.getState().setEditing(single.id)
    } else {
      setPanel('note')
    }
    useCanvasUi.getState().requestNoteFocus(single.id)
  }

  const onGroup = (): void => {
    const id = groupSelection(cardIds, 'New group')
    if (!id) return
    canvas().select([id])
    useCanvasUi.getState().setEditing(id)
  }

  return (
    <Popover open={panel !== null} onOpenChange={(open) => !open && setPanel(null)}>
      <PopoverAnchor asChild>
        <div>
          <SelectionToolbarView
            color={colour}
            onColor={(c) => setColor(ids, c)}
            onTag={() => setPanel(panel === 'tag' ? null : 'tag')}
            onNote={onNote}
            onOpen={() => resource?.url && openInBrowser(resource.url)}
            onZoom={() => canvas().zoomTo(ids)}
            onGroup={cardIds.length >= 2 ? onGroup : undefined}
            onDelete={() => deleteSelection(ids)}
            showOpen={Boolean(resource)}
            showNote={Boolean(single)}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent side="top" align="center" className="w-[280px]">
        {panel === 'tag' ? (
          <TagForm nodeIds={nodeIds} onDone={() => setPanel(null)} />
        ) : panel === 'note' && single ? (
          <NoteForm id={single.id} initial={single.note} onDone={() => setPanel(null)} />
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

function TagForm({ nodeIds, onDone }: { nodeIds: string[]; onDone: () => void }): ReactElement {
  const board = useBoardStore((s) => s.board)
  const [value, setValue] = useState('')
  const existing = [...new Set(Object.values(board.nodes).flatMap((n) => n.tags))].sort()
  const suggestions = existing
    .filter((t) => !nodeIds.every((id) => board.nodes[id]?.tags.includes(t)))
    .filter((t) => t.includes(value.trim().toLowerCase()))
    .slice(0, 8)
  const add = (tag: string): void => {
    if (tagItems(nodeIds, tag) || tag.trim()) onDone()
  }
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        add(value)
      }}
    >
      <label className="wa-field">
        Tag
        <input
          className="wa-input"
          autoFocus
          value={value}
          placeholder="must-cite"
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      {suggestions.length ? (
        <div className="flex flex-wrap gap-1" aria-label="Existing tags">
          {suggestions.map((t) => (
            <button key={t} type="button" className="wa-tag-button" onClick={() => add(t)}>
              <TagChip label={t} />
            </button>
          ))}
        </div>
      ) : null}
    </form>
  )
}

function NoteForm(p: { id: string; initial: string; onDone: () => void }): ReactElement {
  const [value, setValue] = useState(p.initial)
  const save = (): void => {
    updateNodeFields(p.id, { note: value })
    p.onDone()
  }
  return (
    <label className="wa-field">
      Your note
      <textarea
        className="wa-input"
        autoFocus
        rows={5}
        value={value}
        placeholder="Why you opened this, what you took from it"
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save()
        }}
      />
    </label>
  )
}

/** Positions the controls 12px above the selected cards and groups (hidden while dragging). */
export function SelectionToolbar({ hidden }: { hidden: boolean }): ReactElement {
  const selected = useAppStore((s) => s.session.selectedIds)
  const board = useBoardStore((s) => s.board)
  const editing = useCanvasUi((s) => s.editingId !== null)
  const ids = selected.filter((id) => board.nodes[id] || board.groups[id])
  return (
    <NodeToolbar
      nodeId={ids}
      isVisible={ids.length > 0 && !hidden && !editing}
      position={Position.Top}
      offset={12}
    >
      <SelectionControls />
    </NodeToolbar>
  )
}
