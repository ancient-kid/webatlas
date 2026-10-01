import type { ReactElement } from 'react'
import { Toaster } from './components/ui/sonner'
import { Gallery } from './features/dev/Gallery'

/** The dev component gallery is reached with ?gallery (View → Component gallery). */
const showGallery = (): boolean => new URLSearchParams(window.location.search).has('gallery')

// Placeholder home until T08 builds the real one.
function Placeholder(): ReactElement {
  return (
    <main
      data-testid="app-root"
      className="flex min-h-full flex-col items-center justify-center gap-2 bg-canvas text-ink"
    >
      <h1 className="wa-display-xl">WebAtlas</h1>
      <p className="m-0 text-ink-muted">Your browsing, drawn as a map.</p>
    </main>
  )
}

function App(): ReactElement {
  return (
    <>
      {showGallery() ? <Gallery /> : <Placeholder />}
      <Toaster />
    </>
  )
}

export default App
