// The workspace: a top bar across the window, then the browser | canvas split.
// The browser pane can be hidden and shown (top-bar button, Ctrl+B, or its own
// collapse button); its open state and width are saved in the session.
import { useEffect, useRef, type ReactElement } from 'react'
import { toast } from 'sonner'
import { Button } from '@renderer/components/wa/Button'
import { CanvasSurface } from '@renderer/components/wa/CanvasSurface'
import { Icon } from '@renderer/components/wa/Icon'
import { QuestionCardView } from '@renderer/components/wa/QuestionCardView'
import { ViewSwitcher } from '@renderer/components/wa/ViewSwitcher'
import { Tip } from '@renderer/components/ui/tooltip'
import { errorMessage } from '@renderer/lib/errors'
import { useAppStore } from '@renderer/store/appStore'
import { useBoardStore } from '@renderer/store/boardStore'
import { closeWorkspace } from '@renderer/store/workspaceActions'
import { BrowserPane } from '../browser/BrowserPane'
import { SplitLayout } from './SplitLayout'

/** A menu Ctrl+B arriving this soon after a handled key press is the same press. */
const DUPLICATE_TOGGLE_MS = 250

export function WorkspaceScreen(): ReactElement {
  const workspace = useAppStore((s) => s.workspace)
  const session = useAppStore((s) => s.session)
  const patchSession = useAppStore((s) => s.patchSession)
  const canUndo = useBoardStore((s) => s.past.length > 0)
  const canRedo = useBoardStore((s) => s.future.length > 0)
  const question = useBoardStore(
    (s) => Object.values(s.board.nodes).find((n) => n.kind === 'question')?.title ?? ''
  )
  const lastToggle = useRef(0)

  const toggleBrowser = (): void => {
    lastToggle.current = Date.now()
    const { browserOpen } = useAppStore.getState().session
    patchSession({ browserOpen: !browserOpen })
  }
  const toggleRef = useRef(toggleBrowser)
  useEffect(() => {
    toggleRef.current = toggleBrowser
  })

  // Ctrl+B: handled here while focus is in the app; the menu accelerator covers focus
  // inside the web page (the page never passes the key to us).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleRef.current()
      }
    }
    const offMenu = window.api.on('menu:action', (action) => {
      if (action !== 'toggle-browser') return
      if (Date.now() - lastToggle.current < DUPLICATE_TOGGLE_MS) return
      toggleRef.current()
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
        <ViewSwitcher
          value={session.viewMode}
          onChange={(viewMode) => patchSession({ viewMode })}
        />
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
          // Placeholder until the React Flow canvas arrives in T09.
          <CanvasSurface height="100%">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <QuestionCardView question={question} />
            </div>
          </CanvasSurface>
        }
      />
    </div>
  )
}
