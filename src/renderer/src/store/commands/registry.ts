// The command layer: the only way a board changes. Every command is a serialisable
// {type, payload} record with a deterministic apply and an inverse for undo.
import { produce } from 'immer'
import type { Board, Command, CommandOf, CommandType } from '@shared/types'
import type { CommandDef, DefsFor } from './def'
import { edgeCommands } from './edges'
import { ghostCommands } from './ghosts'
import { groupCommands } from './groups'
import { nodeCommands } from './nodes'
import { nodeRefs } from './refs'

// Sub-commands run in order; the inverse runs their inverses in reverse order, each
// computed against the state the sub-command actually saw.
const batch: CommandDef<CommandOf<'batch'>> = {
  apply(draft, { commands }) {
    for (const c of commands) applyCommand(draft, c)
  },
  invert(before, { commands }) {
    let state = before
    const inverses: Command[] = []
    for (const c of commands) {
      inverses.push(invertCommand(state, c))
      state = applyToBoard(state, c)
    }
    return { type: 'batch', payload: { commands: inverses.reverse() } }
  }
}

const registry: DefsFor<CommandType> = {
  ...nodeCommands,
  ...edgeCommands,
  ...groupCommands,
  ...ghostCommands,
  batch
}

function defOf(cmd: Command): CommandDef<Command> {
  const def = registry[cmd.type] as CommandDef<Command> | undefined
  if (!def) throw new Error(`Unknown command: ${String(cmd.type)}`)
  return def
}

/** Applies a command to an immer draft. */
export function applyCommand(draft: Board, cmd: Command): void {
  defOf(cmd).apply(draft, cmd.payload)
}

/** The command that undoes `cmd`, computed from the board before it is applied. */
export function invertCommand(before: Board, cmd: Command): Command {
  return defOf(cmd).invert(before, cmd.payload)
}

/** Returns the board after `cmd`. The same object comes back when nothing changed. */
export function applyToBoard(board: Board, cmd: Command): Board {
  return produce(board, (draft) => applyCommand(draft, cmd))
}

/**
 * Whether a command (usually a ghost's) still makes sense: every card it refers to
 * exists and applying it would change the board. Malformed commands give false.
 */
export function canApply(board: Board, cmd: Command): boolean {
  try {
    if (!nodeRefs(cmd).every((id) => board.nodes[id])) return false
    return applyToBoard(board, cmd) !== board
  } catch {
    return false
  }
}
