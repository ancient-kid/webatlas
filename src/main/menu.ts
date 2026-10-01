// The application menu. Its accelerators work even while focus is inside the embedded
// web page (the renderer never sees those key presses), so app-wide shortcuts live here
// and reach the renderer as 'menu:action' events. T12 adds capture, highlight and search.
import { Menu, type MenuItemConstructorOptions } from 'electron'
import type { MenuAction } from '@shared/api'

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
    { label: 'View', submenu: view },
    { role: 'windowMenu' }
  ])
}
