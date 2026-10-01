// The application menu. Its accelerators work even while focus is inside the embedded
// web page (the renderer never sees those key presses), so app-wide shortcuts live here
// and reach the renderer as 'menu:action' events. T12 adds capture, highlight and search.
import {
  Menu,
  type ContextMenuParams,
  type MenuItemConstructorOptions,
  type WebContents
} from 'electron'
import type { ContextAction, MenuAction } from '@shared/api'

export interface MenuOptions {
  /** Sends a menu action to the app window. */
  send: (action: MenuAction) => void
  /** Development and test runs: adds the component gallery item. */
  devTools: boolean
  toggleGallery: () => void
}

export function buildAppMenu(o: MenuOptions): Menu {
  const view: MenuItemConstructorOptions[] = [
    {
      id: 'toggle-browser',
      label: 'Show or hide browser',
      accelerator: 'CmdOrCtrl+B',
      click: () => o.send('toggle-browser')
    },
    { type: 'separator' },
    { role: 'resetZoom' },
    { role: 'zoomIn' },
    { role: 'zoomOut' },
    { type: 'separator' },
    { role: 'togglefullscreen' }
  ]
  if (o.devTools) {
    view.push(
      { type: 'separator' },
      { role: 'reload' },
      { role: 'toggleDevTools' },
      {
        id: 'dev-gallery',
        label: 'Component gallery',
        accelerator: 'CmdOrCtrl+Shift+G',
        click: o.toggleGallery
      }
    )
  }
  const research: MenuItemConstructorOptions[] = [
    {
      id: 'capture',
      label: 'Add page to canvas',
      accelerator: 'Alt+A',
      click: () => o.send('capture')
    },
    {
      id: 'highlight',
      label: 'Add highlight to canvas',
      accelerator: 'Alt+H',
      click: () => o.send('highlight')
    },
    { type: 'separator' },
    {
      id: 'palette',
      label: 'Search the canvas',
      accelerator: 'CmdOrCtrl+K',
      click: () => o.send('palette')
    },
    {
      id: 'address',
      label: 'Go to address bar',
      accelerator: 'CmdOrCtrl+L',
      click: () => o.send('address')
    }
  ]
  return Menu.buildFromTemplate([
    { label: 'File', submenu: [{ role: 'quit', label: 'Exit' }] },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    { label: 'Research', submenu: research },
    { label: 'View', submenu: view },
    { role: 'windowMenu' }
  ])
}

/**
 * Right-click menu inside the embedded web page: add the selection as a highlight, a
 * link as a card, or the whole page. Selected text comes from Chromium, so it also works
 * in the PDF viewer, where the page's own getSelection() is empty.
 */
export function buildPageContextMenu(
  params: Pick<ContextMenuParams, 'selectionText' | 'linkURL' | 'linkText'>,
  page: Pick<WebContents, 'copy'>,
  send: (action: ContextAction) => void
): Menu {
  const items: MenuItemConstructorOptions[] = []
  const selection = params.selectionText.trim()
  if (selection) {
    items.push({
      id: 'context-highlight',
      label: 'Add highlight to canvas',
      click: () => send({ type: 'highlight', text: selection })
    })
  }
  if (/^https?:\/\//i.test(params.linkURL)) {
    items.push({
      id: 'context-link',
      label: 'Add link to canvas',
      click: () => send({ type: 'link', url: params.linkURL, text: params.linkText || undefined })
    })
  }
  items.push({
    id: 'context-page',
    label: 'Add page to canvas',
    click: () => send({ type: 'page' })
  })
  if (selection) {
    items.push(
      { type: 'separator' },
      { id: 'context-copy', label: 'Copy', click: () => page.copy() }
    )
  }
  return Menu.buildFromTemplate(items)
}
