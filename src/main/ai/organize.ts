// The Organize agent. Local embeddings find clusters and candidate pairs; then a Claude
// Haiku agent names clusters and labels relationships by calling the proposeGroup /
// proposeEdge / proposeTag tools. Every valid call becomes a ghost (a suggestion the
// student reviews). Router: Haiku (at most 3 turns) → Groq (same tools) → offline
// clusters from the embeddings alone. Expected failures never throw: the result says
// which mode ran and carries a message for the student.
import type Anthropic from '@anthropic-ai/sdk'
import { parseSnapshot } from '@shared/schema'
import type { BoardSnapshot, Ghost, OrganizeMode, OrganizeResult } from '@shared/types'
import { candidateEdges, clusterNodes, questionLinks, type Cluster, type Vectors } from './cluster'
import { embeddingText } from './embed'
import { buildPrompt, hostOf, MAX_EDGES, MAX_GROUPS, MAX_TAGS, type Analysis } from './prompt'
import {
  ORGANIZE_TOOLS,
  toGroqTools,
  toolCallToGhost,
  type GroqTool,
  type ToolContext,
  type ToolOutcome
} from './tools'

export const HAIKU_MODEL = 'claude-haiku-4-5'
export const DEFAULT_GROQ_ORGANIZE_MODEL = 'qwen/qwen3.8-27b'
export const MAX_TURNS = 3
export const MIN_CARDS = 3
/** Cards beyond this are left out of one run (cost and prompt size). */
export const MAX_CARDS = 150
/** The whole Organize call, all fallbacks included. */
export const ORGANIZE_DEADLINE_MS = 45_000
/** One model request never waits longer than this. */
export const REQUEST_TIMEOUT_MS = 30_000
/** Don't start a request with less time than this left. */
const MIN_REQUEST_MS = 2_000

export const MESSAGES = {
  tooFew: 'Capture a few more pages first.',
  backup: 'Used the backup model.',
  offline: "Couldn't reach the AI service. Showing unnamed groups from your pages.",
  offlineEmpty: "Couldn't reach the AI service, and no pages are similar enough to group yet.",
  none: 'No new suggestions this time. Capture more pages or add notes, then try again.'
}

// ─── Clients (the parts we use, so tests can pass fakes) ───────────────────

export interface AnthropicClient {
  messages: {
    create(
      body: Anthropic.MessageCreateParamsNonStreaming,
      options?: { timeout?: number; signal?: AbortSignal }
    ): Promise<Pick<Anthropic.Message, 'content' | 'stop_reason'>>
  }
}

export interface GroqToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export type GroqMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: GroqToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

export interface GroqChatBody {
  model: string
  messages: GroqMessage[]
  tools: GroqTool[]
  tool_choice: 'auto'
  max_tokens: number
  temperature: number
  reasoning_format?: 'hidden' | 'parsed' | 'raw'
}

export interface GroqClient {
  chat: {
    completions: {
      create(
        body: GroqChatBody,
        options?: { timeout?: number }
      ): Promise<{
        choices: {
          finish_reason?: string | null
          message?: { content?: string | null; tool_calls?: GroqToolCall[] | null }
        }[]
      }>
    }
  }
}

export interface OrganizeDeps {
  embed(workspaceId: string, items: { id: string; text: string }[]): Promise<Vectors>
  embedText(text: string): Promise<number[]>
  keys(): { anthropic: string; groq: string }
  anthropic(key: string): AnthropicClient
  groq(key: string): GroqClient
  groqModel(): string
  newId(): string
  now(): number
  log(line: Record<string, unknown>): void
  deadlineMs?: number
}

// ─── Run state ─────────────────────────────────────────────────────────────

const LIMITS: Record<Ghost['kind'], number> = { group: MAX_GROUPS, edge: MAX_EDGES, tag: MAX_TAGS }

class Collector {
  ghosts: Ghost[] = []
  errors = 0
  /** How long each model request took (for the log). */
  turnMs: number[] = []
  constructor(private ctx: ToolContext) {}

  /** Runs one tool call; returns the text and error flag for its tool result. */
  call(name: string, input: unknown): { content: string; isError: boolean } {
    let outcome: ToolOutcome = toolCallToGhost(name, input, this.ctx)
    if (outcome.kind === 'ghost') {
      const kind = outcome.ghost.kind
      if (this.ghosts.filter((g) => g.kind === kind).length >= LIMITS[kind]) {
        outcome = {
          kind: 'dropped',
          message: `Skipped: the limit of ${LIMITS[kind]} ${kind} suggestions is reached.`
        }
      } else this.ghosts.push(outcome.ghost)
    }
    if (outcome.kind === 'error') this.errors++
    return { content: outcome.message, isError: outcome.kind === 'error' }
  }
}

class Deadline {
  private end: number
  constructor(
    readonly now: () => number,
    ms: number
  ) {
    this.end = now() + ms
  }
  left(): number {
    return this.end - this.now()
  }
  /** Timeout for the next request, or 0 if there isn't enough time left. */
  next(): number {
    const left = this.left()
    return left < MIN_REQUEST_MS ? 0 : Math.min(REQUEST_TIMEOUT_MS, left)
  }
}

class OutOfTime extends Error {
  constructor() {
    super('Organize ran out of time')
  }
}

// ─── Loops ─────────────────────────────────────────────────────────────────

async function haikuLoop(
  client: AnthropicClient,
  system: string,
  user: string,
  collector: Collector,
  deadline: Deadline
): Promise<number> {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: user }]
  let turns = 0
  while (turns < MAX_TURNS) {
    const timeout = deadline.next()
    if (!timeout) {
      if (turns === 0) throw new OutOfTime()
      break
    }
    let res: Pick<Anthropic.Message, 'content' | 'stop_reason'>
    const started = deadline.now()
    try {
      res = await client.messages.create(
        {
          model: HAIKU_MODEL,
          max_tokens: 4096,
          system,
          tools: ORGANIZE_TOOLS,
          tool_choice: { type: 'auto' },
          messages
        },
        { timeout }
      )
    } catch (err) {
      // Keep what earlier turns produced; only a first-turn failure falls back.
      if (turns === 0) throw err
      break
    }
    turns++
    collector.turnMs.push(deadline.now() - started)
    const uses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    const results: Anthropic.ToolResultBlockParam[] = uses.map((u) => {
      const r = collector.call(u.name, u.input)
      return r.isError
        ? { type: 'tool_result', tool_use_id: u.id, content: r.content, is_error: true }
        : { type: 'tool_result', tool_use_id: u.id, content: r.content }
    })
    if (res.stop_reason !== 'tool_use' || !uses.length || turns >= MAX_TURNS) break
    // All results go back in one user message (keeps parallel tool use working).
    messages.push({ role: 'assistant', content: res.content })
    messages.push({ role: 'user', content: results })
  }
  return turns
}

function parseArgs(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return undefined
  }
}

async function groqLoop(
  client: GroqClient,
  model: string,
  system: string,
  user: string,
  collector: Collector,
  deadline: Deadline
): Promise<number> {
  const messages: GroqMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ]
  const tools = toGroqTools()
  let turns = 0
  while (turns < MAX_TURNS) {
    const timeout = deadline.next()
    if (!timeout) {
      if (turns === 0) throw new OutOfTime()
      break
    }
    let res: Awaited<ReturnType<GroqClient['chat']['completions']['create']>>
    const started = deadline.now()
    try {
      res = await client.chat.completions.create(
        {
          model,
          messages,
          tools,
          tool_choice: 'auto',
          max_tokens: 8192,
          temperature: 0.2,
          // Qwen 3 reasons before answering; keep the reasoning out of the reply.
          ...(/qwen/i.test(model) ? { reasoning_format: 'hidden' as const } : {})
        },
        { timeout }
      )
    } catch (err) {
      if (turns === 0) throw err
      break
    }
    turns++
    collector.turnMs.push(deadline.now() - started)
    const msg = res.choices[0]?.message
    const calls = msg?.tool_calls ?? []
    const results = calls.map((c) => {
      const args = parseArgs(c.function.arguments)
      const r =
        args === undefined
          ? { content: 'Error: arguments are not valid JSON.', isError: true }
          : collector.call(c.function.name, args)
      return {
        role: 'tool' as const,
        tool_call_id: c.id,
        content: r.isError ? `Error: ${r.content.replace(/^Error: /, '')}` : r.content
      }
    })
    if (!calls.length || turns >= MAX_TURNS) break
    messages.push({ role: 'assistant', content: msg?.content ?? null, tool_calls: calls })
    messages.push(...results)
  }
  return turns
}

// ─── Offline fallback ──────────────────────────────────────────────────────

function mostCommon(values: string[]): string | null {
  const counts = new Map<string, number>()
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best: string | null = null
  let n = 1
  for (const [v, c] of counts) {
    if (c > n) {
      best = v
      n = c
    }
  }
  return best
}

const sentence = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s)

/** Groups by site when there are no vectors (the model couldn't load). */
function hostClusters(cards: BoardSnapshot['nodes']): Cluster[] {
  const bySite = new Map<string, string[]>()
  for (const n of cards) {
    if (n.groupId) continue
    const host = hostOf(n.url)
    if (host) bySite.set(host, [...(bySite.get(host) ?? []), n.id])
  }
  return [...bySite.values()]
    .filter((ids) => ids.length >= 2)
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_GROUPS)
    .map((ids) => ({ ids, cohesion: 0.5 }))
}

const TITLE_STOP = new Set(
  'about after also among and are between can could does from have home how into more most new not over page that the their this through what when where which while who why will with without your study report review guide video explained first'.split(
    ' '
  )
)

/** A word in the titles of at least half the members (and 2+), e.g. "Microplastics". */
function sharedTitleWord(titles: string[]): string | null {
  const need = Math.max(2, Math.ceil(titles.length / 2))
  const docs = new Map<string, number>()
  const order: string[] = []
  for (const t of titles) {
    const words = new Set(
      (t.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []).filter((w) => !TITLE_STOP.has(w))
    )
    for (const w of words) {
      if (!docs.has(w)) order.push(w)
      docs.set(w, (docs.get(w) ?? 0) + 1)
    }
  }
  let best: string | null = null
  for (const w of order)
    if ((docs.get(w) ?? 0) >= need && (!best || docs.get(w)! > docs.get(best)!)) best = w
  return best
}

/** One ghost per cluster, named by a shared tag, title word or site, with no links. */
function offlineGhosts(
  clusters: Cluster[],
  cards: BoardSnapshot['nodes'],
  collector: Collector
): void {
  const byId = new Map(cards.map((n) => [n.id, n]))
  clusters.forEach((c, i) => {
    const members = c.ids.map((id) => byId.get(id)).filter((n) => n !== undefined)
    const tag = mostCommon(members.flatMap((n) => n.tags))
    const word = tag ? null : sharedTitleWord(members.map((n) => n.title))
    const host = mostCommon(members.map((n) => hostOf(n.url)))
    const words = (s: string): string => s.split(/\s+/).slice(0, 4).join(' ')
    const label = tag
      ? sentence(words(tag))
      : word
        ? sentence(word)
        : host
          ? words(host)
          : `Suggested group ${i + 1}`
    collector.call('proposeGroup', {
      nodeIds: c.ids,
      label,
      category: !tag && !word && host ? 'source' : 'topic',
      rationale: `${members.length} pages with similar text.`,
      confidence: Math.min(1, Math.max(0.4, c.cohesion))
    })
  })
}

// ─── Organize ──────────────────────────────────────────────────────────────

function errorText(err: unknown): string {
  if (err && typeof err === 'object' && 'status' in err && typeof err.status === 'number') {
    return `HTTP ${err.status}`
  }
  return err instanceof Error ? err.name + ': ' + err.message.slice(0, 160) : String(err)
}

export interface Organizer {
  organize(snapshot: unknown): Promise<OrganizeResult>
}

export function createOrganizer(deps: OrganizeDeps): Organizer {
  return {
    async organize(raw) {
      const t0 = deps.now()
      const parsed = parseSnapshot(raw)
      if (!parsed.ok) throw new Error(`Invalid board snapshot: ${parsed.error}`)
      const snapshot = parsed.value
      const cards = snapshot.nodes
        .filter((n) => n.kind !== 'question' && n.id !== snapshot.questionNodeId)
        .slice(0, MAX_CARDS)
      if (cards.length < MIN_CARDS) return { ghosts: [], mode: 'offline', message: MESSAGES.tooFew }
      const scoped: BoardSnapshot = {
        ...snapshot,
        nodes: [...snapshot.nodes.filter((n) => n.id === snapshot.questionNodeId), ...cards]
      }

      // 1. Local similarity. A model failure leaves the agent to work from text alone.
      let analysis: Analysis = { clusters: [], pairs: [], questionLinks: [] }
      let vectorsOk = false
      const tEmbed = deps.now()
      try {
        const vecs = await deps.embed(
          snapshot.workspaceId,
          cards.map((n) => ({ id: n.id, text: embeddingText(n) }))
        )
        const question = snapshot.researchQuestion?.trim()
        const qVec = question ? await deps.embedText(question) : undefined
        const ids = cards.map((n) => n.id)
        analysis = {
          clusters: clusterNodes(
            cards.filter((n) => !n.groupId).map((n) => n.id),
            vecs
          ),
          pairs: candidateEdges(ids, vecs, snapshot.edges),
          questionLinks: questionLinks(qVec, ids, vecs)
        }
        vectorsOk = true
      } catch (err) {
        deps.log({ stage: 'embed', error: errorText(err) })
      }
      const embedMs = deps.now() - tEmbed

      const deadline = new Deadline(deps.now, deps.deadlineMs ?? ORGANIZE_DEADLINE_MS)
      const keys = deps.keys()
      const attempt = async (
        mode: OrganizeMode,
        run: (prompt: ReturnType<typeof buildPrompt>, c: Collector) => Promise<number>
      ): Promise<{ collector: Collector; turns: number }> => {
        const prompt = buildPrompt(scoped, analysis, deps.newId)
        const collector = new Collector(prompt.context)
        try {
          return { collector, turns: await run(prompt, collector) }
        } catch (err) {
          deps.log({ stage: mode, error: errorText(err) })
          throw err
        }
      }
      const finish = (
        mode: OrganizeMode,
        collector: Collector,
        turns: number,
        message?: string
      ): OrganizeResult => {
        deps.log({
          mode,
          cards: cards.length,
          clusters: analysis.clusters.length,
          pairs: analysis.pairs.length,
          ghosts: collector.ghosts.length,
          toolErrors: collector.errors,
          turns,
          turnMs: collector.turnMs,
          vectors: vectorsOk,
          embedMs,
          ms: deps.now() - t0
        })
        const msg = message ?? (collector.ghosts.length ? undefined : MESSAGES.none)
        return msg
          ? { ghosts: collector.ghosts, mode, message: msg }
          : { ghosts: collector.ghosts, mode }
      }

      // 2. Haiku.
      if (keys.anthropic) {
        try {
          const client = deps.anthropic(keys.anthropic)
          const r = await attempt('haiku', (p, c) =>
            haikuLoop(client, p.system, p.user, c, deadline)
          )
          return finish('haiku', r.collector, r.turns)
        } catch {
          // fall through to Groq
        }
      }

      // 3. Groq, same prompt and tools.
      if (keys.groq) {
        try {
          const client = deps.groq(keys.groq)
          const r = await attempt('groq', (p, c) =>
            groqLoop(client, deps.groqModel(), p.system, p.user, c, deadline)
          )
          return finish('groq', r.collector, r.turns, MESSAGES.backup)
        } catch {
          // fall through to offline
        }
      }

      // 4. Offline: embedding clusters (or same-site groups), no links.
      const prompt = buildPrompt(scoped, analysis, deps.newId)
      const collector = new Collector(prompt.context)
      const clusters = vectorsOk ? analysis.clusters : hostClusters(cards)
      offlineGhosts(clusters, cards, collector)
      return finish(
        'offline',
        collector,
        0,
        collector.ghosts.length ? MESSAGES.offline : MESSAGES.offlineEmpty
      )
    }
  }
}
