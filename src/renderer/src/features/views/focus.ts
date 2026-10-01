import type { Board } from '@shared/types'

/**
 * Computes the set of IDs (node IDs and group IDs) that are in focus.
 * - If selectedIds is empty: anchored on the question card + its 1-hop neighbours and group.
 * - For a card: the card itself + its 1-hop neighbours (via edges in both directions) + its parent group.
 * - For a group: the group + its members + each member's 1-hop neighbours (+ their groups).
 */
export function focusSet(board: Board, selectedIds: string[]): Set<string> {
  const result = new Set<string>()

  const validSelected = selectedIds.filter(
    (id) => Boolean(board.nodes[id]) || Boolean(board.groups[id])
  )

  let anchors: string[]
  if (validSelected.length > 0) {
    anchors = validSelected
  } else {
    const question = Object.values(board.nodes).find((n) => n.kind === 'question')
    anchors = question ? [question.id] : []
  }

  const addCard = (cardId: string): void => {
    result.add(cardId)
    const node = board.nodes[cardId]
    if (node?.parentGroupId && board.groups[node.parentGroupId]) {
      result.add(node.parentGroupId)
    }
  }

  const cardsToExpand = new Set<string>()

  for (const id of anchors) {
    if (board.groups[id]) {
      result.add(id)
      for (const node of Object.values(board.nodes)) {
        if (node.parentGroupId === id) {
          result.add(node.id)
          cardsToExpand.add(node.id)
        }
      }
    } else if (board.nodes[id]) {
      addCard(id)
      cardsToExpand.add(id)
    }
  }

  for (const cardId of cardsToExpand) {
    for (const edge of Object.values(board.edges)) {
      if ((edge as unknown as { ghost?: boolean }).ghost) continue
      if (edge.source === cardId && board.nodes[edge.target]) {
        addCard(edge.target)
      } else if (edge.target === cardId && board.nodes[edge.source]) {
        addCard(edge.source)
      }
    }
  }

  return result
}
