// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceSummary } from '@shared/types'
import { installApiStub, type ApiStub } from '@renderer/test/apiStub'
import { Home } from './Home'
import { NewWorkspaceDialog } from './NewWorkspaceDialog'

let stub: ApiStub
beforeEach(() => {
  stub = installApiStub()
})

const row = (id: string, name: string, updatedAt: number): WorkspaceSummary => ({
  id,
  name,
  updatedAt,
  nodeCount: 3,
  groupCount: 1
})

describe('Welcome (no workspaces yet)', () => {
  it('shows the exact first-run copy and both buttons', async () => {
    render(<Home />)
    expect(await screen.findByRole('heading', { name: 'WebAtlas' })).toHaveClass('wa-display-xl')
    expect(screen.getByText('Your browsing, drawn as a map.')).toBeInTheDocument()
    expect(screen.getByText('Everything stays on your device.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create workspace' })).toHaveClass('wa-btn--primary')
    expect(screen.getByRole('button', { name: 'Open sample workspace' })).toBeInTheDocument()
  })

  it('Create workspace opens the dialog', async () => {
    render(<Home />)
    await userEvent.click(await screen.findByRole('button', { name: 'Create workspace' }))
    expect(screen.getByRole('dialog', { name: 'New workspace' })).toBeInTheDocument()
  })
})

describe('Home (workspaces exist)', () => {
  beforeEach(() => {
    vi.mocked(stub.api.workspace.list).mockResolvedValue([
      row('a', 'Older', 1000),
      row('b', 'Newest', 3000),
      row('c', 'Middle', 2000)
    ])
  })

  it('lists workspaces newest first', async () => {
    render(<Home />)
    await screen.findByRole('heading', { name: 'Your workspaces' })
    const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(names).toEqual(['Newest', 'Middle', 'Older'])
  })

  it('Delete asks first; Cancel keeps the workspace, Delete removes it', async () => {
    render(<Home />)
    const menu = await screen.findByRole('button', { name: 'Options for Middle' })

    await userEvent.click(menu)
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete workspace' })
    expect(dialog).toHaveTextContent("Delete ‘Middle’? This can't be undone.")
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(stub.api.workspace.delete).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Options for Middle' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Delete workspace' })).getByRole('button', {
        name: 'Delete'
      })
    )
    await waitFor(() => expect(stub.api.workspace.delete).toHaveBeenCalledWith('c'))
  })

  it('Duplicate calls the API and refreshes the list', async () => {
    render(<Home />)
    await userEvent.click(await screen.findByRole('button', { name: 'Options for Older' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Duplicate' }))
    await waitFor(() => expect(stub.api.workspace.duplicate).toHaveBeenCalledWith('a'))
    expect(stub.api.workspace.list).toHaveBeenCalledTimes(2)
  })
})

describe('NewWorkspaceDialog', () => {
  it('Create is disabled until there is a name; submit trims name and question', async () => {
    const onCreate = vi.fn(async () => undefined)
    render(<NewWorkspaceDialog open onOpenChange={() => {}} onCreate={onCreate} />)
    const create = screen.getByRole('button', { name: 'Create' })
    expect(create).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), '   ')
    expect(create).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Flood finance  ')
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Research question (optional)' }),
      '  How do cities pay?  '
    )
    await userEvent.click(create)
    expect(onCreate).toHaveBeenCalledWith({
      name: 'Flood finance',
      researchQuestion: 'How do cities pay?'
    })
  })

  it('leaves the question out when it is empty', async () => {
    const onCreate = vi.fn(async () => undefined)
    render(<NewWorkspaceDialog open onOpenChange={() => {}} onCreate={onCreate} />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Solo{Enter}')
    expect(onCreate).toHaveBeenCalledWith({ name: 'Solo' })
  })
})
