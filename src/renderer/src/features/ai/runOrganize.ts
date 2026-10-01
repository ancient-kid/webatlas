// One Organize run: send the board to the agent, then show its suggestions as ghosts
// (replacing any still pending) in the Suggestions tab. Nothing on the board changes
// until the student accepts a suggestion.
import { toast } from 'sonner'
import type { OrganizeResult } from '@shared/types'
import { errorMessage } from '@renderer/lib/errors'
import { useAppStore } from '@renderer/store/appStore'
import { useBoardStore } from '@renderer/store/boardStore'
import { visibleGhosts } from './ghostsToFlow'
import { buildSnapshot } from './snapshot'

let runId = 0

/** The board as Organize would see it, sent to the agent without touching the board. */
export async function organizeCurrentBoard(): Promise<OrganizeResult> {
  const ws = useAppStore.getState().workspace
  if (!ws) throw new Error('No workspace is open')
  return window.api.ai.organize(buildSnapshot(useBoardStore.getState().board, ws))
}

export function suggestionCount(n: number): string {
  return `${n} suggestion${n === 1 ? '' : 's'} to review`
}

/** Runs Organize for the open workspace. Returns the result, or null if it was dropped. */
export async function runOrganize(): Promise<OrganizeResult | null> {
  const app = useAppStore.getState()
  const ws = app.workspace
  if (!ws || app.organizing) return null
  const id = ++runId
  app.setOrganizing(true)
  try {
    const res = await organizeCurrentBoard()
    // The student went to another workspace (or Home) meanwhile: drop the result.
    if (useAppStore.getState().workspace?.id !== ws.id) return null
    const board = useBoardStore.getState()
    board.setGhosts(res.ghosts)
    const shown = visibleGhosts(useBoardStore.getState().board).length
    useAppStore.getState().setSideTab('suggestions')
    const count = shown ? suggestionCount(shown) : ''
    toast(res.message ? (count ? `${res.message} ${count}.` : res.message) : count)
    return res
  } catch (err) {
    if (useAppStore.getState().workspace?.id === ws.id) {
      toast(`Organize didn't work this time: ${errorMessage(err)}`)
    }
    return null
  } finally {
    if (id === runId) useAppStore.getState().setOrganizing(false)
  }
}
