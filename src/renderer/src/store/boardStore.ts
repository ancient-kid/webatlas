// The board and its undo/redo history. Every user change goes through dispatch();
// components call the action creators in actions.ts rather than dispatching directly.
import { freeze, produce } from 'immer'
import { create, type StoreApi, type UseBoundStore } from 'zustand'
import type { Board, Command, Ghost } from '@shared/types'
import { applyToBoard, invertCommand } from './commands/registry'

/** Undo steps kept per session (history is not saved to disk). */
export const HISTORY_LIMIT = 200

export interface HistoryEntry {
  command: Command
  inverse: Command
}

export interface BoardState {
  board: Board
  /** Applied commands with their inverses, oldest first. */
  past: HistoryEntry[]
  /** Undone commands, most recently undone last. */
  future: Command[]
  /** Applies a command as one undo step. Returns false (and records nothing) if nothing changed. */
  dispatch(cmd: Command): boolean
  undo(): boolean
  redo(): boolean
  canUndo(): boolean
  canRedo(): boolean
  /** Replaces the board (opening a workspace) and clears history. */
  load(board: Board): void
  /** A system update with no undo step, e.g. a summary arriving after capture. */
  patchSilently(recipe: (draft: Board) => void): void
  /** Replaces the pending AI suggestions (no undo step). */
  setGhosts(ghosts: Ghost[]): void
}

export function emptyBoard(): Board {
  return { nodes: {}, groups: {}, edges: {}, ghosts: {} }
}

function pushPast(past: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const next = [...past, entry]
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next
}

/** Creates an independent store (tests); the app uses `useBoardStore`. */
export function createBoardStore(): UseBoundStore<StoreApi<BoardState>> {
  return create<BoardState>()((set, get) => ({
    board: freeze(emptyBoard(), true),
    past: [],
    future: [],

    dispatch(cmd) {
      const { board, past } = get()
      let next: Board
      let inverse: Command
      try {
        inverse = invertCommand(board, cmd)
        next = applyToBoard(board, cmd)
      } catch (err) {
        console.error('[board] command failed', cmd.type, err)
        return false
      }
      if (next === board) return false
      set({ board: next, past: pushPast(past, { command: cmd, inverse }), future: [] })
      return true
    },

    undo() {
      const { board, past, future } = get()
      const entry = past.at(-1)
      if (!entry) return false
      try {
        set({
          board: applyToBoard(board, entry.inverse),
          past: past.slice(0, -1),
          future: [...future, entry.command]
        })
      } catch (err) {
        console.error('[board] undo failed', entry.command.type, err)
        set({ past: past.slice(0, -1) })
        return false
      }
      return true
    },

    // Redo re-runs the original command, which recomputes its inverse.
    redo() {
      const { board, past, future } = get()
      const cmd = future.at(-1)
      if (!cmd) return false
      try {
        const inverse = invertCommand(board, cmd)
        set({
          board: applyToBoard(board, cmd),
          past: pushPast(past, { command: cmd, inverse }),
          future: future.slice(0, -1)
        })
      } catch (err) {
        console.error('[board] redo failed', cmd.type, err)
        set({ future: future.slice(0, -1) })
        return false
      }
      return true
    },

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    load(board) {
      set({ board: freeze(board, true), past: [], future: [] })
    },

    patchSilently(recipe) {
      set({ board: produce(get().board, recipe) })
    },

    setGhosts(ghosts) {
      get().patchSilently((d) => {
        d.ghosts = Object.fromEntries(ghosts.map((g) => [g.id, g]))
      })
    }
  }))
}

export const useBoardStore = createBoardStore()
