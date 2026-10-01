import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts are bundled (not Google Fonts) so the app works offline and under the CSP.
import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
// Tailwind (layered) first; the unlayered design-system styles then always win over it.
import './styles/globals.css'
import './styles/tokens.css'
import './styles/wa.css'
import './styles/wa-app.css'
import App from './App'
import { installCloseHandshake } from './lib/closeHandshake'
import { installDebugHooks } from './lib/debugHooks'
import { followSystemTheme } from './lib/theme'

followSystemTheme()
// Nothing to flush yet; T08's autosave passes its flush() here.
installCloseHandshake(async () => {})
installDebugHooks()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
