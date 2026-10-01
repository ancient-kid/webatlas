// Writes ready-made workspaces into a test app-data folder before the app starts, so
// tests can begin from a board of captured pages. The home index is rebuilt from the
// workspace folders on first launch.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defaultSession } from '../../src/shared/session'
import { makeBoard, makeNode, makeQuestion } from '../../src/shared/testing/factories'
import type { CanvasNode, Workspace } from '../../src/shared/types'

const T0 = 1_760_000_000_000

/** Six pages on two topics: three on flood defences, three on coffee. */
export const SEED_CARDS: Pick<CanvasNode, 'id' | 'title' | 'url' | 'summary' | 'text'>[] = [
  {
    id: 'flood-1',
    title: 'Rotterdam flood defences',
    url: 'https://www.example.org/rotterdam-flood',
    summary: 'How Rotterdam keeps the sea out.',
    text: 'Rotterdam flood defences sea walls storm surge barriers coastal city adaptation funding'
  },
  {
    id: 'flood-2',
    title: 'Jakarta sea wall',
    url: 'https://www.example.org/jakarta-wall',
    summary: 'A giant sea wall for a sinking city.',
    text: 'Jakarta flood defences giant sea walls coastal city sinking storm surge funding'
  },
  {
    id: 'flood-3',
    title: 'Miami storm barriers',
    url: 'https://news.example.com/miami',
    summary: 'Miami plans storm barriers.',
    text: 'Miami flood defences storm surge barriers sea walls coastal city adaptation'
  },
  {
    id: 'coffee-1',
    title: 'Coffee brewing basics',
    url: 'https://coffee.example.net/basics',
    summary: 'Grind, water and time.',
    text: 'coffee beans grind brewing espresso water temperature roast'
  },
  {
    id: 'coffee-2',
    title: 'Espresso extraction',
    url: 'https://coffee.example.net/espresso',
    summary: 'Pressure and extraction.',
    text: 'espresso coffee beans grind extraction pressure brewing roast'
  },
  {
    id: 'coffee-3',
    title: 'Pour-over coffee',
    url: 'https://coffee.example.net/pour-over',
    summary: 'Slow coffee with a filter.',
    text: 'pour over coffee beans grind brewing filter water roast'
  }
]

export interface SeedOptions {
  id?: string
  name?: string
  /** How many of SEED_CARDS to place (default all six). */
  cards?: number
}

/** Writes one workspace and returns its id and name. */
export function seedWorkspace(
  userData: string,
  { id = 'seeded-ws', name = 'Seeded research', cards = SEED_CARDS.length }: SeedOptions = {}
): { id: string; name: string } {
  const question = makeQuestion({
    title: 'How do coastal cities pay for flood defences?',
    position: { x: 0, y: 0 }
  })
  const nodes = SEED_CARDS.slice(0, cards).map((c, i) =>
    makeNode({
      ...c,
      kind: 'webpage',
      capturedAt: T0 + i,
      position: { x: 400 + (i % 3) * 300, y: Math.floor(i / 3) * 300 }
    })
  )
  const workspace: Workspace = {
    version: 1,
    id,
    name,
    researchQuestion: question.title,
    createdAt: T0,
    updatedAt: T0,
    // Browser hidden and zoomed out so the whole board fits the canvas.
    session: { ...defaultSession(), browserOpen: false, viewport: { x: 40, y: 120, zoom: 0.6 } },
    board: makeBoard({ nodes: [question, ...nodes] })
  }
  const dir = join(userData, 'workspaces', id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'workspace.json'), JSON.stringify(workspace))
  return { id, name }
}
