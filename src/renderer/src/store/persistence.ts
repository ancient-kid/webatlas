// Autosave: any change to the open workspace (board, session or details) is saved
// 500 ms after the last change. flush() saves immediately and waits, and is used when
// leaving a workspace and when the window closes.
import type { Workspace } from '@shared/types'
import { useBoardStore, type createBoardStore } from './boardStore'
import { useAppStore, type AppStore } from './appStore'

export const AUTOSAVE_DELAY_MS = 500

type BoardStore = ReturnType<typeof createBoardStore>

export interface AutosaveDeps {
  board: BoardStore
  app: AppStore
  save: (workspace: Workspace) => Promise<void>
  delayMs?: number
  onError?: (err: unknown) => void
}

export interface Autosave {
  /** Starts watching the stores (once, at app start). */
  start(): void
  stop(): void
  /** Saves now if anything changed, and waits for any save in progress. */
  flush(): Promise<void>
  /** Stops reacting to changes (while a workspace is being swapped in or out). */
  pause(): void
  /** Forgets pending changes and starts reacting again (a workspace was just opened). */
  resume(): void
}

/** The workspace as it should be written: details + session + board. */
export function assembleWorkspace(board: BoardStore, app: AppStore): Workspace | null {
  const { workspace, session } = app.getState()
  if (!workspace) return null
  const b = board.getState().board
  const question = Object.values(b.nodes)
    .find((n) => n.kind === 'question')
    ?.title.trim()
  const ws: Workspace = { ...workspace, session, board: b }
  // The question card is the source of truth for the research question.
  if (question) ws.researchQuestion = question
  else delete ws.researchQuestion
  return ws
}

export function createAutosave(deps: AutosaveDeps): Autosave {
  const delay = deps.delayMs ?? AUTOSAVE_DELAY_MS
  let timer: ReturnType<typeof setTimeout> | null = null
  let dirty = false
  let paused = true
  let inFlight: Promise<void> | null = null
  let unsubscribe: (() => void) | null = null

  const clearTimer = (): void => {
    if (timer) clearTimeout(timer)
    timer = null
  }

  async function saveNow(): Promise<void> {
    clearTimer()
    if (!dirty) {
      await inFlight?.catch(() => undefined)
      return
    }
    const ws = assembleWorkspace(deps.board, deps.app)
    dirty = false
    if (!ws) return
    const previous = inFlight
    const run = (async () => {
      await previous?.catch(() => undefined)
      await deps.save(ws)
    })()
    inFlight = run
    try {
      await run
    } catch (err) {
      dirty = true // try again with the next change or flush
      deps.onError?.(err)
    } finally {
      if (inFlight === run) inFlight = null
    }
  }

  function changed(): void {
    if (paused) return
    dirty = true
    clearTimer()
    timer = setTimeout(() => void saveNow(), delay)
  }

  return {
    start() {
      if (unsubscribe) return
      const offBoard = deps.board.subscribe((s, prev) => {
        if (s.board !== prev.board) changed()
      })
      const offApp = deps.app.subscribe((s, prev) => {
        if (s.session !== prev.session || s.workspace !== prev.workspace) changed()
      })
      unsubscribe = () => {
        offBoard()
        offApp()
      }
    },
    stop() {
      unsubscribe?.()
      unsubscribe = null
      clearTimer()
    },
    flush: saveNow,
    pause() {
      paused = true
    },
    resume() {
      clearTimer()
      dirty = false
      paused = false
    }
  }
}

/** The app's autosave, saving through window.api. */
export const autosave = createAutosave({
  board: useBoardStore,
  app: useAppStore,
  save: (ws) => window.api.workspace.save(ws),
  onError: (err) => console.error('[autosave]', err)
})
