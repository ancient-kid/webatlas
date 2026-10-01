// Test-data builders shared by unit tests. Each returns a valid object; pass overrides
// for the fields a test cares about. Not imported by app code.
import { defaultSession } from '../session'
import type {
  Board,
  BoardSnapshot,
  CanvasNode,
  Edge,
  Ghost,
  Group,
  Workspace,
  WorkspaceFile
} from '../types'

const T0 = 1_760_000_000_000

export function makeNode(overrides: Partial<CanvasNode> = {}): CanvasNode {
  const id = overrides.id ?? 'node-1'
  return {
    id,
    kind: 'webpage',
    url: `https://example.com/${id}`,
    title: `Page ${id}`,
    highlights: [],
    note: '',
    comments: [],
    tags: [],
    position: { x: 0, y: 0 },
    capturedAt: T0,
    ...overrides
  }
}

export function makeQuestion(overrides: Partial<CanvasNode> = {}): CanvasNode {
  return makeNode({
    id: 'question',
    kind: 'question',
    url: undefined,
    title: 'How do coastal cities fund climate adaptation?',
    ...overrides
  })
}

export function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'group-1',
    label: 'Funding models',
    color: 'teal',
    category: 'topic',
    position: { x: 0, y: 0 },
    size: { w: 640, h: 400 },
    note: '',
    comments: [],
    ...overrides
  }
}

export function makeEdge(overrides: Partial<Edge> = {}): Edge {
  return {
    id: 'edge-1',
    source: 'node-1',
    target: 'question',
    relation: 'supports',
    origin: 'user',
    ...overrides
  }
}

export function makeGhost(overrides: Partial<Ghost> = {}): Ghost {
  return {
    id: 'ghost-1',
    kind: 'edge',
    title: 'Page node-1 → supports → Research question',
    command: {
      type: 'connect',
      payload: {
        edge: {
          id: 'edge-ai',
          source: 'node-1',
          target: 'question',
          relation: 'supports',
          origin: 'ai'
        }
      }
    },
    rationale: 'The page answers the funding question directly.',
    confidence: 0.8,
    ...overrides
  }
}

/** Builds a board from lists; records are keyed by id. Adds the question card if missing. */
export function makeBoard(
  parts: {
    nodes?: CanvasNode[]
    groups?: Group[]
    edges?: Edge[]
    ghosts?: Ghost[]
  } = {}
): Board {
  const nodes = parts.nodes ?? []
  const withQuestion = nodes.some((n) => n.kind === 'question') ? nodes : [makeQuestion(), ...nodes]
  const byId = <T extends { id: string }>(xs: T[] = []): Record<string, T> =>
    Object.fromEntries(xs.map((x) => [x.id, x]))
  return {
    nodes: byId(withQuestion),
    groups: byId(parts.groups),
    edges: byId(parts.edges),
    ghosts: byId(parts.ghosts)
  }
}

export function makeWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    version: 1,
    id: 'ws-1',
    name: 'Climate adaptation review',
    researchQuestion: 'How do coastal cities fund climate adaptation?',
    createdAt: T0,
    updatedAt: T0,
    session: defaultSession(),
    board: makeBoard(),
    ...overrides
  }
}

export function makeWorkspaceFile(overrides: Partial<WorkspaceFile> = {}): WorkspaceFile {
  return { format: 'webatlas', version: 1, workspace: makeWorkspace(), ...overrides }
}

/** A valid 1×1 PNG as a data URL (thumbnail tests). */
export const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

/** An Organize snapshot: the question, three cards (one in a group) and one link. */
export function makeSnapshot(overrides: Partial<BoardSnapshot> = {}): BoardSnapshot {
  const card = (
    id: string,
    title: string,
    extra: Partial<BoardSnapshot['nodes'][number]> = {}
  ): BoardSnapshot['nodes'][number] => ({
    id,
    kind: 'webpage' as const,
    title,
    url: `https://www.example.org/${id}`,
    tags: [],
    note: '',
    highlights: [],
    ...extra
  })
  return {
    workspaceId: 'ws-1',
    researchQuestion: 'How do coastal cities fund adaptation?',
    questionNodeId: 'question-uuid',
    nodes: [
      {
        ...card('question-uuid', 'How do coastal cities fund adaptation?'),
        kind: 'question',
        url: undefined
      },
      card('aaaa-1111', 'Rotterdam water squares', {
        summary: 'Plazas that store rain.',
        text: 'R'.repeat(5000),
        tags: ['urban'],
        note: 'Good example',
        highlights: ['old quote', 'mid quote', 'newest quote'],
        groupId: 'g1'
      }),
      card('bbbb-2222', 'Green bonds | explained', { text: 'Bonds fund\nprojects.' }),
      card('cccc-3333', 'Jakarta sea wall')
    ],
    groups: [{ id: 'g1', label: 'Case studies', memberIds: ['aaaa-1111'] }],
    edges: [{ source: 'aaaa-1111', target: 'bbbb-2222', relation: 'opened-from' }],
    ...overrides
  }
}
