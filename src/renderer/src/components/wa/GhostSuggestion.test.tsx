// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GhostSuggestion } from './GhostSuggestion'

const props = {
  kind: 'cluster' as const,
  title: 'Group 3 pages as “Case studies”',
  reason: 'Shared topic: Rotterdam, Jakarta.',
  confidence: 0.82
}

describe('GhostSuggestion', () => {
  it('shows the kind, title, reason and "NN% match"', () => {
    render(<GhostSuggestion {...props} />)
    expect(screen.getByRole('group', { name: `Suggestion: ${props.title}` })).toBeInTheDocument()
    expect(screen.getByText('Suggested group')).toBeInTheDocument()
    expect(screen.getByText(props.reason)).toBeInTheDocument()
    expect(screen.getByText('82% match')).toBeInTheDocument()
  })

  it.each([
    ['edge', 'Suggested link'],
    ['tag', 'Suggested tag']
  ] as const)('kind %s reads "%s"', (kind, word) => {
    render(<GhostSuggestion {...props} kind={kind} />)
    expect(screen.getByText(word)).toBeInTheDocument()
  })

  it('Accept and Reject call their handlers', async () => {
    const onAccept = vi.fn()
    const onReject = vi.fn()
    render(<GhostSuggestion {...props} onAccept={onAccept} onReject={onReject} />)
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(onAccept).toHaveBeenCalledTimes(1)
    expect(onReject).toHaveBeenCalledTimes(1)
  })

  it('reports hovering (to highlight the ghost on the canvas)', async () => {
    const onHoverChange = vi.fn()
    render(<GhostSuggestion {...props} onHoverChange={onHoverChange} />)
    await userEvent.hover(screen.getByRole('group'))
    await userEvent.unhover(screen.getByRole('group'))
    expect(onHoverChange.mock.calls).toEqual([[true], [false]])
  })

  it('renders nothing below 40% confidence', () => {
    const { container } = render(<GhostSuggestion {...props} confidence={0.39} />)
    expect(container).toBeEmptyDOMElement()
  })
})
