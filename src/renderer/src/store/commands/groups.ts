// Group commands. A card inside a group stores its position relative to the group,
// so every parent change converts positions (see @shared/export/geometry).
import { absolutePosition, GRID, GROUP_PAD, nodeSize } from '@shared/export/geometry'
import type { Board, CanvasNode, Command, Group, NewGroup, ParentChange, XY } from '@shared/types'
import { assignPatch, batchOf, copy, NOOP, prevValues, samePair, unique, type DefsFor } from './def'

/** Cards that can join a new group. None if the group id is already taken. */
function groupMembers(board: Board, group: NewGroup, memberIds: string[]): CanvasNode[] {
  if (board.groups[group.id]) return []
  return unique(memberIds)
    .map((id) => board.nodes[id])
    .filter((n) => n && n.kind !== 'question')
}

/**
 * Packs the members into a grid inside a new group, in reading order (top to bottom,
 * left to right). The group's top-left sits just above and left of the members' top-left,
 * so the cards stay roughly where they were.
 */
export function layoutGroup(
  board: Board,
  group: NewGroup,
  members: CanvasNode[]
): { group: Group; positions: Map<string, XY> } {
  const items = members
    .map((n) => ({ id: n.id, at: absolutePosition(n, board), size: nodeSize(n) }))
    .sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x || (a.id < b.id ? -1 : 1))
  const minX = Math.min(...items.map((i) => i.at.x))
  const minY = Math.min(...items.map((i) => i.at.y))
  const cols = Math.ceil(Math.sqrt(items.length))
  const rows = Math.ceil(items.length / cols)
  const cellW = Math.max(...items.map((i) => i.size.w)) + GRID
  const cellH = Math.max(...items.map((i) => i.size.h)) + GRID

  const positions = new Map<string, XY>()
  items.forEach((item, i) => {
    positions.set(item.id, {
      x: GROUP_PAD.side + (i % cols) * cellW,
      y: GROUP_PAD.top + Math.floor(i / cols) * cellH
    })
  })
  return {
    group: {
      id: group.id,
      label: group.label,
      color: group.color,
      category: group.category,
      position: { x: minX - GROUP_PAD.side, y: minY - GROUP_PAD.top },
      size: { w: GROUP_PAD.side + cols * cellW, h: GROUP_PAD.top + rows * cellH },
      note: '',
      comments: []
    },
    positions
  }
}

function membersOf(board: Board, groupId: string): CanvasNode[] {
  return Object.values(board.nodes).filter((n) => n.parentGroupId === groupId)
}

/** A parent change is valid for an existing non-question card and a known group (or none). */
function validParentChange(board: Board, item: ParentChange): boolean {
  const node = board.nodes[item.id]
  if (!node || node.kind === 'question') return false
  return item.groupId === null || Boolean(board.groups[item.groupId])
}

export const groupCommands: DefsFor<
  'createGroup' | 'addGroups' | 'updateGroup' | 'removeGroup' | 'setParent'
> = {
  createGroup: {
    apply(draft, { group, memberIds }) {
      const members = groupMembers(draft, group, memberIds)
      if (!members.length) return
      const layout = layoutGroup(draft, group, members)
      draft.groups[group.id] = layout.group
      for (const n of members) {
        n.parentGroupId = group.id
        n.position = layout.positions.get(n.id)!
      }
    },
    // Undo: put every member back in its old group (or none) at its old position,
    // then remove the now-empty group.
    invert(before, { group, memberIds }) {
      const members = groupMembers(before, group, memberIds)
      if (!members.length) return NOOP
      return batchOf([
        {
          type: 'setParent',
          payload: {
            items: members.map((n) => ({
              id: n.id,
              groupId: n.parentGroupId ?? null,
              position: n.position
            }))
          }
        },
        { type: 'removeGroup', payload: { id: group.id } }
      ])
    }
  },

  // Plain insert; used to undo removeGroup.
  addGroups: {
    apply(draft, { groups }) {
      for (const g of groups) if (!draft.groups[g.id]) draft.groups[g.id] = copy(g)
    },
    invert(before, { groups }) {
      const ids = unique(groups.map((g) => g.id)).filter((id) => !before.groups[id])
      return batchOf(ids.map((id): Command => ({ type: 'removeGroup', payload: { id } })))
    }
  },

  updateGroup: {
    apply(draft, { id, patch }) {
      const group = draft.groups[id]
      if (group) assignPatch(group, patch)
    },
    invert(before, { id, patch }) {
      const group = before.groups[id]
      if (!group) return NOOP
      return { type: 'updateGroup', payload: { id, patch: prevValues(group, patch) } }
    }
  },

  // Removes the frame only: its cards stay on the canvas where they were.
  removeGroup: {
    apply(draft, { id }) {
      const group = draft.groups[id]
      if (!group) return
      for (const n of membersOf(draft, id)) {
        n.position = absolutePosition(n, draft)
        delete n.parentGroupId
      }
      delete draft.groups[id]
    },
    invert(before, { id }) {
      const group = before.groups[id]
      if (!group) return NOOP
      const members = membersOf(before, id)
      const restore: Command[] = [{ type: 'addGroups', payload: { groups: [group] } }]
      if (members.length) {
        restore.push({
          type: 'setParent',
          payload: { items: members.map((n) => ({ id: n.id, groupId: id, position: n.position })) }
        })
      }
      return batchOf(restore)
    }
  },

  // The payload carries positions already converted to the new parent's space.
  setParent: {
    apply(draft, { items }) {
      for (const item of items) {
        if (!validParentChange(draft, item)) continue
        const node = draft.nodes[item.id]
        if (!samePair(node.position, item.position)) {
          node.position = { x: item.position.x, y: item.position.y }
        }
        if (item.groupId) {
          if (node.parentGroupId !== item.groupId) node.parentGroupId = item.groupId
        } else if (node.parentGroupId) delete node.parentGroupId
      }
    },
    invert(before, { items }) {
      const back = items
        .filter((item) => validParentChange(before, item))
        .map((item) => {
          const node = before.nodes[item.id]
          return { id: item.id, groupId: node.parentGroupId ?? null, position: node.position }
        })
        .reverse()
      return back.length ? { type: 'setParent', payload: { items: back } } : NOOP
    }
  }
}
