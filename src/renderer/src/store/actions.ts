// Action creators: everything the UI (and later the AI panel) does to a board.
// They read the current state, generate ids and timestamps, and dispatch one command,
// so each call is exactly one undo step. Components never build payloads themselves.
import { absolutePosition, toGroupSpace } from '@shared/export/geometry'
import { DEFAULT_GROUP_COLOR } from '@shared/groups'
import { normalizeTag } from '@shared/tags'
import {
  CATS,
  type Board,
  type Cat,
  type CanvasNode,
  type Command,
  type Edge,
  type EdgeOrigin,
  type Ghost,
  type GroupCategory,
  type GroupPatch,
  type NewGroup,
  type NodePatch,
  type ParentChange,
  type Relation,
  type Size,
  type XY
} from '@shared/types'
import { useBoardStore, type BoardState } from './boardStore'
import { batchOf } from './commands/def'
import { layoutGroup } from './commands/groups'
import { canApply } from './commands/registry'
import { findFreeSpot } from '../features/canvas/placement'

export { DEFAULT_GROUP_COLOR }

const state = (): BoardState => useBoardStore.getState()
const board = (): Board => state().board
const dispatch = (cmd: Command): boolean => state().dispatch(cmd)
const newId = (): string => crypto.randomUUID()

function same(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b)
}

/** Keeps only the keys whose value would actually change. */
function changedKeys<P extends object>(current: object, patch: P): Partial<P> {
  const c = current as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(patch).filter(([key, value]) => !same(c[key], value))
  ) as Partial<P>
}

function splitIds(ids: string[]): { nodeIds: string[]; groupIds: string[]; edgeIds: string[] } {
  const b = board()
  return {
    nodeIds: ids.filter((id) => b.nodes[id]),
    groupIds: ids.filter((id) => b.groups[id]),
    edgeIds: ids.filter((id) => b.edges[id])
  }
}

// ─── Cards ─────────────────────────────────────────────────────────────────

/** Adds an empty (or pre-filled) note card at an absolute canvas position. Returns its id. */
export function addNoteAt(position: XY, text = ''): string {
  const node: CanvasNode = {
    id: newId(),
    kind: 'note',
    title: text,
    highlights: [],
    note: '',
    comments: [],
    tags: [],
    position: { x: position.x, y: position.y },
    capturedAt: Date.now()
  }
  dispatch({ type: 'addNodes', payload: { nodes: [node] } })
  return node.id
}

/** Changes card fields (title, note, summary…); unchanged fields are ignored. */
export function updateNodeFields(id: string, patch: NodePatch): boolean {
  const node = board().nodes[id]
  if (!node) return false
  const changed = changedKeys(node, patch)
  if (!Object.keys(changed).length) return false
  return dispatch({ type: 'updateNode', payload: { id, patch: changed } })
}

/** Edits the research-question card. */
export function updateQuestion(text: string): boolean {
  const question = Object.values(board().nodes).find((n) => n.kind === 'question')
  return question ? updateNodeFields(question.id, { title: text }) : false
}

/**
 * Deletes cards, links and groups. Deleting a group removes the frame only; its cards
 * stay. The research-question card is never deleted.
 */
export function deleteSelection(ids: string[]): boolean {
  const { nodeIds, groupIds, edgeIds } = splitIds(ids)
  const commands: Command[] = []
  if (edgeIds.length) commands.push({ type: 'disconnect', payload: { ids: edgeIds } })
  if (nodeIds.length) commands.push({ type: 'removeNodes', payload: { ids: nodeIds } })
  for (const id of groupIds) commands.push({ type: 'removeGroup', payload: { id } })
  return commands.length ? dispatch(batchOf(commands)) : false
}

/** Commits the end of a drag (positions in each item's own coordinate space). */
export function moveCommitted(moves: { id: string; to: XY }[]): boolean {
  const b = board()
  const real = moves.filter((m) => {
    const item = b.nodes[m.id] ?? b.groups[m.id]
    return item && (item.position.x !== m.to.x || item.position.y !== m.to.y)
  })
  return real.length ? dispatch({ type: 'moveItems', payload: { moves: real } }) : false
}

/** Commits the end of a resize. `null` returns a card to its default size. */
export function resizeCommitted(id: string, size: Size | null, position?: XY): boolean {
  const item = board().nodes[id] ?? board().groups[id]
  const commands: Command[] = [{ type: 'resizeItem', payload: { id, size } }]
  // Resizing from the left or top edge also moves the item; both are one undo step.
  if (item && position && (item.position.x !== position.x || item.position.y !== position.y)) {
    commands.push({ type: 'moveItems', payload: { moves: [{ id, to: position }] } })
  }
  return dispatch(batchOf(commands))
}

/** Where one dragged item ended up. */
export interface DragResult {
  id: string
  /** Position in its current parent's space (what the canvas reports). */
  position: XY
  /** Absolute canvas position. */
  absolute: XY
  /** The group it was dropped into (null for none). Ignored for groups. */
  groupId: string | null
}

/**
 * Commits the end of a drag as one undo step: plain moves, plus cards that were
 * dropped into, out of or between groups (converted to the new parent's space).
 */
export function commitDrag(results: DragResult[]): boolean {
  const b = board()
  const moves: { id: string; to: XY }[] = []
  const parents: ParentChange[] = []
  for (const r of results) {
    const group = b.groups[r.id]
    if (group) {
      if (!same(group.position, r.position)) moves.push({ id: r.id, to: r.position })
      continue
    }
    const node = b.nodes[r.id]
    if (!node) continue
    const target =
      node.kind === 'question' || (r.groupId && !b.groups[r.groupId]) ? null : r.groupId
    if (node.kind !== 'question' && target !== (node.parentGroupId ?? null)) {
      parents.push({ id: r.id, groupId: target, position: toGroupSpace(r.absolute, target, b) })
    } else if (!same(node.position, r.position)) {
      moves.push({ id: r.id, to: r.position })
    }
  }
  const commands: Command[] = []
  if (moves.length) commands.push({ type: 'moveItems', payload: { moves } })
  if (parents.length) commands.push({ type: 'setParent', payload: { items: parents } })
  return commands.length ? dispatch(batchOf(commands)) : false
}

/** Moves cards and groups by a fixed step (arrow keys), as one undo step. */
export function nudge(ids: string[], dx: number, dy: number): boolean {
  const b = board()
  const moves = ids
    .map((id) => b.nodes[id] ?? b.groups[id])
    .filter(Boolean)
    .map((item) => ({ id: item.id, to: { x: item.position.x + dx, y: item.position.y + dy } }))
  return moves.length ? dispatch({ type: 'moveItems', payload: { moves } }) : false
}

/** Colours cards and groups. `null` clears a card's colour (groups always keep one). */
export function setColor(ids: string[], color: Cat | null): boolean {
  const { nodeIds, groupIds } = splitIds(ids)
  const b = board()
  const commands: Command[] = []
  for (const id of nodeIds) {
    if ((b.nodes[id].color ?? null) !== color) {
      commands.push({ type: 'updateNode', payload: { id, patch: { color: color ?? undefined } } })
    }
  }
  if (color) {
    for (const id of groupIds) {
      if (b.groups[id].color !== color) {
        commands.push({ type: 'updateGroup', payload: { id, patch: { color } } })
      }
    }
  }
  return commands.length ? dispatch(batchOf(commands)) : false
}

export function tagItems(nodeIds: string[], tag: string): boolean {
  const t = normalizeTag(tag)
  return t ? dispatch({ type: 'addTags', payload: { nodeIds, tag: t } }) : false
}

export function untag(nodeIds: string[], tag: string): boolean {
  return dispatch({ type: 'removeTag', payload: { nodeIds, tag: normalizeTag(tag) } })
}

/** Adds a quote to a card. Returns the highlight id, or null for an empty quote. */
export function addHighlight(nodeId: string, quote: string): string | null {
  const text = quote.trim()
  if (!text || !board().nodes[nodeId]) return null
  const highlight = { id: newId(), quote: text, createdAt: Date.now() }
  return dispatch({ type: 'addHighlight', payload: { nodeId, highlight } }) ? highlight.id : null
}

export function removeHighlight(nodeId: string, highlightId: string): boolean {
  return dispatch({ type: 'removeHighlight', payload: { nodeId, highlightId } })
}

/** Adds a comment to a card or group. Returns the comment id, or null. */
export function addComment(targetId: string, text: string): string | null {
  const body = text.trim()
  if (!body) return null
  const comment = { id: newId(), text: body, createdAt: Date.now() }
  return dispatch({ type: 'addComment', payload: { targetId, comment } }) ? comment.id : null
}

export function removeComment(targetId: string, commentId: string): boolean {
  return dispatch({ type: 'removeComment', payload: { targetId, commentId } })
}

// ─── Edges ─────────────────────────────────────────────────────────────────

/** Links two cards. Returns the edge id, or null if the link isn't possible or already exists. */
export function connectNodes(
  source: string,
  target: string,
  relation: Relation = 'related',
  origin: EdgeOrigin = 'user',
  label?: string
): string | null {
  const edge: Edge = { id: newId(), source, target, relation, origin }
  if (label) edge.label = label
  return dispatch({ type: 'connect', payload: { edge } }) ? edge.id : null
}

/** Sets a link's relation. Only `custom` keeps a free-text label. */
export function setEdgeRelation(id: string, relation: Relation, label?: string): boolean {
  const edge = board().edges[id]
  if (!edge) return false
  const patch = changedKeys(edge, {
    relation,
    label: relation === 'custom' ? label?.trim() || undefined : undefined
  })
  if (!Object.keys(patch).length) return false
  return dispatch({ type: 'updateEdge', payload: { id, patch } })
}

export function disconnectEdges(ids: string[]): boolean {
  return dispatch({ type: 'disconnect', payload: { ids } })
}

// ─── Groups ────────────────────────────────────────────────────────────────

/** Wraps cards in a new group (packed in a grid). Returns the group id, or null. */
export function groupSelection(
  ids: string[],
  label: string,
  category: GroupCategory = 'topic',
  color: Cat = DEFAULT_GROUP_COLOR[category]
): string | null {
  const group: NewGroup = { id: newId(), label: label.trim(), color, category }
  const position = groupPlacement(group, ids)
  if (position) group.position = position
  const ok = dispatch({ type: 'createGroup', payload: { group, memberIds: ids } })
  return ok ? group.id : null
}

/**
 * Where a new group's frame should go: its natural spot (around its members) unless that
 * would cover other cards or groups, in which case the nearest free spot. Null = natural.
 */
function groupPlacement(group: NewGroup, ids: string[]): XY | null {
  const b = board()
  const members = [...new Set(ids)]
    .map((id) => b.nodes[id])
    .filter((n) => n && n.kind !== 'question')
  if (!members.length) return null
  const { group: frame } = layoutGroup(b, group, members)
  const memberIds = new Set(members.map((n) => n.id))
  // The board as it will be around the new frame: without the cards that move into it.
  const others: Board = {
    ...b,
    nodes: Object.fromEntries(Object.entries(b.nodes).filter(([id]) => !memberIds.has(id)))
  }
  const spot = findFreeSpot(others, frame.position, frame.size)
  return spot.x === frame.position.x && spot.y === frame.position.y ? null : spot
}

/** Changes group fields (label, colour, category, note); unchanged fields are ignored. */
export function updateGroupFields(id: string, patch: GroupPatch): boolean {
  const group = board().groups[id]
  if (!group) return false
  const changed = changedKeys(group, patch)
  if (!Object.keys(changed).length) return false
  return dispatch({ type: 'updateGroup', payload: { id, patch: changed } })
}

/** Removes a group frame and keeps its cards where they are. */
export function ungroup(id: string): boolean {
  return dispatch({ type: 'removeGroup', payload: { id } })
}

/**
 * Moves cards into a group, or out of any group with `null`, as one undo step.
 * `dropped` gives the cards' absolute positions at the end of a drag; cards without
 * one keep their current absolute position.
 */
export function dropIntoGroup(
  nodeIds: string[],
  groupId: string | null,
  dropped: Record<string, XY> = {}
): boolean {
  const b = board()
  if (groupId && !b.groups[groupId]) return false
  const items: ParentChange[] = []
  for (const id of nodeIds) {
    const node = b.nodes[id]
    if (!node || node.kind === 'question') continue
    const position = toGroupSpace(dropped[id] ?? absolutePosition(node, b), groupId, b)
    const sameParent = (node.parentGroupId ?? null) === groupId
    if (sameParent && same(node.position, position)) continue
    items.push({ id, groupId, position })
  }
  return items.length ? dispatch({ type: 'setParent', payload: { items } }) : false
}

// ─── Ghosts (AI suggestions) ───────────────────────────────────────────────

/** Accepted links are marked as AI-made; a group without a valid colour gets a default. */
function prepareGhostCommand(cmd: Command): Command {
  switch (cmd.type) {
    case 'connect':
      return { type: 'connect', payload: { edge: { ...cmd.payload.edge, origin: 'ai' } } }
    case 'createGroup': {
      const g = cmd.payload.group
      const color = (CATS as readonly string[]).includes(g.color)
        ? g.color
        : (DEFAULT_GROUP_COLOR[g.category] ?? 'teal')
      const group: NewGroup = { ...g, color }
      // Like the Group button: the new frame never covers other cards.
      const position = g.position ? null : groupPlacement(group, cmd.payload.memberIds)
      if (position) group.position = position
      return { type: 'createGroup', payload: { ...cmd.payload, group } }
    }
    case 'batch':
      return { type: 'batch', payload: { commands: cmd.payload.commands.map(prepareGhostCommand) } }
    default:
      return cmd
  }
}

/**
 * Whether a suggestion still fits the board as the student has changed it since Organize
 * ran: its cards exist and it would change something, a suggested group would not pull
 * cards out of a group the student made, and a suggested link is not already there.
 */
export function ghostFits(b: Board, ghost: Ghost): boolean {
  const cmd = ghost.command
  if (cmd.type === 'createGroup') {
    if (cmd.payload.memberIds.some((id) => b.nodes[id]?.parentGroupId)) return false
  } else if (cmd.type === 'connect') {
    const { source, target } = cmd.payload.edge
    const linked = Object.values(b.edges).some(
      (e) =>
        (e.source === source && e.target === target) || (e.source === target && e.target === source)
    )
    if (linked) return false
  }
  return canApply(b, cmd)
}

/**
 * Applies a suggestion and removes it, as one undo step (undo brings the suggestion
 * back). A suggestion that no longer fits the board (e.g. its card was deleted) is
 * dropped without an undo step, and false is returned.
 */
export function acceptGhost(id: string): boolean {
  const ghost = board().ghosts[id]
  if (!ghost) return false
  const command = prepareGhostCommand(ghost.command)
  if (!ghostFits(board(), ghost) || !canApply(board(), command)) {
    state().patchSilently((d) => {
      delete d.ghosts[id]
    })
    return false
  }
  return dispatch(batchOf([command, { type: 'removeGhosts', payload: { ids: [id] } }]))
}

/** The item an accepted suggestion created or changed (a group, a link or the tagged cards). */
export function ghostTargets(ghost: Ghost): string[] {
  const cmd = ghost.command
  if (cmd.type === 'createGroup') return [cmd.payload.group.id]
  if (cmd.type === 'connect') return [cmd.payload.edge.source, cmd.payload.edge.target]
  if (cmd.type === 'addTags') return cmd.payload.nodeIds
  return []
}

export function rejectGhost(id: string): boolean {
  return dispatch({ type: 'removeGhosts', payload: { ids: [id] } })
}

const GHOST_ORDER: Record<Ghost['kind'], number> = { group: 0, edge: 1, tag: 2 }

/** Accepts every suggestion, each as its own undo step. Returns how many were applied. */
export function acceptAllGhosts(): number {
  const ghosts = Object.values(board().ghosts).sort(
    (a, b) =>
      GHOST_ORDER[a.kind] - GHOST_ORDER[b.kind] ||
      b.confidence - a.confidence ||
      (a.id < b.id ? -1 : 1)
  )
  return ghosts.filter((g) => acceptGhost(g.id)).length
}

/** Rejects every suggestion as one undo step. */
export function rejectAllGhosts(): boolean {
  const ids = Object.keys(board().ghosts)
  return ids.length ? dispatch({ type: 'removeGhosts', payload: { ids } }) : false
}

// ─── Capture ───────────────────────────────────────────────────────────────

/**
 * Adds a captured card, plus an "opened from" link from the card it was opened from,
 * as one undo step.
 */
export function addCapturedNode(node: CanvasNode, parentId: string | null): boolean {
  const commands: Command[] = [{ type: 'addNodes', payload: { nodes: [node] } }]
  if (parentId && board().nodes[parentId]) {
    commands.push({
      type: 'connect',
      payload: {
        edge: {
          id: newId(),
          source: parentId,
          target: node.id,
          relation: 'opened-from',
          origin: 'provenance'
        }
      }
    })
  }
  return dispatch(batchOf(commands))
}
