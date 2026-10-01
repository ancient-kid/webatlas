import type { Command } from '@shared/types'

/**
 * Card ids a command needs to exist. Used to drop ghosts whose cards were deleted.
 * Commands that only touch groups, edges or ghosts (or create new cards) return [].
 */
export function nodeRefs(cmd: Command): string[] {
  switch (cmd.type) {
    case 'removeNodes':
      return cmd.payload.ids
    case 'updateNode':
      return [cmd.payload.id]
    case 'addTags':
    case 'removeTag':
      return cmd.payload.nodeIds
    case 'addHighlight':
    case 'removeHighlight':
      return [cmd.payload.nodeId]
    case 'connect':
      return [cmd.payload.edge.source, cmd.payload.edge.target]
    case 'createGroup':
      return cmd.payload.memberIds
    case 'setParent':
      return cmd.payload.items.map((i) => i.id)
    case 'batch':
      return cmd.payload.commands.flatMap(nodeRefs)
    default:
      return []
  }
}

/** Like nodeRefs, but a malformed command (e.g. from a hand-edited file) gives []. */
export function safeNodeRefs(cmd: Command): string[] {
  try {
    return nodeRefs(cmd)
  } catch {
    return []
  }
}
