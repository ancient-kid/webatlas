import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Board, CanvasNode, Group, Workspace } from '../types'
import { parseWorkspaceFile } from '../schema'
import { toMarkdown } from './markdown'
import { toJsonCanvas } from './jsonCanvas'
import { toWorkspaceFile } from './workspaceFile'

function makeTestWorkspace(): Workspace {
  const qNode: CanvasNode = {
    id: 'q1',
    kind: 'question',
    title: 'How to adapt coastal cities?',
    highlights: [],
    note: '',
    comments: [],
    tags: [],
    position: { x: 0, y: 0 },
    capturedAt: 1000
  }

  const c1: CanvasNode = {
    id: 'c1',
    kind: 'webpage',
    title: 'Rotterdam Water System',
    url: 'https://nature.com/rotterdam',
    summary: 'Water square infrastructure details.',
    highlights: [
      { id: 'h1', quote: 'Stormwater capture reduces urban flooding by 40%.', createdAt: 2000 }
    ],
    note: 'Important empirical finding.',
    comments: [],
    tags: ['adaptation', 'case-study'],
    parentGroupId: 'g1',
    position: { x: 20, y: 30 },
    size: { w: 260, h: 240 },
    capturedAt: 2000
  }

  const c2: CanvasNode = {
    id: 'c2',
    kind: 'video',
    title: 'Rotterdam documentary',
    url: 'https://youtube.com/watch?v=1',
    capturedFromNodeId: 'c1',
    highlights: [],
    note: '',
    comments: [],
    tags: ['talk'],
    parentGroupId: 'g1',
    position: { x: 300, y: 30 },
    size: { w: 260, h: 240 },
    capturedAt: 3000
  }

  const c3: CanvasNode = {
    id: 'c3',
    kind: 'pdf',
    title: 'IPCC Chapter 6',
    url: 'https://ipcc.ch/report.pdf',
    highlights: [{ id: 'h3', quote: 'Global sea levels will rise.', createdAt: 4000 }],
    note: '',
    comments: [],
    tags: ['climate'],
    position: { x: 50, y: 400 },
    capturedAt: 4000
  }

  const n1: CanvasNode = {
    id: 'n1',
    kind: 'note',
    title: 'Discussion questions',
    note: 'Ask supervisor about municipal bonds.',
    highlights: [],
    comments: [],
    tags: ['todo'],
    position: { x: 350, y: 400 },
    capturedAt: 5000
  }

  const ghostNode: CanvasNode = {
    id: 'ghost1',
    kind: 'webpage',
    title: 'Suggested AI page',
    url: 'https://example.com/suggested',
    highlights: [],
    note: '',
    comments: [],
    tags: [],
    position: { x: 600, y: 400 },
    capturedAt: 6000,
    ...({ ghost: true } as unknown as Partial<CanvasNode>)
  }

  const g1: Group = {
    id: 'g1',
    label: 'Case studies',
    category: 'topic',
    color: 'teal',
    note: '',
    comments: [],
    position: { x: 100, y: 100 },
    size: { w: 600, h: 300 }
  }

  const ghostGroup: Group = {
    id: 'ghostG',
    label: 'Suggested Group',
    category: 'topic',
    color: 'amber',
    note: '',
    comments: [],
    position: { x: 800, y: 100 },
    size: { w: 400, h: 300 },
    ...({ ghost: true } as unknown as Partial<Group>)
  }

  const board: Board = {
    nodes: { q1: qNode, c1, c2, c3, n1, ghost1: ghostNode },
    groups: { g1, ghostG: ghostGroup },
    edges: {
      e1: { id: 'e1', source: 'c1', target: 'c2', relation: 'opened-from', origin: 'provenance' },
      e2: {
        id: 'e2',
        source: 'c1',
        target: 'q1',
        relation: 'supports',
        label: 'supports',
        color: 'teal',
        origin: 'user'
      },
      ghostE: {
        id: 'ghostE',
        source: 'c3',
        target: 'q1',
        relation: 'answers',
        origin: 'ai',
        ...({ ghost: true } as unknown as Record<string, unknown>)
      }
    },
    ghosts: {}
  }

  return {
    version: 1,
    id: 'ws-export-test',
    name: 'Coastal adaptation review',
    researchQuestion: 'How to adapt coastal cities?',
    createdAt: 1000,
    updatedAt: 2000,
    session: {
      viewport: { x: 0, y: 0, zoom: 1 },
      selectedIds: [],
      browserUrl: 'https://nature.com/rotterdam',
      viewMode: 'graph',
      captureMode: 'manual',
      browserOpen: true,
      splitRatio: 42
    },
    board
  }
}

describe('export: toMarkdown', () => {
  it('formats title, question, group headings, cards, quotes, notes, tags, and relationships', () => {
    const ws = makeTestWorkspace()
    const md = toMarkdown(ws)

    expect(md).toContain('# Coastal adaptation review')
    expect(md).toContain('> Research question: How to adapt coastal cities?')
    expect(md).toContain('## Case studies')
    expect(md).toContain('*topic*')

    // Card in group
    expect(md).toContain('### [Rotterdam Water System](https://nature.com/rotterdam) · Web')
    expect(md).toContain('- Summary: Water square infrastructure details.')
    expect(md).toContain('- Note: Important empirical finding.')
    expect(md).toContain('> “Stormwater capture reduces urban flooding by 40%.”')
    expect(md).toContain('Tags: #adaptation #case-study')

    // Opened from provenance
    expect(md).toContain('- Opened from [Rotterdam Water System](https://nature.com/rotterdam)')

    // Ungrouped section
    expect(md).toContain('## Not in a group')
    expect(md).toContain('### [IPCC Chapter 6](https://ipcc.ch/report.pdf) · PDF')

    // Notes section
    expect(md).toContain('## Notes')
    expect(md).toContain('### Discussion questions · Note')
    expect(md).toContain('- Note: Ask supervisor about municipal bonds.')

    // Relationships
    expect(md).toContain('## Relationships')
    expect(md).toContain('- Rotterdam Water System → opened-from → Rotterdam documentary')
    expect(md).toContain('- Rotterdam Water System → supports → How to adapt coastal cities?')
  })

  it('strictly excludes ghosts from Markdown output', () => {
    const ws = makeTestWorkspace()
    const md = toMarkdown(ws)

    expect(md).not.toContain('Suggested AI page')
    expect(md).not.toContain('Suggested Group')
    expect(md).not.toContain('ghostE')
  })
})

describe('export: toJsonCanvas', () => {
  it('outputs JSON Canvas 1.0 with groups first, absolute child coordinates, color maps, and valid edges', () => {
    const ws = makeTestWorkspace()
    const canvas = toJsonCanvas(ws)

    // Group nodes must come before child cards in the array
    const groupIndex = canvas.nodes.findIndex((n) => n.id === 'g1')
    const childIndex = canvas.nodes.findIndex((n) => n.id === 'c1')
    expect(groupIndex).toBeLessThan(childIndex)

    // Group node format
    const groupNode = canvas.nodes[groupIndex]
    expect(groupNode.type).toBe('group')
    expect(groupNode.label).toBe('Case studies')
    expect(groupNode.color).toBe('5') // teal is mapped to '5'
    expect(groupNode.x).toBe(100)
    expect(groupNode.y).toBe(100)

    // Child node absolute coordinates: group position (100, 100) + relative position (20, 30) = (120, 130)
    const childNode = canvas.nodes[childIndex]
    expect(childNode.type).toBe('link')
    expect(childNode.url).toBe('https://nature.com/rotterdam')
    expect(childNode.x).toBe(120)
    expect(childNode.y).toBe(130)

    // Question node is text with ##
    const qNode = canvas.nodes.find((n) => n.id === 'q1')
    expect(qNode?.type).toBe('text')
    expect(qNode?.text).toContain('## How to adapt coastal cities?')

    // Note node is text
    const noteNode = canvas.nodes.find((n) => n.id === 'n1')
    expect(noteNode?.type).toBe('text')
    expect(noteNode?.text).toBe('Ask supervisor about municipal bonds.')

    // Edges
    expect(canvas.edges.length).toBe(2)
    const e1 = canvas.edges.find((e) => e.id === 'e1')
    expect(e1?.fromNode).toBe('c1')
    expect(e1?.toNode).toBe('c2')
    expect(e1?.toEnd).toBe('arrow')

    // Ghosts are strictly excluded
    expect(canvas.nodes.some((n) => n.id === 'ghost1')).toBe(false)
    expect(canvas.nodes.some((n) => n.id === 'ghostG')).toBe(false)
    expect(canvas.edges.some((e) => e.id === 'ghostE')).toBe(false)
  })
})

describe('export: toWorkspaceFile', () => {
  it('round-trips through WorkspaceFileSchema', () => {
    const ws = makeTestWorkspace()
    const file = toWorkspaceFile(ws)
    const parsed = parseWorkspaceFile(file)
    expect(parsed.ok).toBe(true)
  })

  it('validates that sample.webatlas.json conforms to WorkspaceFileSchema', async () => {
    const samplePath = join(process.cwd(), 'resources/sample/sample.webatlas.json')
    const raw = await fs.readFile(samplePath, 'utf8')
    const json = JSON.parse(raw)
    const parsed = parseWorkspaceFile(json)
    if (!parsed.ok) {
      console.error(parsed.error)
    }
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.value.workspace.name).toBe('Sample: Coastal adaptation')
      expect(Object.keys(parsed.value.workspace.board.nodes).length).toBeGreaterThanOrEqual(12)
      expect(Object.keys(parsed.value.workspace.board.groups).length).toBe(3)
    }
  })
})
