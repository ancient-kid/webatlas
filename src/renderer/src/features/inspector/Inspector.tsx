// The inspector side panel: shows the Details tab for the current selection
// (a single card, a group, a multi-selection, or empty state).
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactElement
} from 'react'
import { CATS, type CanvasNode, type Group, type GroupCategory, type NodeKind } from '@shared/types'
import { Icon, type IconName } from '@renderer/components/wa/Icon'
import { TagChip } from '@renderer/components/wa/TagChip'
import { formatAgo } from '@renderer/lib/time'
import {
  addComment,
  removeComment,
  removeHighlight,
  setColor,
  tagItems,
  untag,
  updateGroupFields,
  updateNodeFields
} from '@renderer/store/actions'
import { useAppStore } from '@renderer/store/appStore'
import { useBoardStore } from '@renderer/store/boardStore'
import { openInBrowser } from '../browser/openInBrowser'
import { canvas } from '../canvas/canvasControl'
import { useCanvasUi } from '../canvas/canvasUi'

const KIND_META: Record<NodeKind, { label: string; icon: IconName }> = {
  webpage: { label: 'Web page', icon: 'globe' },
  video: { label: 'Video', icon: 'play' },
  pdf: { label: 'PDF', icon: 'file' },
  note: { label: 'Note', icon: 'note' },
  question: { label: 'Question', icon: 'compass' }
}

const CATEGORIES: { value: GroupCategory; label: string }[] = [
  { value: 'topic', label: 'Topic' },
  { value: 'source', label: 'Source' },
  { value: 'importance', label: 'Importance' },
  { value: 'custom', label: 'Custom' }
]

export function Inspector(): ReactElement {
  const selectedIds = useAppStore((s) => s.session.selectedIds)
  const board = useBoardStore((s) => s.board)

  const nodeIds = selectedIds.filter((id) => board.nodes[id])
  const groupIds = selectedIds.filter((id) => board.groups[id])
  const totalCount = nodeIds.length + groupIds.length

  const singleNode = nodeIds.length === 1 && groupIds.length === 0 ? board.nodes[nodeIds[0]] : null
  const singleGroup =
    groupIds.length === 1 && nodeIds.length === 0 ? board.groups[groupIds[0]] : null

  return (
    <aside
      className="wa-inspector flex h-full w-[320px] shrink-0 flex-col border-l border-line bg-surface overflow-hidden"
      data-testid="inspector-panel"
      aria-label="Inspector"
    >
      <div className="wa-inspector__header flex h-11 items-center justify-between border-b border-line px-4">
        <div className="flex items-center gap-2">
          <span className="wa-label font-medium text-ink">Details</span>
        </div>
      </div>

      <div className="wa-inspector__content flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {!totalCount ? (
          <div
            className="wa-inspector__empty flex flex-1 items-center justify-center p-6 text-center text-ink-muted wa-caption"
            data-testid="inspector-empty"
          >
            Select a card to see its details
          </div>
        ) : singleNode ? (
          <NodeDetails key={singleNode.id} node={singleNode} />
        ) : singleGroup ? (
          <GroupDetails key={singleGroup.id} group={singleGroup} />
        ) : (
          <MultiDetails count={totalCount} nodeIds={nodeIds} allIds={[...nodeIds, ...groupIds]} />
        )}
      </div>
    </aside>
  )
}

/** Navigates and centres the canvas on a specific item. */
function jumpTo(id: string): void {
  useAppStore.getState().patchSession({ selectedIds: [id] })
  canvas().select([id])
  canvas().reveal([id])
  canvas().zoomTo([id])
}

// ─── Single Node Details ───────────────────────────────────────────────────

function NodeDetails({ node }: { node: CanvasNode }): ReactElement {
  const board = useBoardStore((s) => s.board)
  const focusNoteId = useCanvasUi((s) => s.focusNoteId)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  const [prevTitle, setPrevTitle] = useState(node.title)
  const [title, setTitle] = useState(node.title)
  if (node.title !== prevTitle) {
    setPrevTitle(node.title)
    setTitle(node.title)
  }

  const [prevNote, setPrevNote] = useState(node.note)
  const [note, setNote] = useState(node.note)
  if (node.note !== prevNote) {
    setPrevNote(node.note)
    setNote(node.note)
  }

  const [tagInput, setTagInput] = useState('')
  const [commentInput, setCommentInput] = useState('')

  useEffect(() => {
    if (focusNoteId === node.id && noteRef.current) {
      noteRef.current.focus()
      useCanvasUi.getState().requestNoteFocus(null)
    }
  }, [focusNoteId, node.id])

  const commitTitle = (): void => {
    const next = title.trim()
    if (next && next !== node.title) {
      updateNodeFields(node.id, { title: next })
    } else {
      setTitle(node.title)
    }
  }

  const commitNote = (): void => {
    if (note !== node.note) {
      updateNodeFields(node.id, { note })
    }
  }

  const onAddTag = (e: FormEvent): void => {
    e.preventDefault()
    const next = tagInput.trim()
    if (!next) return
    tagItems([node.id], next)
    setTagInput('')
  }

  const onAddComment = (e: FormEvent): void => {
    e.preventDefault()
    const next = commentInput.trim()
    if (!next) return
    addComment(node.id, next)
    setCommentInput('')
  }

  const kindMeta = KIND_META[node.kind]
  const parent = node.capturedFromNodeId ? board.nodes[node.capturedFromNodeId] : null
  const highlights = [...node.highlights].sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div className="flex flex-col gap-4" data-testid="inspector-node-details">
      {/* Header: badge + captured time */}
      <div className="flex items-center justify-between gap-2">
        <span className="wa-badge">
          <Icon name={kindMeta.icon} />
          {kindMeta.label}
        </span>
        {node.capturedAt ? (
          <span className="wa-caption text-ink-subtle">{formatAgo(node.capturedAt)}</span>
        ) : null}
      </div>

      {/* Title */}
      <div className="wa-field">
        <label htmlFor="inspector-title" className="wa-caption text-ink-muted font-medium">
          Title
        </label>
        <input
          id="inspector-title"
          className="wa-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
      </div>

      {/* URL */}
      {node.url ? (
        <div className="wa-field">
          <span className="wa-caption text-ink-muted font-medium">URL</span>
          <button
            type="button"
            className="wa-url text-left hover:underline cursor-pointer"
            onClick={() => openInBrowser(node.url!)}
            title="Open in browser pane"
          >
            {node.url}
          </button>
        </div>
      ) : null}

      {/* Provenance */}
      {node.capturedFromNodeId ? (
        <div className="wa-field">
          <span className="wa-caption text-ink-muted font-medium">Provenance</span>
          <button
            type="button"
            className="wa-prov text-left hover:underline cursor-pointer flex items-center gap-1"
            onClick={() => jumpTo(node.capturedFromNodeId!)}
            title="Jump to referring card"
          >
            <Icon name="arrow" />
            <span>Opened from {parent?.title || 'source'}</span>
          </button>
        </div>
      ) : null}

      {/* Summary */}
      {node.summary ? (
        <div className="wa-field">
          <span className="wa-caption text-ink-muted font-medium">Summary</span>
          <p className="wa-caption text-ink-muted leading-relaxed m-0">{node.summary}</p>
        </div>
      ) : null}

      {/* Note */}
      <div className="wa-field">
        <label htmlFor="inspector-note" className="wa-label text-ink font-medium">
          Your note
        </label>
        <textarea
          id="inspector-note"
          ref={noteRef}
          className="wa-input"
          rows={4}
          placeholder="Why you opened this, what you took from it"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={commitNote}
          onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) e.currentTarget.blur()
          }}
        />
      </div>

      {/* Tags */}
      <div className="wa-field">
        <span className="wa-caption text-ink-muted font-medium">Tags</span>
        <div className="flex flex-wrap gap-1 mb-2">
          {node.tags.map((tag) => (
            <span key={tag} className="wa-tag inline-flex items-center gap-1">
              <TagChip label={tag} />
              <button
                type="button"
                className="text-ink-muted hover:text-danger ml-0.5 cursor-pointer leading-none"
                aria-label={`Remove tag ${tag}`}
                onClick={() => untag([node.id], tag)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <form onSubmit={onAddTag} className="flex gap-2">
          <input
            className="wa-input h-7 flex-1 text-xs"
            placeholder="Add tag..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
          />
          <button type="submit" className="wa-btn wa-btn--sm" disabled={!tagInput.trim()}>
            Add
          </button>
        </form>
      </div>

      {/* Highlights */}
      {highlights.length ? (
        <div className="wa-field">
          <span className="wa-caption text-ink-muted font-medium">Highlights</span>
          <div className="flex flex-col gap-2">
            {highlights.map((h) => (
              <blockquote
                key={h.id}
                className="wa-quote relative flex items-start justify-between gap-2 p-2 rounded"
              >
                <span className="text-xs leading-relaxed">{h.quote}</span>
                <button
                  type="button"
                  className="text-ink-muted hover:text-danger cursor-pointer shrink-0"
                  aria-label="Remove highlight"
                  onClick={() => removeHighlight(node.id, h.id)}
                >
                  ×
                </button>
              </blockquote>
            ))}
          </div>
        </div>
      ) : null}

      {/* Comments */}
      <div className="wa-field">
        <span className="wa-caption text-ink-muted font-medium">Comments</span>
        <div className="flex flex-col gap-2 mb-2">
          {node.comments.map((c) => (
            <div key={c.id} className="wa-card p-2 text-xs flex flex-col gap-1 w-full">
              <div className="flex items-center justify-between text-ink-subtle">
                <span>{formatAgo(c.createdAt)}</span>
                <button
                  type="button"
                  className="hover:text-danger cursor-pointer"
                  aria-label="Remove comment"
                  onClick={() => removeComment(node.id, c.id)}
                >
                  ×
                </button>
              </div>
              <p className="m-0 text-ink">{c.text}</p>
            </div>
          ))}
        </div>
        <form onSubmit={onAddComment} className="flex gap-2">
          <input
            className="wa-input h-7 flex-1 text-xs"
            placeholder="Add comment..."
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
          />
          <button type="submit" className="wa-btn wa-btn--sm" disabled={!commentInput.trim()}>
            Add
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Single Group Details ──────────────────────────────────────────────────

function GroupDetails({ group }: { group: Group }): ReactElement {
  const board = useBoardStore((s) => s.board)
  const [prevLabel, setPrevLabel] = useState(group.label)
  const [label, setLabel] = useState(group.label)
  if (group.label !== prevLabel) {
    setPrevLabel(group.label)
    setLabel(group.label)
  }

  const [prevNote, setPrevNote] = useState(group.note)
  const [note, setNote] = useState(group.note)
  if (group.note !== prevNote) {
    setPrevNote(group.note)
    setNote(group.note)
  }

  const [commentInput, setCommentInput] = useState('')

  const commitLabel = (): void => {
    const next = label.trim()
    if (next && next !== group.label) {
      updateGroupFields(group.id, { label: next })
    } else {
      setLabel(group.label)
    }
  }

  const commitNote = (): void => {
    if (note !== group.note) {
      updateGroupFields(group.id, { note })
    }
  }

  const onAddComment = (e: FormEvent): void => {
    e.preventDefault()
    const next = commentInput.trim()
    if (!next) return
    addComment(group.id, next)
    setCommentInput('')
  }

  const memberCount = Object.values(board.nodes).filter((n) => n.parentGroupId === group.id).length

  return (
    <div className="flex flex-col gap-4" data-testid="inspector-group-details">
      {/* Header: overline + member count */}
      <div className="flex items-center justify-between">
        <span className="wa-overline text-ink-muted">Group</span>
        <span className="wa-caption text-ink-subtle">
          {memberCount} {memberCount === 1 ? 'card' : 'cards'}
        </span>
      </div>

      {/* Label */}
      <div className="wa-field">
        <label htmlFor="inspector-group-label" className="wa-caption text-ink-muted font-medium">
          Label
        </label>
        <input
          id="inspector-group-label"
          className="wa-input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
      </div>

      {/* Category */}
      <div className="wa-field">
        <label htmlFor="inspector-group-category" className="wa-caption text-ink-muted font-medium">
          Category
        </label>
        <select
          id="inspector-group-category"
          className="wa-input"
          value={group.category}
          onChange={(e) =>
            updateGroupFields(group.id, { category: e.target.value as GroupCategory })
          }
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Colour */}
      <div className="wa-field">
        <span className="wa-caption text-ink-muted font-medium">Colour</span>
        <div className="flex items-center gap-2">
          {CATS.map((c) => (
            <button
              key={c}
              type="button"
              className={`wa-sw ${group.color === c ? 'wa-sw--on' : ''}`}
              style={{ ['--gc' as string]: `var(--cat-${c})` }}
              aria-label={`Colour ${c}`}
              onClick={() => updateGroupFields(group.id, { color: c })}
            />
          ))}
        </div>
      </div>

      {/* Group Note */}
      <div className="wa-field">
        <label htmlFor="inspector-group-note" className="wa-label text-ink font-medium">
          Group note
        </label>
        <textarea
          id="inspector-group-note"
          className="wa-input"
          rows={3}
          placeholder="Notes about this group"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={commitNote}
          onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) e.currentTarget.blur()
          }}
        />
      </div>

      {/* Comments */}
      <div className="wa-field">
        <span className="wa-caption text-ink-muted font-medium">Comments</span>
        <div className="flex flex-col gap-2 mb-2">
          {group.comments.map((c) => (
            <div key={c.id} className="wa-card p-2 text-xs flex flex-col gap-1 w-full">
              <div className="flex items-center justify-between text-ink-subtle">
                <span>{formatAgo(c.createdAt)}</span>
                <button
                  type="button"
                  className="hover:text-danger cursor-pointer"
                  aria-label="Remove comment"
                  onClick={() => removeComment(group.id, c.id)}
                >
                  ×
                </button>
              </div>
              <p className="m-0 text-ink">{c.text}</p>
            </div>
          ))}
        </div>
        <form onSubmit={onAddComment} className="flex gap-2">
          <input
            className="wa-input h-7 flex-1 text-xs"
            placeholder="Add comment..."
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
          />
          <button type="submit" className="wa-btn wa-btn--sm" disabled={!commentInput.trim()}>
            Add
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Multi-Selection Details ───────────────────────────────────────────────

function MultiDetails({
  count,
  nodeIds,
  allIds
}: {
  count: number
  nodeIds: string[]
  allIds: string[]
}): ReactElement {
  const [tagInput, setTagInput] = useState('')

  const onAddTag = (e: FormEvent): void => {
    e.preventDefault()
    const next = tagInput.trim()
    if (!next || !nodeIds.length) return
    tagItems(nodeIds, next)
    setTagInput('')
  }

  return (
    <div className="flex flex-col gap-4" data-testid="inspector-multi-details">
      <div className="wa-title text-ink">{count} selected</div>

      {/* Bulk Tag */}
      {nodeIds.length ? (
        <div className="wa-field">
          <span className="wa-caption text-ink-muted font-medium">Tag all cards</span>
          <form onSubmit={onAddTag} className="flex gap-2">
            <input
              className="wa-input h-7 flex-1 text-xs"
              placeholder="Tag..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
            />
            <button type="submit" className="wa-btn wa-btn--sm" disabled={!tagInput.trim()}>
              Add
            </button>
          </form>
        </div>
      ) : null}

      {/* Bulk Colour */}
      <div className="wa-field">
        <span className="wa-caption text-ink-muted font-medium">Colour all</span>
        <div className="flex items-center gap-2">
          {CATS.map((c) => (
            <button
              key={c}
              type="button"
              className="wa-sw"
              style={{ ['--gc' as string]: `var(--cat-${c})` }}
              aria-label={`Colour ${c}`}
              onClick={() => setColor(allIds, c)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
