// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { makeWorkspace } from '@shared/testing/factories'
import { installApiStub, type ApiStub } from '@renderer/test/apiStub'
import { useAppStore } from '@renderer/store/appStore'
import { openWorkspace } from '@renderer/store/workspaceActions'
import { WorkspaceScreen } from './WorkspaceScreen'

let stub: ApiStub
beforeEach(() => {
  stub = installApiStub()
  openWorkspace(makeWorkspace({ name: 'Flood finance' }))
})

const session = (): ReturnType<typeof useAppStore.getState>['session'] =>
  useAppStore.getState().session
const panel = (): HTMLElement => screen.getByTestId('browser-panel')

describe('WorkspaceScreen layout', () => {
  it('shows the workspace name and the browser beside the canvas', () => {
    render(<WorkspaceScreen />)
    expect(screen.getByTestId('workspace-name')).toHaveTextContent('Flood finance')
    expect(panel()).toHaveAttribute('aria-hidden', 'false')
    expect(panel().style.width).toBe('42%')
    expect(screen.getByRole('separator')).toBeInTheDocument()
  })

  it('the toggle hides and shows the browser and flips its label and aria-pressed', async () => {
    render(<WorkspaceScreen />)
    await userEvent.click(screen.getByRole('button', { name: 'Hide browser' }))
    expect(session().browserOpen).toBe(false)
    expect(panel()).toHaveAttribute('aria-hidden', 'true')
    expect(panel().style.width).toBe('0px')
    expect(screen.queryByRole('separator')).toBeNull()
    const show = screen.getByRole('button', { name: 'Show browser' })
    expect(show).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(show)
    expect(session().browserOpen).toBe(true)
    expect(screen.getByRole('button', { name: 'Hide browser' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('the webview stays mounted while the browser is hidden', async () => {
    render(<WorkspaceScreen />)
    const webview = screen.getByTestId('browser-webview')
    await userEvent.click(screen.getByRole('button', { name: 'Hide browser' }))
    expect(screen.getByTestId('browser-webview')).toBe(webview)
  })

  it('Ctrl+B toggles the browser', async () => {
    render(<WorkspaceScreen />)
    await userEvent.keyboard('{Control>}b{/Control}')
    expect(session().browserOpen).toBe(false)
    await userEvent.keyboard('{Control>}b{/Control}')
    expect(session().browserOpen).toBe(true)
  })

  it('the menu’s Ctrl+B (focus inside the web page) toggles once', async () => {
    render(<WorkspaceScreen />)
    act(() => stub.emit('menu:action', 'toggle-browser'))
    expect(session().browserOpen).toBe(false)
    // A key press handled here plus the same press arriving from the menu counts once.
    await userEvent.keyboard('{Control>}b{/Control}')
    act(() => stub.emit('menu:action', 'toggle-browser'))
    expect(session().browserOpen).toBe(true)
  })

  it('the collapse button on the pane hides the browser', async () => {
    render(<WorkspaceScreen />)
    await userEvent.click(screen.getByRole('button', { name: 'Hide browser (Ctrl+B)' }))
    expect(session().browserOpen).toBe(false)
  })

  it('resizing writes a clamped splitRatio into the session', () => {
    render(<WorkspaceScreen />)
    const divider = screen.getByRole('separator')
    fireEvent.keyDown(divider, { key: 'ArrowRight' })
    expect(session().splitRatio).toBe(44)
    fireEvent.keyDown(divider, { key: 'ArrowLeft', shiftKey: true })
    expect(session().splitRatio).toBe(34)
    fireEvent.keyDown(divider, { key: 'End' })
    expect(session().splitRatio).toBe(80)
    fireEvent.keyDown(divider, { key: 'ArrowRight' })
    expect(session().splitRatio).toBe(80)
    fireEvent.keyDown(divider, { key: 'Home' })
    expect(session().splitRatio).toBe(20)
    expect(divider).toHaveAttribute('aria-valuenow', '20')
  })

  it('the view switcher writes the view mode into the session', async () => {
    render(<WorkspaceScreen />)
    await userEvent.click(screen.getByRole('button', { name: 'List' }))
    expect(session().viewMode).toBe('list')
  })

  it('Capture mode toggle writes into the session', async () => {
    render(<WorkspaceScreen />)
    await userEvent.click(screen.getByRole('button', { name: 'Auto' }))
    expect(session().captureMode).toBe('auto')
  })

  it('Home saves and returns to the home screen', async () => {
    render(<WorkspaceScreen />)
    await userEvent.click(screen.getByRole('button', { name: 'Back to home' }))
    expect(useAppStore.getState().screen).toBe('home')
  })
})
