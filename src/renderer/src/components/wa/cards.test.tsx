// @vitest-environment jsdom
// NoteCardView, QuestionCardView, GroupFrameView, TagChip and EdgeView.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EdgeView } from './EdgeView'
import { GroupFrameView } from './GroupFrameView'
import { NoteCardView } from './NoteCardView'
import { QuestionCardView } from './QuestionCardView'
import { TagChip } from './TagChip'

describe('NoteCardView', () => {
  it('shows its text and tags', () => {
    const { container } = render(
      <NoteCardView text="Green bonds" tags={[{ label: 'to check', color: 'amber' }, 'idea']} />
    )
    expect(screen.getByText('Green bonds')).toHaveClass('wa-note-text')
    expect(screen.getByText('Note')).toHaveClass('wa-badge')
    expect([...container.querySelectorAll('.wa-tag')].map((t) => t.textContent)).toEqual([
      'to check',
      'idea'
    ])
  })

  it('an empty note shows a hint; the editing body replaces the text', () => {
    render(<NoteCardView text="" />)
    expect(screen.getByText('Double-click to write')).toBeInTheDocument()
    render(<NoteCardView text="Old" body={<textarea aria-label="Edit note" />} />)
    expect(screen.getByRole('textbox', { name: 'Edit note' })).toBeInTheDocument()
    expect(screen.queryByText('Old')).toBeNull()
  })

  it('selected → selected class', () => {
    const { container } = render(<NoteCardView text="x" selected />)
    expect(container.firstChild).toHaveClass('wa-note--selected')
  })
})

describe('QuestionCardView', () => {
  it('shows the question in the serif style and the meta line', () => {
    render(<QuestionCardView question="How do coastal cities fund adaptation?" meta="24 sources" />)
    expect(screen.getByText('How do coastal cities fund adaptation?')).toHaveClass('wa-q__text')
    expect(screen.getByText('24 sources')).toHaveClass('wa-q__meta')
    expect(screen.getByText('Research question')).toBeInTheDocument()
  })

  it('an empty question asks for one', () => {
    render(<QuestionCardView question="" />)
    expect(screen.getByText('Double-click to add your research question')).toBeInTheDocument()
  })
})

describe('GroupFrameView', () => {
  it('shows the label with the category colour variables', () => {
    render(<GroupFrameView label="Funding models" color="rose" />)
    const frame = screen.getByRole('region', { name: 'Funding models' })
    expect(frame).not.toHaveClass('wa-group--ghost')
    expect(frame.style.getPropertyValue('--gc')).toBe('var(--cat-rose)')
    expect(screen.getByText('Funding models')).toHaveClass('wa-group__label')
  })

  it('ghost → "(suggested)" and the dashed class', () => {
    render(<GroupFrameView label="Case studies" ghost />)
    const frame = screen.getByRole('region', { name: 'Case studies (suggested)' })
    expect(frame).toHaveClass('wa-group--ghost')
    expect(frame.querySelector('.wa-group__label')).toHaveTextContent('Case studies (suggested)')
  })
})

describe('TagChip', () => {
  it('coloured → a dot; plain → no dot', () => {
    const { container: coloured } = render(<TagChip label="must-cite" color="rose" />)
    expect(coloured.querySelector('.wa-tag__dot')).not.toBeNull()
    const { container: plain } = render(<TagChip label="methods" />)
    expect(plain.querySelector('.wa-tag__dot')).toBeNull()
    expect(plain).toHaveTextContent('methods')
  })
})

describe('EdgeView', () => {
  it('a ghost edge is dashed with a dashed label; a normal one is solid', () => {
    const { container: ghost } = render(
      <EdgeView id="g" from={[0, 0]} to={[200, 0]} label="answers?" ghost />
    )
    expect(ghost.querySelector('path[stroke-dasharray]')).not.toBeNull()
    expect(screen.getByText('answers?')).toHaveClass('wa-edge__label--ghost')
    const { container: solid } = render(
      <EdgeView id="s" from={[0, 0]} to={[200, 0]} label="supports" />
    )
    expect(solid.querySelector('path[stroke-dasharray]')).toBeNull()
    expect(solid.querySelector('marker#wa-ah-s')).not.toBeNull()
  })
})
