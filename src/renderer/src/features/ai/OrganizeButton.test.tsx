// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBoard, makeGhost, makeNode, makeWorkspace } from '@shared/testing/factories'
import type { OrganizeResult } from '@shared/types'
import { installApiStub, type ApiStub } from '@renderer/test/apiStub'
import { useAppStore } from '@renderer/store/appStore'
import { useBoardStore } from '@renderer/store/boardStore'
import { OrganizeButton, SuggestionsToggle } from './OrganizeButton'
import { runOrganize } from './runOrganize'

vi.mock('sonner', () => ({ toast: vi.fn() }))

const ghost = makeGhost({
  id: 'g-new',
  command: {
    type: 'connect',
    payload: {
      edge: { id: 'e', source: 'a', target: 'question', relation: 'answers', origin: 'ai' }
    }
  }
})
let stub: ApiStub

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

beforeEach(() => {
  stub = installApiStub()
  vi.mocked(toast).mockClear()
  const ws = makeWorkspace({ id: 'ws-1' })
  useAppStore
    .getState()
    .showWorkspace({ id: ws.id, name: ws.name, version: 1, createdAt: 0, updatedAt: 0 }, ws.session)
  useBoardStore.getState().load(
    makeBoard({
      nodes: [makeNode({ id: 'a' })],
      ghosts: [makeGhost({ id: 'old' })]
    })
  )
})

describe('OrganizeButton', () => {
  it('shows a busy state while running, then shows the suggestions', async () => {
    const pending = deferred<OrganizeResult>()
    vi.mocked(stub.api.ai.organize).mockReturnValue(pending.promise)
    render(<OrganizeButton />)
    const button = screen.getByTestId('organize-button')
    expect(button).toHaveTextContent('Organize')

    await userEvent.click(button)
    expect(button).toHaveTextContent('Organizing…')
    expect(button).toBeDisabled()
    // The board snapshot was sent for this workspace.
    expect(stub.api.ai.organize).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws-1', questionNodeId: 'question' })
    )

    await act(async () => pending.resolve({ ghosts: [ghost], mode: 'haiku' }))
    expect(button).toHaveTextContent('Organize')
    expect(button).not.toBeDisabled()
    // Replaces the pending suggestions, with no undo step.
    expect(Object.keys(useBoardStore.getState().board.ghosts)).toEqual(['g-new'])
    expect(useBoardStore.getState().past).toHaveLength(0)
    expect(useAppStore.getState().sideTab).toBe('suggestions')
    expect(toast).toHaveBeenCalledWith('1 suggestion to review')
  })

  it('shows the fallback message with the count', async () => {
    vi.mocked(stub.api.ai.organize).mockResolvedValue({
      ghosts: [ghost],
      mode: 'groq',
      message: 'Used the backup model.'
    })
    await runOrganize()
    expect(toast).toHaveBeenCalledWith('Used the backup model. 1 suggestion to review.')
  })

  it('shows the message alone when there is nothing to suggest', async () => {
    vi.mocked(stub.api.ai.organize).mockResolvedValue({
      ghosts: [],
      mode: 'offline',
      message: 'Capture a few more pages first.'
    })
    await runOrganize()
    expect(toast).toHaveBeenCalledWith('Capture a few more pages first.')
  })

  it('ignores a second click while running', async () => {
    const pending = deferred<OrganizeResult>()
    vi.mocked(stub.api.ai.organize).mockReturnValue(pending.promise)
    const first = runOrganize()
    expect(await runOrganize()).toBeNull()
    pending.resolve({ ghosts: [], mode: 'haiku' })
    await first
    expect(stub.api.ai.organize).toHaveBeenCalledTimes(1)
  })

  it('drops the result if the student left the workspace meanwhile', async () => {
    const pending = deferred<OrganizeResult>()
    vi.mocked(stub.api.ai.organize).mockReturnValue(pending.promise)
    const run = runOrganize()
    useAppStore.getState().showHome()
    pending.resolve({ ghosts: [ghost], mode: 'haiku' })
    expect(await run).toBeNull()
    expect(useBoardStore.getState().board.ghosts['g-new']).toBeUndefined()
    expect(toast).not.toHaveBeenCalled()
  })

  it('reports an unexpected failure and recovers', async () => {
    vi.mocked(stub.api.ai.organize).mockRejectedValue(new Error('Invalid board snapshot'))
    expect(await runOrganize()).toBeNull()
    expect(toast).toHaveBeenCalledWith(expect.stringContaining("Organize didn't work this time"))
    expect(useAppStore.getState().organizing).toBe(false)
  })
})

describe('SuggestionsToggle', () => {
  it('shows the count and opens and closes the Suggestions tab', async () => {
    render(<SuggestionsToggle />)
    const toggle = screen.getByTestId('suggestions-toggle')
    expect(toggle).toHaveAccessibleName('Suggestions (0)') // the factory ghost targets a missing card
    await userEvent.click(toggle)
    expect(useAppStore.getState().sideTab).toBe('suggestions')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(toggle)
    expect(useAppStore.getState().sideTab).toBe('details')
  })
})
