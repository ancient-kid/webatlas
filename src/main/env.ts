// API keys live only in the main process. They are read from a git-ignored .env file in
// the project folder (or the real environment) and never sent to the renderer.
import { config } from 'dotenv'
import { join } from 'node:path'
import type { AiStatus } from '@shared/api'

/** Loads .env once at startup. Tests (WA_E2E) use only the environment they were given. */
export function loadEnv(): void {
  if (process.env.WA_E2E === '1') return
  config({ path: join(process.cwd(), '.env'), quiet: true })
}

export function apiKey(service: keyof AiStatus): string {
  const name = service === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GROQ_API_KEY'
  return process.env[name]?.trim() ?? ''
}

/** Which keys are configured, as booleans only. */
export function aiStatus(): AiStatus {
  return { anthropic: apiKey('anthropic') !== '', groq: apiKey('groq') !== '' }
}
