// Crash-safe file writes: write a temporary file, then rename it over the target, so a
// crash mid-save never leaves a half-written workspace. Writes to the same file are
// queued so two saves never race.
import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'

const RETRY_CODES = new Set(['EPERM', 'EBUSY', 'EACCES'])
const RETRIES = 5
const RETRY_DELAY_MS = 40

const queues = new Map<string, Promise<unknown>>()
let tmpCounter = 0

/**
 * Runs `task` after every earlier task with the same key has finished (success or not).
 * Used for per-file writes and for read-modify-write sequences such as the index.
 */
export function serialize<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve()
  const run = previous.then(task, task)
  const settled = run.catch(() => undefined)
  queues.set(key, settled)
  void settled.then(() => {
    if (queues.get(key) === settled) queues.delete(key)
  })
  return run
}

/** Resolves when every queued write and storage task has finished (used before quitting). */
export async function pendingWrites(): Promise<void> {
  while (queues.size) await Promise.all([...queues.values()])
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Renames, retrying briefly when Windows reports the target as busy (antivirus, indexer). */
export async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.rename(from, to)
      return
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? ''
      if (!RETRY_CODES.has(code) || attempt >= RETRIES) throw err
      await sleep(RETRY_DELAY_MS * (attempt + 1))
    }
  }
}

/** Atomically replaces `file` with `data`, creating its folder if needed. */
export function atomicWrite(file: string, data: string | Uint8Array): Promise<void> {
  return serialize(`file:${file}`, async () => {
    await fs.mkdir(dirname(file), { recursive: true })
    const tmp = `${file}.tmp-${process.pid}-${++tmpCounter}`
    try {
      await fs.writeFile(tmp, data)
      await renameWithRetry(tmp, file)
    } catch (err) {
      await fs.rm(tmp, { force: true }).catch(() => undefined)
      throw err
    }
  })
}
