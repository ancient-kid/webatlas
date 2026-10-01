import type { ReactElement } from 'react'
import { Toaster } from './components/ui/sonner'
import { Gallery } from './features/dev/Gallery'
import { Home } from './features/home/Home'
import { WorkspaceScreen } from './features/workspace/WorkspaceScreen'
import { useAppStore } from './store/appStore'

/** The dev component gallery is reached with ?gallery (View → Component gallery). */
const showGallery = (): boolean => new URLSearchParams(window.location.search).has('gallery')

function App(): ReactElement {
  const screen = useAppStore((s) => s.screen)
  return (
    <>
      {showGallery() ? <Gallery /> : screen === 'workspace' ? <WorkspaceScreen /> : <Home />}
      <Toaster />
    </>
  )
}

export default App
