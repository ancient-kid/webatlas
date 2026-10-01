import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBoard, makeNode, makeQuestion } from '@shared/testing/factories'
import type { Workspace } from '@shared/types'
import { createAppStore } from './appStore'
import { createBoardStore } from './boardStore'
import { assembleWorkspace, createAutosave, type Autosave } from './persistence'

const meta = { version: 1 as const, id: 'ws-1', name: 'Flood finance', createdAt: 1, updatedAt: 1 }

let board: ReturnType<typeof createBoardStore>
let app: ReturnType<typeof createAppStore>
let save: ReturnType<typeof vi.fn<(ws: Workspace) => Promise<void>>>
let autosave: Autosave

/** What openWorkspace does: swap in the workspace with autosave paused. */
function open(): void {
  autosave.pause()
  board
    .getState()
    .load(makeBoard({ nodes: [makeQuestion({ title: 'Why?' }), makeNode({ id: 'n1' })] }))
  app.getState().showWorkspace(meta, app.getState().session)
  autosave.resume()
}

const move = (x: number): void => {
  board
    .getState()
    .dispatch({ type: 'moveItems', payload: { moves: [{ id: 'n1', to: { x, y: 0 } }] } })
}

beforeEach(() => {
  vi.useFakeTimers()
  board = createBoardStore()
  app = createAppStore()
  save = vi.fn(async () => undefined)
  autosave = createAutosave({ board, app, save, delayMs: 500 })
  autosave.start()
  open()
})
afterEach(() => {
  autosave.stop()
  vi.useRealTimers()
})

describe('autosave', () => {
  it('opening a workspace does not save it', async () => {
    await vi.advanceTimersByTimeAsync(2000)
    expect(save).not.toHaveBeenCalled()
  })

  it('5 changes within 500 ms → 1 save, 500 ms after the last change', async () => {
    for (let i = 1; i <= 5; i++) {
      move(i * 32)
      await vi.advanceTimersByTimeAsync(100)
    }
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(400)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0][0].board.nodes.n1.position.x).toBe(160)
  })

  it('session changes are saved too', async () => {
    app.getState().patchSession({ captureMode: 'auto' })
    await vi.advanceTimersByTimeAsync(500)
    expect(save.mock.calls[0][0].session.captureMode).toBe('auto')
  })

  it('flush() saves immediately and only once', async () => {
    move(32)
    await autosave.flush()
    expect(save).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).toHaveBeenCalledTimes(1)
    await autosave.flush() // nothing new
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('flush() waits for a save already in progress', async () => {
    let finish!: () => void
    save.mockImplementationOnce(() => new Promise<void>((r) => (finish = r)))
    move(32)
    await vi.advanceTimersByTimeAsync(500)
    let flushed = false
    const flushing = autosave.flush().then(() => (flushed = true))
    await vi.advanceTimersByTimeAsync(0)
    expect(flushed).toBe(false)
    finish()
    await flushing
    expect(flushed).toBe(true)
  })

  it('no save after the workspace is closed', async () => {
    move(32)
    await autosave.flush()
    autosave.pause() // what closeWorkspace does after flushing
    app.getState().showHome()
    move(64)
    await vi.advanceTimersByTimeAsync(2000)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('a failed save is retried by the next flush', async () => {
    const onError = vi.fn()
    autosave.stop()
    autosave = createAutosave({ board, app, save, delayMs: 500, onError })
    autosave.start()
    open()
    save.mockRejectedValueOnce(new Error('disk full'))
    move(32)
    await autosave.flush()
    expect(onError).toHaveBeenCalled()
    await autosave.flush()
    expect(save).toHaveBeenCalledTimes(2)
  })
})

describe('assembleWorkspace', () => {
  it('takes the research question from the question card', () => {
    board.getState().patchSilently((d) => {
      const q = Object.values(d.nodes).find((n) => n.kind === 'question')!
      q.title = '  How do cities pay?  '
    })
    expect(assembleWorkspace(board, app)?.researchQuestion).toBe('How do cities pay?')
    board.getState().patchSilently((d) => {
      Object.values(d.nodes).find((n) => n.kind === 'question')!.title = ''
    })
    expect(assembleWorkspace(board, app)).not.toHaveProperty('researchQuestion')
  })

  it('is null with no workspace open', () => {
    app.getState().showHome()
    expect(assembleWorkspace(board, app)).toBeNull()
  })
})

describe('appStore.patchSession', () => {
  it('clamps the split ratio and ignores unchanged values', () => {
    const before = app.getState().session
    app.getState().patchSession({ captureMode: before.captureMode })
    expect(app.getState().session).toBe(before)
    app.getState().patchSession({ splitRatio: 95 })
    expect(app.getState().session.splitRatio).toBe(80)
    app.getState().patchSession({ splitRatio: 3 })
    expect(app.getState().session.splitRatio).toBe(20)
  })
})
