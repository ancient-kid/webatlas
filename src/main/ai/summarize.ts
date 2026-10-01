// One-line page summaries from Groq. Best effort: any failure, timeout or missing key
// gives '' and the card simply has no summary.
import Groq from 'groq-sdk'
import { apiKey } from '../env'

export const SUMMARY_TIMEOUT_MS = 8000
export const SUMMARY_INPUT_CHARS = 3000
export const MOCK_SUMMARY = 'A one-line summary from the test model.'
/** Groq retired its Llama models; Qwen 3.8 27B is the default (override with GROQ_MODEL). */
export const DEFAULT_GROQ_MODEL = 'qwen/qwen3.8-27b'

const SYSTEM =
  'Summarise the page in one plain sentence of at most 20 words. No preamble, no quotes.'

/** The part of the Groq client this uses (so tests can pass a fake). */
export interface ChatClient {
  chat: {
    completions: {
      create(
        body: {
          model: string
          max_tokens: number
          temperature: number
          reasoning_effort?: 'none' | 'default' | 'low' | 'medium' | 'high'
          messages: { role: 'system' | 'user'; content: string }[]
        },
        options: { timeout: number }
      ): Promise<{ choices: { message?: { content?: string | null } }[] }>
    }
  }
}

/**
 * First non-empty line, without surrounding quotes, capped at 240 characters. Any
 * <think>…</think> reasoning a model returns is dropped first.
 */
export function cleanSummary(raw: string | null | undefined): string {
  const line = (raw ?? '')
    .replace(/<think>[\s\S]*?(<\/think>|$)/gi, '')
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean)
  return (line ?? '')
    .replace(/^["'“‘]+|["'”’]+$/g, '')
    .trim()
    .slice(0, 240)
}

export function createSummarizer(
  getClient: () => ChatClient | null,
  model = (): string => process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL
): (text: unknown) => Promise<string> {
  return async (text) => {
    if (typeof text !== 'string' || !text.trim()) return ''
    const client = getClient()
    if (!client) return ''
    try {
      const res = await client.chat.completions.create(
        {
          model: model(),
          max_tokens: 60,
          temperature: 0.2,
          // Qwen 3 reasons before answering by default; a one-liner doesn't need it, and
          // the thinking would use up the token budget.
          reasoning_effort: 'none',
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: text.slice(0, SUMMARY_INPUT_CHARS) }
          ]
        },
        { timeout: SUMMARY_TIMEOUT_MS }
      )
      return cleanSummary(res.choices[0]?.message?.content)
    } catch (err) {
      console.error('[summarize]', err instanceof Error ? err.message : String(err))
      return ''
    }
  }
}

let client: ChatClient | null = null
let clientKey = ''

/** The real Groq client, created lazily for the current key (null without a key). */
function groqClient(): ChatClient | null {
  const key = apiKey('groq')
  if (!key) return null
  if (!client || clientKey !== key) {
    client = new Groq({ apiKey: key }) as unknown as ChatClient
    clientKey = key
  }
  return client
}

/** Test runs (WA_AI_MOCK=1) never touch the network. */
const mockClient: ChatClient = {
  chat: {
    completions: { create: async () => ({ choices: [{ message: { content: MOCK_SUMMARY } }] }) }
  }
}

export const summarize = createSummarizer(() =>
  process.env.WA_E2E === '1' && process.env.WA_AI_MOCK === '1' ? mockClient : groqClient()
)
