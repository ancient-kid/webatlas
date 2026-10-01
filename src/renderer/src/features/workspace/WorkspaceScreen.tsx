// The workspace: a top bar across the window, then the browser | canvas split.
// The browser pane can be hidden and shown (top-bar button, Ctrl+B, or its own
// collapse button); its open state and width are saved in the session.
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { toast } from 'sonner'
import { Button } from '@renderer/components/wa/Button'
import { Icon } from '@renderer/components/wa/Icon'
import { ViewSwitcher } from '@renderer/components/wa/ViewSwitcher'
import { Tip } from '@renderer/components/ui/tooltip'
import { errorMessage } from '@renderer/lib/errors'
import { useAppStore } from '@renderer/store/appStore'
import { useBoardStore } from '@renderer/store/boardStore'
import { closeWorkspace } from '@renderer/store/workspaceActions'
import { BrowserPane } from '../browser/BrowserPane'
import { useCaptureCommands } from '../capture/useCaptureCommands'
import { CanvasView } from '../canvas/CanvasView'
import { ExportMenu } from '../export/ExportMenu'
import { Inspector } from '../inspector/Inspector'
import { HintOverlay } from '../onboarding/HintOverlay'
import { CommandPalette } from '../search/CommandPalette'
import { ListView } from '../views/ListView'
import { SplitLayout } from './SplitLayout'

/** A menu Ctrl+B arriving this soon after a handled key press is the same press. */
const DUPLICATE_TOGGLE_MS = 250

export function WorkspaceScreen(): ReactElement {
  const workspace = useAppStore((s) => s.workspace)
  const session = useAppStore((s) => s.session)
  const patchSession = useAppStore((s) => s.patchSession)
  const canUndo = useBoardStore((s) => s.past.length > 0)
  const canRedo = useBoardStore((s) => s.future.length > 0)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const lastToggle = useRef(0)
  useCaptureCommands()

  const toggleBrowser = (): void => {
    lastToggle.current = Date.now()
    const { browserOpen } = useAppStore.getState().session
    patchSession({ browserOpen: !browserOpen })
  }
  const toggleRef = useRef(toggleBrowser)
  useEffect(() => {
    toggleRef.current = toggleBrowser
  })

  // Ctrl+B: browser toggle; Ctrl+K: command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        if (e.key.toLowerCase() === 'b') {
          e.preventDefault()
          toggleRef.current()
        } else if (e.key.toLowerCase() === 'k') {
          e.preventDefault()
          setPaletteOpen((prev) => !prev)
        }
      }
    }
    const offMenu = window.api.on('menu:action', (action) => {
      if (action === 'toggle-browser') {
        if (Date.now() - lastToggle.current < DUPLICATE_TOGGLE_MS) return
        toggleRef.current()
      } else if (action === 'palette') {
        setPaletteOpen(true)
      }
    })
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      offMenu()
    }
  }, [])

  const goHome = (): void => {
    closeWorkspace().catch((err) => toast(`Couldn't save your changes: ${errorMessage(err)}`))
  }

  const open = session.browserOpen
  const toggleLabel = open ? 'Hide browser' : 'Show browser'

  return (
    <div className="flex h-full flex-col" data-testid="workspace-screen">
      <header className="wa wa-topbar">
        <Tip label="Back to your workspaces" side="bottom">
          <Button variant="ghost" icon="back" onClick={goHome} aria-label="Back to home">
            Home
          </Button>
        </Tip>
        <h1 className="wa-topbar__name" data-testid="workspace-name">
          {workspace?.name}
        </h1>
        <div className="flex-1" />
        <Tip label={`${toggleLabel} (Ctrl+B)`} side="bottom">
          <Button
            variant="ghost"
            icon={open ? 'panel-close' : 'panel-open'}
            aria-pressed={open}
            aria-label={toggleLabel}
            onClick={toggleBrowser}
          >
            {toggleLabel}
          </Button>
        </Tip>
        <Tip label="Search (Ctrl+K)" side="bottom">
          <Button
            variant="ghost"
            icon="search"
            aria-label="Search workspace"
            onClick={() => setPaletteOpen(true)}
          >
            Search
          </Button>
        </Tip>
        <ViewSwitcher
          value={session.viewMode}
          onChange={(viewMode) => patchSession({ viewMode })}
        />
        <ExportMenu />
        <Tip label="Undo (Ctrl+Z)" side="bottom">
          <button
            type="button"
            className="wa-tb"
            aria-label="Undo"
            disabled={!canUndo}
            onClick={() => useBoardStore.getState().undo()}
          >
            <Icon name="undo" />
          </button>
        </Tip>
        <Tip label="Redo (Ctrl+Shift+Z)" side="bottom">
          <button
            type="button"
            className="wa-tb"
            aria-label="Redo"
            disabled={!canRedo}
            onClick={() => useBoardStore.getState().redo()}
          >
            <Icon name="redo" />
          </button>
        </Tip>
      </header>
      <SplitLayout
        open={open}
        ratio={session.splitRatio}
        onRatioChange={(splitRatio) => patchSession({ splitRatio })}
        left={<BrowserPane onCollapse={toggleBrowser} />}
        right={
          <div className="flex h-full w-full overflow-hidden relative">
            <div className="flex-1 h-full min-w-0 relative">
              {session.viewMode === 'list' ? <ListView /> : <CanvasView />}
              <HintOverlay />
            </div>
            <Inspector />
          </div>
        }
      />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}
