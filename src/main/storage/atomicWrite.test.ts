import { promises as fs, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { atomicWrite, pendingWrites, serialize } from './atomicWrite'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'wa-atomic-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const errno = (code: string): NodeJS.ErrnoException =>
  Object.assign(new Error(code), { code }) as NodeJS.ErrnoException

describe('atomicWrite', () => {
  it('20 concurrent writes leave the last content and no temporary files', async () => {
    const file = join(dir, 'ws', 'workspace.json')
    await Promise.all(Array.from({ length: 20 }, (_, i) => atomicWrite(file, `version ${i}`)))
    expect(readFileSync(file, 'utf8')).toBe('version 19')
    expect(readdirSync(join(dir, 'ws'))).toEqual(['workspace.json'])
  })

  it('creates missing folders', async () => {
    const file = join(dir, 'a', 'b', 'c.json')
    await atomicWrite(file, '{}')
    expect(readFileSync(file, 'utf8')).toBe('{}')
  })

  it('retries a rename that Windows reports as busy, then succeeds', async () => {
    const real = fs.rename.bind(fs)
    const rename = vi
      .spyOn(fs, 'rename')
      .mockRejectedValueOnce(errno('EPERM'))
      .mockRejectedValueOnce(errno('EBUSY'))
      .mockImplementation(real)
    const file = join(dir, 'x.json')
    await atomicWrite(file, 'ok')
    expect(rename).toHaveBeenCalledTimes(3)
    expect(readFileSync(file, 'utf8')).toBe('ok')
  })

  it('gives up after repeated failures and cleans up the temporary file', async () => {
    vi.spyOn(fs, 'rename').mockRejectedValue(errno('EPERM'))
    const file = join(dir, 'y.json')
    await expect(atomicWrite(file, 'nope')).rejects.toThrow('EPERM')
    expect(readdirSync(dir)).toEqual([])
  })

  it('does not retry other errors', async () => {
    const rename = vi.spyOn(fs, 'rename').mockRejectedValue(errno('ENOSPC'))
    await expect(atomicWrite(join(dir, 'z.json'), 'x')).rejects.toThrow('ENOSPC')
    expect(rename).toHaveBeenCalledTimes(1)
  })
})

describe('serialize', () => {
  it('runs tasks with the same key one after another, even after a failure', async () => {
    const order: string[] = []
    const slow = (name: string, ms: number) => async () => {
      order.push(`start ${name}`)
      await new Promise((r) => setTimeout(r, ms))
      order.push(`end ${name}`)
    }
    const failing = serialize('k', async () => {
      throw new Error('boom')
    })
    await Promise.all([
      failing.catch(() => undefined),
      serialize('k', slow('a', 20)),
      serialize('k', slow('b', 1))
    ])
    expect(order).toEqual(['start a', 'end a', 'start b', 'end b'])
  })

  it('pendingWrites waits for queued work', async () => {
    let done = false
    void serialize('p', async () => {
      await new Promise((r) => setTimeout(r, 20))
      done = true
    })
    await pendingWrites()
    expect(done).toBe(true)
  })
})
