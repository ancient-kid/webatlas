// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Board } from '@shared/types'
import { defaultSession } from '@shared/session'
import { installApiStub } from '@renderer/test/apiStub'
import { useAppStore } from '@renderer/store/appStore'
import { useBoardStore } from '@renderer/store/boardStore'
import * as canvasControl from '../canvas/canvasControl'
import { CommandPalette } from './CommandPalette'
import { clearSearchIndexCache } from './searchIndex'

vi.mock('../canvas/canvasControl', async () => {
  const actual = await vi.importActual<typeof canvasControl>('../canvas/canvasControl')
  return {
    ...actual,
    canvas: vi.fn(() => ({
      select: vi.fn(),
      reveal: vi.fn(),
      zoomTo: vi.fn(),
      centre: vi.fn(() => ({ x: 0, y: 0 }))
    })),
    jumpTo: vi.fn()
  }
})

describe('CommandPalette', () => {
  const initialBoard: Board = {
    nodes: {
      n1: {
        id: 'n1',
        kind: 'webpage',
        title: 'Rotterdam water adaptation',
        url: 'https://example.com/rotterdam',
        highlights: [{ id: 'h1', quote: 'Water squares store stormwater.', createdAt: Date.now() }],
        note: '',
        comments: [],
        tags: ['resilience'],
        position: { x: 0, y: 0 },
        capturedAt: Date.now()
      },
      n2: {
        id: 'n2',
        kind: 'note',
        title: 'Interview notes',
        note: 'Check budget details with manager.',
        highlights: [],
        comments: [],
        tags: ['notes'],
        position: { x: 100, y: 100 },
        capturedAt: Date.now()
      }
    },
    groups: {},
    edges: {},
    ghosts: {}
  }

  beforeEach(() => {
    installApiStub()
    clearSearchIndexCache()
    vi.clearAllMocks()
    useBoardStore.setState({
      board: initialBoard,
      past: [],
      future: []
    })
    useAppStore.setState({
      workspace: null,
      session: defaultSession()
    })
  })

  it('an empty query shows nothing or prompt', () => {
    render(<CommandPalette open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByPlaceholderText('Search workspace...')).toBeInTheDocument()
    // No result items rendered yet
    expect(screen.queryByText('Rotterdam water adaptation')).not.toBeInTheDocument()
  })

  it('typing filters results and allows moving with up/down', async () => {
    const user = userEvent.setup()
    render(<CommandPalette open={true} onOpenChange={vi.fn()} />)

    const input = screen.getByPlaceholderText('Search workspace...')
    await user.type(input, 'rotterdm')

    await waitFor(() => {
      expect(screen.getByText('Rotterdam water adaptation')).toBeInTheDocument()
    })
    expect(screen.queryByText('Interview notes')).not.toBeInTheDocument()

    // Up/down keys move selection
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{ArrowUp}')
  })

  it('Enter calls jumpTo with the id', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<CommandPalette open={true} onOpenChange={onOpenChange} />)

    const input = screen.getByPlaceholderText('Search workspace...')
    await user.type(input, 'Rotterdam')

    await waitFor(() => {
      expect(screen.getByText('Rotterdam water adaptation')).toBeInTheDocument()
    })

    await user.keyboard('{Enter}')

    expect(canvasControl.jumpTo).toHaveBeenCalledWith('n1')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('Escape closes the palette', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<CommandPalette open={true} onOpenChange={onOpenChange} />)

    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
