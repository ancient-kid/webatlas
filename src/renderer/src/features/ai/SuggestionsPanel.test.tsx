// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { makeBoard, makeGhost, makeNode } from '@shared/testing/factories'
import type { Ghost } from '@shared/types'
import { installApiStub } from '@renderer/test/apiStub'
import { useAppStore } from '@renderer/store/appStore'
import { useBoardStore } from '@renderer/store/boardStore'
import { EMPTY_SUGGESTIONS, SuggestionsPanel } from './SuggestionsPanel'

const groupGhost = makeGhost({
  id: 'gG',
  kind: 'group',
  title: 'Group 2 pages as “Bonds”',
  rationale: 'Both explain green bonds.',
  confidence: 0.82,
  command: {
    type: 'createGroup',
    payload: {
      group: { id: 'new-g', label: 'Bonds', color: 'teal', category: 'topic' },
      memberIds: ['a', 'b']
    }
  }
})
const edgeGhost = makeGhost({
  id: 'gE',
  kind: 'edge',
  title: 'Page a → supports → Page b',
  rationale: 'A backs the claim in B.',
  confidence: 0.64,
  command: {
    type: 'connect',
    payload: { edge: { id: 'e-ai', source: 'a', target: 'b', relation: 'supports', origin: 'ai' } }
  }
})
const tagGhost = makeGhost({
  id: 'gT',
  kind: 'tag',
  title: 'Tag “Page a” as #finance',
  rationale: 'About money.',
  confidence: 0.5,
  command: { type: 'addTags', payload: { nodeIds: ['a'], tag: 'finance' } }
})
const lowGhost = makeGhost({ ...tagGhost, id: 'low', title: 'Low one', confidence: 0.3 })

const b = (): ReturnType<typeof useBoardStore.getState>['board'] => useBoardStore.getState().board

function load(ghosts: Ghost[] = [edgeGhost, groupGhost, tagGhost, lowGhost]): void {
  useBoardStore.getState().load(
    makeBoard({
      nodes: [
        makeNode({ id: 'a', position: { x: 0, y: 0 } }),
        makeNode({ id: 'b', position: { x: 400, y: 0 } })
      ],
      ghosts
    })
  )
}

beforeEach(() => {
  installApiStub()
  load()
  useAppStore.setState({ sideTab: 'suggestions', hoveredGhostId: null, organizing: false })
})

const cards = (): HTMLElement[] => screen.getAllByRole('group', { name: /^Suggestion:/ })

describe('SuggestionsPanel', () => {
  it('lists suggestions with kind, title, reason and match, groups first, none below 40%', () => {
    render(<SuggestionsPanel />)
    expect(cards()).toHaveLength(3)
    const [first, second, third] = cards()
    expect(within(first).getByText('Suggested group')).toBeInTheDocument()
    expect(within(first).getByText('Group 2 pages as “Bonds”')).toBeInTheDocument()
    expect(within(first).getByText('Both explain green bonds.')).toBeInTheDocument()
    expect(within(first).getByText('82% match')).toBeInTheDocument()
    expect(within(second).getByText('Suggested link')).toBeInTheDocument()
    expect(within(second).getByText('64% match')).toBeInTheDocument()
    expect(within(third).getByText('Suggested tag')).toBeInTheDocument()
    expect(screen.queryByText('Low one')).toBeNull()
    expect(screen.getByRole('tab', { name: 'Suggestions (3)' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })

  it('Accept applies one suggestion as one undo step', async () => {
    render(<SuggestionsPanel />)
    await userEvent.click(within(cards()[1]).getByRole('button', { name: 'Accept' }))
    expect(b().edges['e-ai']).toMatchObject({ relation: 'supports', origin: 'ai' })
    expect(b().ghosts.gE).toBeUndefined()
    expect(cards()).toHaveLength(2)
    act(() => {
      useBoardStore.getState().undo()
    })
    expect(b().edges['e-ai']).toBeUndefined()
    expect(cards()).toHaveLength(3)
  })

  it('Reject removes a suggestion; undo brings it back', async () => {
    render(<SuggestionsPanel />)
    await userEvent.click(within(cards()[0]).getByRole('button', { name: 'Reject' }))
    expect(b().ghosts.gG).toBeUndefined()
    expect(b().groups['new-g']).toBeUndefined()
    act(() => {
      useBoardStore.getState().undo()
    })
    expect(b().ghosts.gG).toBeDefined()
  })

  it('Accept all applies each suggestion as its own undo step', async () => {
    render(<SuggestionsPanel />)
    await userEvent.click(screen.getByRole('button', { name: 'Accept all' }))
    expect(b().groups['new-g']).toBeDefined()
    expect(b().edges['e-ai']).toBeDefined()
    expect(b().nodes.a.tags).toContain('finance')
    expect(screen.getByTestId('suggestions-empty')).toHaveTextContent(EMPTY_SUGGESTIONS)
    expect(useBoardStore.getState().past.length).toBeGreaterThanOrEqual(3)
  })

  it('Reject all clears every suggestion in one undo step', async () => {
    render(<SuggestionsPanel />)
    await userEvent.click(screen.getByRole('button', { name: 'Reject all' }))
    expect(b().ghosts).toEqual({})
    expect(useBoardStore.getState().past).toHaveLength(1)
  })

  it('shows the empty state without suggestions, and a busy line while organizing', () => {
    load([])
    render(<SuggestionsPanel />)
    expect(screen.getByTestId('suggestions-empty')).toHaveTextContent(
      'No suggestions yet. Capture a few pages, then press Organize.'
    )
    expect(screen.queryByRole('button', { name: 'Accept all' })).toBeNull()
    act(() => useAppStore.getState().setOrganizing(true))
    expect(screen.getByTestId('suggestions-empty')).toHaveTextContent('Organizing your pages…')
  })

  it('hovering a suggestion marks it as the hovered ghost', async () => {
    render(<SuggestionsPanel />)
    await userEvent.hover(cards()[0])
    expect(useAppStore.getState().hoveredGhostId).toBe('gG')
    expect(cards()[0]).toHaveClass('wa-ghost--hovered')
    await userEvent.unhover(cards()[0])
    expect(useAppStore.getState().hoveredGhostId).toBeNull()
  })

  it('the close button and the Details tab leave the Suggestions tab', async () => {
    render(<SuggestionsPanel />)
    // Details is disabled while nothing is selected.
    expect(screen.getByRole('tab', { name: 'Details' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Close suggestions' }))
    expect(useAppStore.getState().sideTab).toBe('details')
  })
})
