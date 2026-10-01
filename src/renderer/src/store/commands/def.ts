import type { Board, Command, CommandOf, CommandType } from '@shared/types'

/**
 * One command type. Both functions must be deterministic in (state, payload): no
 * Date.now() or randomUUID() in here. Action creators generate ids and times and carry
 * them in the payload, so redo and accepted ghosts replay identically.
 */
export interface CommandDef<C extends Command> {
  /** Mutates an immer draft of the board. Invalid parts of the payload are skipped. */
  apply(draft: Board, payload: C['payload']): void
  /** The command that undoes this one, computed from the state before `apply`. */
  invert(before: Board, payload: C['payload']): Command
}

export type DefsFor<T extends CommandType> = { [K in T]: CommandDef<CommandOf<K>> }

/** A command that changes nothing (the inverse of a no-op). */
export const NOOP: Command = { type: 'batch', payload: { commands: [] } }

/** Wraps several commands as one; a single command is returned as is. */
export function batchOf(commands: Command[]): Command {
  if (commands.length === 1) return commands[0]
  return { type: 'batch', payload: { commands } }
}

/** Unique values in first-seen order. */
export function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)]
}

/** Applies a patch: `undefined` deletes the key, anything else sets it. */
export function assignPatch(target: object, patch: object): void {
  const t = target as Record<string, unknown>
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete t[key]
    else t[key] = copy(value)
  }
}

/** The current values of the keys a patch touches (`undefined` where a key is absent). */
export function prevValues<P extends object>(source: object, patch: P): P {
  const s = source as Record<string, unknown>
  return Object.fromEntries(Object.keys(patch).map((key) => [key, s[key]])) as P
}

/**
 * A deep copy of a payload value before it goes into a draft. Immer only tracks objects
 * that came from the base state, so inserting a payload object by reference would let a
 * later command in the same batch mutate the payload (and corrupt the undo history).
 */
export function copy<T>(value: T): T {
  return structuredClone(value)
}

/** True when two points (or sizes) are the same; used to keep no-op moves out of history. */
export function samePair(a: object | undefined, b: object | undefined): boolean {
  if (!a || !b) return a === b
  const x = a as Record<string, unknown>
  const y = b as Record<string, unknown>
  const keys = Object.keys(x)
  return keys.length === Object.keys(y).length && keys.every((k) => x[k] === y[k])
}
