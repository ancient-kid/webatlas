// Accepting or rejecting a suggestion from the canvas or the Suggestions panel. Both are
// ordinary undoable commands (actions.ts); accepting also brings the result into view.
import { toast } from 'sonner'
import { acceptGhost, ghostTargets, rejectGhost } from '@renderer/store/actions'
import { useAppStore } from '@renderer/store/appStore'
import { useBoardStore } from '@renderer/store/boardStore'
import { canvas } from '../canvas/canvasControl'

function clearHover(id: string): void {
  const app = useAppStore.getState()
  if (app.hoveredGhostId === id) app.setHoveredGhost(null)
}

/** Applies a suggestion. A group is framed once it exists; links and tags are revealed. */
export function acceptSuggestion(id: string): boolean {
  const ghost = useBoardStore.getState().board.ghosts[id]
  if (!ghost) return false
  clearHover(id)
  if (!acceptGhost(id)) {
    toast('That suggestion no longer fits the board, so it was removed.')
    return false
  }
  const targets = ghostTargets(ghost)
  // Wait a frame so the canvas has the new group before framing it.
  setTimeout(() => {
    if (ghost.kind === 'group') canvas().zoomTo(targets)
    else canvas().reveal(targets)
  }, 60)
  return true
}

export function rejectSuggestion(id: string): boolean {
  clearHover(id)
  return rejectGhost(id)
}
