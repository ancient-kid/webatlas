import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Unit tests run in node by default. Component tests opt into jsdom with a
// `// @vitest-environment jsdom` docblock on the first line of the file.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    setupFiles: ['src/renderer/src/test/setup.ts'],
    restoreMocks: true
  }
})
