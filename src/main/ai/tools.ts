// The Organize agent's tools. They mirror canvas commands (createGroup, connect, addTags),
// but nothing is applied: every valid call becomes a ghost the student reviews. There are
// no destructive tools (no delete, no move), so the student stays in control by
// construction. Cards appear to the model under short aliases (q, n1, n2…), which are
// resolved here; anything the model gets wrong comes back to it as an is_error result.
import type Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { DEFAULT_GROUP_COLOR } from '@shared/groups'
import { normalizeTag } from '@shared/tags'
import type { Command, Ghost, GroupCategory, Relation } from '@shared/types'

/** DESIGN.md: suggestions below this confidence are never shown. */
export const MIN_CONFIDENCE = 0.4
export const MAX_LABEL_WORDS = 4
export const MAX_LABEL_CHARS = 40
export const MAX_RATIONALE_CHARS = 220

export const AI_RELATIONS = ['supports', 'contradicts', 'answers', 'related'] as const
export const AI_GROUP_CATEGORIES = ['topic', 'source', 'importance'] as const

export type ToolName = 'proposeGroup' | 'proposeEdge' | 'proposeTag'

const confidence = {
  type: 'number',
  description:
    'How sure you are, from 0 to 1. Be calibrated: 0.9 only when the text makes it obvious. Below 0.4 is discarded.'
} as const
const rationale = {
  type: 'string',
  description:
    "One short sentence naming the shared evidence the student can check, e.g. 'Both cover Rotterdam water squares.'"
} as const

// strict: true guarantees schema-valid input. Strict mode does not support numeric
// ranges, string lengths or minItems > 1, so those limits are stated in the
// descriptions and checked by the zod schemas below.
export const ORGANIZE_TOOLS: Anthropic.Tool[] = [
  {
    name: 'proposeGroup',
    description:
      'Suggest grouping 2 or more cards that share a topic, source or importance into a labelled group. Use only card ids from the list, never q. Cards already in a group cannot be grouped again, and each card can be in only one proposed group.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        nodeIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Ids of the cards in the group (at least 2), e.g. ["n1","n4"].'
        },
        label: {
          type: 'string',
          description:
            'Group name: 1 to 4 words, sentence case, naming the shared topic (e.g. "Funding models").'
        },
        category: {
          type: 'string',
          enum: [...AI_GROUP_CATEGORIES],
          description: 'topic (shared subject), source (same kind of source), or importance.'
        },
        rationale,
        confidence
      },
      required: ['nodeIds', 'label', 'category', 'rationale', 'confidence'],
      additionalProperties: false
    }
  },
  {
    name: 'proposeEdge',
    description:
      'Suggest a typed link from one card to another. supports: source backs a claim in target. contradicts: they disagree. answers: source answers target (use target "q" for the research question). related: clearly connected but none of the above; use sparingly.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Id of the card the link starts from (not q).' },
        target: { type: 'string', description: 'Id of the card the link points to, or q.' },
        relation: { type: 'string', enum: [...AI_RELATIONS] },
        rationale,
        confidence
      },
      required: ['source', 'target', 'relation', 'rationale', 'confidence'],
      additionalProperties: false
    }
  },
  {
    name: 'proposeTag',
    description:
      'Suggest one short tag for a card (1 to 3 words, lowercase), only when it helps the student find related cards later.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'Id of the card (not q).' },
        tag: { type: 'string', description: 'The tag, without #.' },
        rationale,
        confidence
      },
      required: ['nodeId', 'tag', 'rationale', 'confidence'],
      additionalProperties: false
    }
  }
]

/** OpenAI-style function tools for the Groq fallback (same names and schemas). */
export interface GroqTool {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

export function toGroqTools(tools: Anthropic.Tool[] = ORGANIZE_TOOLS): GroqTool[] {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description ?? '',
      parameters: t.input_schema as unknown as Record<string, unknown>
    }
  }))
}

// ─── Input validation ──────────────────────────────────────────────────────

const Conf = z.number().finite()
const Text = z.string()

const GroupInput = z.object({
  nodeIds: z.array(Text),
  label: Text,
  category: z.enum(AI_GROUP_CATEGORIES),
  rationale: Text,
  confidence: Conf
})
const EdgeInput = z.object({
  source: Text,
  target: Text,
  relation: z.enum(AI_RELATIONS),
  rationale: Text,
  confidence: Conf
})
const TagInput = z.object({ nodeId: Text, tag: Text, rationale: Text, confidence: Conf })

// ─── Context ───────────────────────────────────────────────────────────────

export interface ToolCard {
  id: string
  title: string
  tags: string[]
  groupId?: string
}

/** What a tool call is checked against: the board as the model saw it, plus this run. */
export interface ToolContext {
  /** alias → real id (q → the question card). Real ids are accepted too. */
  aliases: Record<string, string>
  questionId: string
  cards: Record<string, ToolCard>
  groupLabels: Record<string, string>
  /** Existing links as unordered pairs (see pairKey). */
  linkedPairs: Set<string>
  newId(): string
  /** Filled while the run goes on, to drop repeats. */
  run: { pairs: Set<string>; grouped: Map<string, string>; tags: Set<string> }
}

export const pairKey = (a: string, b: string): string =>
  a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`

export function emptyRun(): ToolContext['run'] {
  return { pairs: new Set(), grouped: new Map(), tags: new Set() }
}

export type ToolOutcome =
  | { kind: 'ghost'; ghost: Ghost; message: string }
  | { kind: 'dropped'; message: string }
  | { kind: 'error'; message: string }

const error = (message: string): ToolOutcome => ({ kind: 'error', message })
const dropped = (message: string): ToolOutcome => ({ kind: 'dropped', message })

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t
}

function sentenceCase(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

/**
 * The student never sees aliases, so any the model used in a rationale ("n4 reports…")
 * become short card titles.
 */
function cleanRationale(s: string, ctx: ToolContext): string {
  const unquoted = s.trim().replace(/^["'“]+|["'”]+$/g, '')
  const named = unquoted.replace(/\bn\d+\b/g, (m: string) => {
    const id = ctx.aliases[m]
    return id && ctx.cards[id] ? `“${clip(ctx.cards[id].title, 32)}”` : m
  })
  return sentenceCase(clip(named, MAX_RATIONALE_CHARS))
}

/** Checks confidence: an error outside 0–1, a silent drop below the minimum. */
function checkConfidence(c: number): ToolOutcome | null {
  if (c < 0 || c > 1) return error('confidence must be between 0 and 1.')
  if (c < MIN_CONFIDENCE) return dropped(`Skipped: confidence below ${MIN_CONFIDENCE}.`)
  return null
}

function resolve(ctx: ToolContext, ref: string): string | undefined {
  const r = ref.trim()
  const id = ctx.aliases[r] ?? ctx.aliases[r.toLowerCase()] ?? r
  return id === ctx.questionId || ctx.cards[id] ? id : undefined
}

function titleOf(ctx: ToolContext, id: string): string {
  if (id === ctx.questionId) return 'Research question'
  return clip(ctx.cards[id]?.title || 'Untitled', 48)
}

const RELATION_WORD: Record<(typeof AI_RELATIONS)[number], string> = {
  supports: 'supports',
  contradicts: 'contradicts',
  answers: 'answers',
  related: 'related'
}

function describe(err: z.ZodError): string {
  return err.issues
    .slice(0, 3)
    .map((i) => `${i.path.join('.') || 'input'}: ${i.message}`)
    .join('; ')
}

// ─── Mapping ───────────────────────────────────────────────────────────────

function groupGhost(input: unknown, ctx: ToolContext): ToolOutcome {
  const parsed = GroupInput.safeParse(input)
  if (!parsed.success) return error(describe(parsed.error))
  const p = parsed.data
  const raw = p.label
    .replace(/^["'“]+|["'”]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  // A site name (e.g. "nature.com") keeps its own case.
  const label = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(raw) ? raw : sentenceCase(raw)
  if (!label) return error('label is empty.')
  if (label.split(' ').length > MAX_LABEL_WORDS || label.length > MAX_LABEL_CHARS) {
    return error(`label must be 1 to ${MAX_LABEL_WORDS} words.`)
  }
  const ids: string[] = []
  for (const ref of p.nodeIds) {
    const id = resolve(ctx, ref)
    if (!id) return error(`Unknown card id "${ref}". Use only ids from the list.`)
    if (id === ctx.questionId) return error('The research question (q) cannot be in a group.')
    if (!ids.includes(id)) ids.push(id)
  }
  if (ids.length < 2) return error('A group needs at least 2 different cards.')
  const conf = checkConfidence(p.confidence)
  if (conf) return conf

  const groups = new Set(ids.map((id) => ctx.cards[id].groupId))
  if (groups.size === 1 && [...groups][0]) {
    return dropped('Skipped: these cards are already grouped together.')
  }
  for (const id of ids) {
    const existing = ctx.cards[id].groupId
    if (existing) {
      const name = ctx.groupLabels[existing] || 'a group'
      return error(
        `"${ref(ctx, id)}" is already in "${name}". Propose groups only from cards not in a group.`
      )
    }
    const proposed = ctx.run.grouped.get(id)
    if (proposed) {
      return error(`"${ref(ctx, id)}" is already in your proposed group "${proposed}".`)
    }
  }
  for (const id of ids) ctx.run.grouped.set(id, label)

  const category: GroupCategory = p.category
  const command: Command = {
    type: 'createGroup',
    payload: {
      group: { id: ctx.newId(), label, color: DEFAULT_GROUP_COLOR[category], category },
      memberIds: ids
    }
  }
  return {
    kind: 'ghost',
    message: 'ok',
    ghost: {
      id: ctx.newId(),
      kind: 'group',
      title: `Group ${ids.length} pages as “${label}”`,
      command,
      rationale: cleanRationale(p.rationale, ctx),
      confidence: p.confidence
    }
  }
}

/** The alias the model used for a card (for error messages). */
function ref(ctx: ToolContext, id: string): string {
  return Object.keys(ctx.aliases).find((a) => ctx.aliases[a] === id) ?? id
}

function edgeGhost(input: unknown, ctx: ToolContext): ToolOutcome {
  const parsed = EdgeInput.safeParse(input)
  if (!parsed.success) return error(describe(parsed.error))
  const p = parsed.data
  const source = resolve(ctx, p.source)
  const target = resolve(ctx, p.target)
  if (!source) return error(`Unknown card id "${p.source}". Use only ids from the list.`)
  if (!target) return error(`Unknown card id "${p.target}". Use only ids from the list.`)
  if (source === ctx.questionId) {
    return error('The research question (q) can only be a link target, not its source.')
  }
  if (source === target) return error('A link needs two different cards.')
  const conf = checkConfidence(p.confidence)
  if (conf) return conf
  const key = pairKey(source, target)
  if (ctx.linkedPairs.has(key)) return dropped('Skipped: these cards are already linked.')
  if (ctx.run.pairs.has(key)) return dropped('Skipped: you already proposed this link.')
  ctx.run.pairs.add(key)

  const relation: Relation = p.relation
  return {
    kind: 'ghost',
    message: 'ok',
    ghost: {
      id: ctx.newId(),
      kind: 'edge',
      title: `${titleOf(ctx, source)} → ${RELATION_WORD[p.relation]} → ${titleOf(ctx, target)}`,
      command: {
        type: 'connect',
        payload: { edge: { id: ctx.newId(), source, target, relation, origin: 'ai' } }
      },
      rationale: cleanRationale(p.rationale, ctx),
      confidence: p.confidence
    }
  }
}

function tagGhost(input: unknown, ctx: ToolContext): ToolOutcome {
  const parsed = TagInput.safeParse(input)
  if (!parsed.success) return error(describe(parsed.error))
  const p = parsed.data
  const id = resolve(ctx, p.nodeId)
  if (!id) return error(`Unknown card id "${p.nodeId}". Use only ids from the list.`)
  if (id === ctx.questionId) return error('The research question (q) cannot be tagged.')
  const tag = normalizeTag(p.tag)
  if (!tag) return error('tag is empty.')
  if (tag.split(' ').length > 3 || tag.length > 32) return error('tag must be 1 to 3 short words.')
  const conf = checkConfidence(p.confidence)
  if (conf) return conf
  if (ctx.cards[id].tags.includes(tag)) return dropped('Skipped: the card already has this tag.')
  const key = `${id}\u0000${tag}`
  if (ctx.run.tags.has(key)) return dropped('Skipped: you already proposed this tag.')
  ctx.run.tags.add(key)
  return {
    kind: 'ghost',
    message: 'ok',
    ghost: {
      id: ctx.newId(),
      kind: 'tag',
      title: `Tag “${titleOf(ctx, id)}” as #${tag}`,
      command: { type: 'addTags', payload: { nodeIds: [id], tag } },
      rationale: cleanRationale(p.rationale, ctx),
      confidence: p.confidence
    }
  }
}

/** Turns one tool call into a ghost, a silent skip, or an error for the model to fix. */
export function toolCallToGhost(name: string, input: unknown, ctx: ToolContext): ToolOutcome {
  switch (name) {
    case 'proposeGroup':
      return groupGhost(input, ctx)
    case 'proposeEdge':
      return edgeGhost(input, ctx)
    case 'proposeTag':
      return tagGhost(input, ctx)
    default:
      return error(`Unknown tool "${name}". Use proposeGroup, proposeEdge or proposeTag.`)
  }
}
