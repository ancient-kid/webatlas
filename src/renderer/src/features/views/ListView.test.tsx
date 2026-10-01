// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Board } from '@shared/types'
import { defaultSession } from '@shared/session'
import { installApiStub } from '@renderer/test/apiStub'
import { useAppStore } from '@renderer/store/appStore'
import { useBoardStore } from '@renderer/store/boardStore'
import * as canvasControl from '../canvas/canvasControl'
import { ListView } from './ListView'

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

describe('ListView', () => {
  const testBoard: Board = {
    nodes: {
      c1: {
        id: 'c1',
        kind: 'webpage',
        title: 'Funding Models Review',
        url: 'https://nature.com/articles/funding',
        highlights: [
          { id: 'h1', quote: 'Highlight 1', createdAt: Date.now() },
          { id: 'h2', quote: 'Highlight 2', createdAt: Date.now() }
        ],
        note: '',
        comments: [],
        tags: ['finance', 'adaptation'],
        parentGroupId: 'g1',
        position: { x: 0, y: 0 },
        capturedAt: Date.now() - 3600000 // 1h ago
      },
      c2: {
        id: 'c2',
        kind: 'pdf',
        title: 'Standalone Climate Paper',
        url: 'https://ipcc.ch/report.pdf',
        highlights: [],
        note: '',
        comments: [],
        tags: ['climate'],
        position: { x: 100, y: 100 },
        capturedAt: Date.now() - 7200000 // 2h ago
      },
      n1: {
        id: 'n1',
        kind: 'note',
        title: 'Meeting Notes',
        note: 'Check OECD data.',
        highlights: [],
        comments: [],
        tags: ['finance'],
        position: { x: 200, y: 200 },
        capturedAt: Date.now() - 60000 // 1m ago
      },
      q: {
        id: 'q',
        kind: 'question',
        title: 'Main research question',
        highlights: [],
        note: '',
        comments: [],
        tags: [],
        position: { x: 0, y: 0 },
        capturedAt: Date.now()
      }
    },
    groups: {
      g1: {
        id: 'g1',
        label: 'Funding models',
        category: 'topic',
        color: 'teal',
        note: '',
        comments: [],
        position: { x: 0, y: 0 },
        size: { w: 300, h: 200 }
      }
    },
    edges: {},
    ghosts: {}
  }

  beforeEach(() => {
    installApiStub()
    vi.clearAllMocks()
    useBoardStore.setState({
      board: testBoard,
      past: [],
      future: []
    })
    useAppStore.setState({
      workspace: null,
      session: {
        ...defaultSession(),
        viewMode: 'list'
      }
    })
  })

  it('renders group-by-group sections in order, with "Not in a group" last and notes in "Notes"', () => {
    render(<ListView />)

    const overlines = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(overlines).toEqual(['Funding models', 'Not in a group', 'Notes'])
  })

  it('renders columns: type, title, host, tags <= 3, highlight count, time', () => {
    render(<ListView />)

    // Check title and host
    expect(screen.getByText('Funding Models Review')).toBeInTheDocument()
    expect(screen.getByText('nature.com')).toBeInTheDocument()

    // Type badge
    expect(screen.getByText('Web')).toBeInTheDocument()
    expect(screen.getByText('PDF')).toBeInTheDocument()
    expect(screen.getByText('Note')).toBeInTheDocument()

    // Tags
    expect(screen.getAllByText('finance').length).toBeGreaterThan(0)
    expect(screen.getByText('adaptation')).toBeInTheDocument()

    // Highlights count
    expect(screen.getByText('2')).toBeInTheDocument()

    // Time
    expect(screen.getByText('1h ago')).toBeInTheDocument()
  })

  it('group-by-tag puts a card under each of its tags', async () => {
    const user = userEvent.setup()
    render(<ListView />)

    const tagButton = screen.getByRole('button', { name: 'Tag' })
    await user.click(tagButton)

    // c1 has tags: ['finance', 'adaptation']
    // So 'Funding Models Review' should appear under both #adaptation and #finance sections
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toContain('#adaptation')
    expect(headings).toContain('#finance')
    expect(headings).toContain('#climate')

    const rowsWithC1 = screen.getAllByText('Funding Models Review')
    expect(rowsWithC1.length).toBe(2)
  })

  it('a row click calls jumpTo', async () => {
    const user = userEvent.setup()
    render(<ListView />)

    const row = screen.getByTestId('list-row-c1')
    await user.click(row)

    expect(canvasControl.jumpTo).toHaveBeenCalledWith('c1')
  })
})
