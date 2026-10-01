// Wires the Organize agent to the real app: API keys from env, the SDK clients, the
// workspace embedding cache, and the scripted mock in test runs.
import Anthropic from '@anthropic-ai/sdk'
import Groq from 'groq-sdk'
import { randomUUID } from 'node:crypto'
import { apiKey } from '../env'
import { embedder, isAiMock } from './embed'
import { createMockAnthropic } from './mockClient'
import {
  createOrganizer,
  DEFAULT_GROQ_ORGANIZE_MODEL,
  REQUEST_TIMEOUT_MS,
  type AnthropicClient,
  type GroqClient,
  type Organizer
} from './organize'

let organizer: Organizer | null = null

export function appOrganizer(): Organizer {
  if (organizer) return organizer
  const mock = isAiMock()
  organizer = createOrganizer({
    embed: (ws, items) => embedder().embed(ws, items),
    embedText: (text) => embedder().embedText(text),
    // Test runs: Haiku is the scripted mock and there is no Groq.
    keys: () =>
      mock
        ? { anthropic: 'mock', groq: '' }
        : { anthropic: apiKey('anthropic'), groq: apiKey('groq') },
    anthropic: (key): AnthropicClient =>
      mock
        ? createMockAnthropic()
        : new Anthropic({ apiKey: key, maxRetries: 1, timeout: REQUEST_TIMEOUT_MS }),
    groq: (key) =>
      new Groq({
        apiKey: key,
        maxRetries: 1,
        timeout: REQUEST_TIMEOUT_MS
      }) as unknown as GroqClient,
    groqModel: () => process.env.GROQ_ORGANIZE_MODEL?.trim() || DEFAULT_GROQ_ORGANIZE_MODEL,
    newId: randomUUID,
    now: Date.now,
    // Counts and timings only: never page text or keys.
    log: (line) => console.info('[organize]', JSON.stringify(line))
  })
  return organizer
}
