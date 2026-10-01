import { describe, expect, it, vi } from 'vitest'
import { cleanSummary, createSummarizer, SUMMARY_INPUT_CHARS, type ChatClient } from './summarize'

function fakeClient(reply: () => Promise<string | null>): {
  client: ChatClient
  create: ReturnType<typeof vi.fn>
} {
  const create = vi.fn(async () => ({ choices: [{ message: { content: await reply() } }] }))
  return { client: { chat: { completions: { create } } } as unknown as ChatClient, create }
}

describe('summarize (Groq, mocked)', () => {
  it('returns the first line of the reply, trimmed', async () => {
    const { client, create } = fakeClient(async () => '  Green bonds fund sea walls.\nExtra line')
    const summarize = createSummarizer(
      () => client,
      () => 'test-model'
    )
    expect(await summarize('Page text')).toBe('Green bonds fund sea walls.')
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'test-model', max_tokens: 60 }),
      { timeout: 8000 }
    )
  })

  it('sends at most 3000 characters of text', async () => {
    const { client, create } = fakeClient(async () => 'ok')
    await createSummarizer(() => client)('x'.repeat(10_000))
    const body = create.mock.calls[0][0] as { messages: { content: string }[] }
    expect(body.messages[1].content).toHaveLength(SUMMARY_INPUT_CHARS)
  })

  it.each([
    ['an error', () => Promise.reject(new Error('rate limited'))],
    [
      'a timeout',
      () =>
        Promise.reject(
          Object.assign(new Error('Request timed out'), { name: 'APIConnectionTimeoutError' })
        )
    ],
    ['an empty reply', () => Promise.resolve(null)]
  ])('returns "" on %s', async (_, reply) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { client } = fakeClient(reply)
    expect(await createSummarizer(() => client)('Page text')).toBe('')
  })

  it('returns "" without a key (no client) or without text, and never calls out', async () => {
    const { client, create } = fakeClient(async () => 'unused')
    expect(await createSummarizer(() => null)('Page text')).toBe('')
    expect(await createSummarizer(() => client)('   ')).toBe('')
    expect(await createSummarizer(() => client)(42)).toBe('')
    expect(create).not.toHaveBeenCalled()
  })

  it('uses Qwen 3.8 27B by default, with reasoning turned off', async () => {
    vi.stubEnv('GROQ_MODEL', '')
    const { client, create } = fakeClient(async () => 'ok')
    await createSummarizer(() => client)('Page text')
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'qwen/qwen3.8-27b', reasoning_effort: 'none' }),
      expect.anything()
    )
    vi.unstubAllEnvs()
  })

  it('drops <think> reasoning if a model returns it anyway', () => {
    expect(
      cleanSummary('<think>The user wants…\nLet me see.</think>\nGreen bonds pay for sea walls.')
    ).toBe('Green bonds pay for sea walls.')
    expect(cleanSummary('<think>never closed')).toBe('')
  })

  it('cleanSummary strips quotes and caps the length', () => {
    expect(cleanSummary('"Quoted summary."')).toBe('Quoted summary.')
    expect(cleanSummary('“Curly”')).toBe('Curly')
    expect(cleanSummary('a'.repeat(500))).toHaveLength(240)
    expect(cleanSummary(undefined)).toBe('')
  })
})
