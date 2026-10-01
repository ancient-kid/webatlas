import { defineConfig } from '@playwright/test'

export const FIXTURE_PORT = Number(process.env.WA_FIXTURE_PORT ?? 4599)
export const FIXTURE_ORIGIN = `http://127.0.0.1:${FIXTURE_PORT}`

// E2E tests drive the built Electron app (`npm run test:e2e` builds first).
// One worker: each test launches its own Electron instance with isolated app data.
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  outputDir: 'e2e/test-results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: FIXTURE_ORIGIN,
    trace: 'retain-on-failure'
  },
  webServer: {
    command: `node e2e/fixtures/server.mjs ${FIXTURE_PORT}`,
    url: `${FIXTURE_ORIGIN}/article.html`,
    reuseExistingServer: true,
    timeout: 15_000
  }
})
