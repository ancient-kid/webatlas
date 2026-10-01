// Shared Vitest setup. Adds the jest-dom matchers (toBeInTheDocument, …) and
// unmounts rendered components after each test. Safe in the node environment:
// cleanup only runs when a DOM exists.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

afterEach(async () => {
  if (typeof document === 'undefined') return
  const { cleanup } = await import('@testing-library/react')
  cleanup()
})
