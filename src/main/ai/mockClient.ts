// Test runs (WA_E2E=1 + WA_AI_MOCK=1): a scripted stand-in for Claude Haiku that goes
// through the real agent loop and tool mapping, with no network or key. It reads the
// clusters, pairs and question links from the run's own prompt, so its tool calls refer
// to real card aliases. Turn 1 calls every tool (plus one bad id, to exercise is_error);
// turn 2 checks the error came back and ends the run.
import type Anthropic from '@anthropic-ai/sdk'
import type { AnthropicClient } from './organize'

export const MOCK_DELAY_MS = 600

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function textOf(content: Anthropic.MessageParam['content']): string {
  if (typeof content === 'string') return content
  return content.map((b) => (b.type === 'text' ? b.text : '')).join('\n')
}

interface Parsed {
  cards: string[]
  clusters: string[][]
  pairs: [string, string][]
  questionLinks: string[]
}

export function parsePrompt(user: string): Parsed {
  const cards = [...user.matchAll(/^(n\d+) \|/gm)].map((m) => m[1])
  const clusters = [...user.matchAll(/^c\d+: ([^(]+) \(cohesion/gm)].map((m) =>
    m[1].split(',').map((s) => s.trim())
  )
  const pairs = [...user.matchAll(/^(n\d+) <-> (n\d+) \(/gm)].map(
    (m) => [m[1], m[2]] as [string, string]
  )
  const qLine = user.split('Cards closest to the research question:\n')[1]?.split('\n')[0] ?? ''
  const questionLinks = [...qLine.matchAll(/(n\d+) \(/g)].map((m) => m[1])
  return { cards, clusters, pairs, questionLinks }
}

let toolSeq = 0
const toolCall = (name: string, input: Record<string, unknown>): Anthropic.ToolUseBlock =>
  ({ type: 'tool_use', id: `toolu_mock_${++toolSeq}`, name, input }) as Anthropic.ToolUseBlock

export function createMockAnthropic(delayMs = MOCK_DELAY_MS): AnthropicClient {
  return {
    messages: {
      async create(body) {
        await sleep(delayMs)
        const first = body.messages.length === 1
        if (!first) {
          const last = body.messages[body.messages.length - 1]
          const results = Array.isArray(last.content) ? last.content : []
          const sawError = results.some((b) => b.type === 'tool_result' && b.is_error === true)
          return {
            stop_reason: 'end_turn',
            content: [
              {
                type: 'text',
                text: sawError ? 'Dropped the call with the unknown id.' : 'Done.',
                citations: null
              }
            ]
          }
        }
        const p = parsePrompt(textOf(body.messages[0].content))
        const calls: Anthropic.ToolUseBlock[] = []
        p.clusters.forEach((ids, i) =>
          calls.push(
            toolCall('proposeGroup', {
              nodeIds: ids,
              label: `Mock topic ${i + 1}`,
              category: 'topic',
              rationale: `These ${ids.length} pages share key terms.`,
              confidence: 0.82 - i * 0.05
            })
          )
        )
        p.pairs.slice(0, 2).forEach(([a, b], i) =>
          calls.push(
            toolCall('proposeEdge', {
              source: a,
              target: b,
              relation: 'supports',
              rationale: 'Both pages make the same point.',
              confidence: 0.7 - i * 0.05
            })
          )
        )
        const answer = p.questionLinks[0] ?? p.cards[0]
        if (answer) {
          calls.push(
            toolCall('proposeEdge', {
              source: answer,
              target: 'q',
              relation: 'answers',
              rationale: 'This page addresses the research question.',
              confidence: 0.66
            })
          )
          calls.push(
            toolCall('proposeTag', {
              nodeId: answer,
              tag: 'key source',
              rationale: 'Closest page to the research question.',
              confidence: 0.6
            })
          )
        }
        // A deliberate mistake: the loop must answer it with is_error.
        calls.push(
          toolCall('proposeEdge', {
            source: 'n999',
            target: 'q',
            relation: 'related',
            rationale: 'Not a real card.',
            confidence: 0.9
          })
        )
        return { stop_reason: 'tool_use', content: calls }
      }
    }
  }
}
