import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installCloseHandshake } from './lib/closeHandshake'
import { installDebugHooks } from './lib/debugHooks'

// Nothing to flush yet; T08's autosave passes its flush() here.
installCloseHandshake(async () => {})
installDebugHooks()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
