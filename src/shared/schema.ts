// Runtime validation for data read from disk or imported from another student.
// Types in types.ts are the source of truth; schema.test.ts checks these schemas
// produce exactly those types. Unknown extra fields are stripped, not rejected.
import { z } from 'zod'
import { SPLIT_RATIO_MAX, SPLIT_RATIO_MIN } from './session'
import {
  CAPTURE_MODES,
  CATS,
  COMMAND_TYPES,
  EDGE_ORIGINS,
  GHOST_KINDS,
  GROUP_CATEGORIES,
  NODE_KINDS,
  RELATIONS,
  VIEW_MODES,
  type Board,
  type BoardSnapshot,
  type Command,
  type Workspace,
  type WorkspaceFile
} from './types'

const id = z.string().min(1).max(128)
const timestamp = z.number().int().nonnegative()

export const XYSchema = z.object({ x: z.number(), y: z.number() })
export const SizeSchema = z.object({ w: z.number().positive(), h: z.number().positive() })

export const HighlightSchema = z.object({ id, quote: z.string(), createdAt: timestamp })
export const CommentSchema = z.object({ id, text: z.string(), createdAt: timestamp })

export const CanvasNodeSchema = z.object({
  id,
  kind: z.enum(NODE_KINDS),
  url: z.string().optional(),
  title: z.string(),
  faviconUrl: z.string().optional(),
  thumbnailPath: z.string().optional(),
  summary: z.string().optional(),
  text: z.string().optional(),
  highlights: z.array(HighlightSchema),
  note: z.string(),
  comments: z.array(CommentSchema),
  tags: z.array(z.string()),
  color: z.enum(CATS).optional(),
  position: XYSchema,
  size: SizeSchema.optional(),
  parentGroupId: id.optional(),
  capturedFromNodeId: id.optional(),
  capturedAt: timestamp
})

export const GroupSchema = z.object({
  id,
  label: z.string(),
  color: z.enum(CATS),
  category: z.enum(GROUP_CATEGORIES),
  position: XYSchema,
  size: SizeSchema,
  note: z.string(),
  comments: z.array(CommentSchema)
})

export const EdgeSchema = z.object({
  id,
  source: id,
  target: id,
  label: z.string().optional(),
  relation: z.enum(RELATIONS),
  color: z.enum(CATS).optional(),
  origin: z.enum(EDGE_ORIGINS)
})

/**
 * A stored ghost's command. Commands are produced by our own code, so the file check
 * only verifies the envelope; the command layer re-checks a ghost before applying it.
 */
export const CommandSchema = z
  .object({ type: z.enum(COMMAND_TYPES), payload: z.record(z.string(), z.unknown()) })
  .transform((c) => c as unknown as Command)

export const GhostSchema = z.object({
  id,
  kind: z.enum(GHOST_KINDS),
  title: z.string(),
  command: CommandSchema,
  rationale: z.string(),
  confidence: z.number().min(0).max(1)
})

/** Record whose keys must equal each value's `id`. */
function byId<T extends z.ZodType<{ id: string }>>(
  item: T
): z.ZodType<Record<string, z.output<T>>> {
  return z.record(z.string(), item).superRefine((rec, ctx) => {
    for (const [key, value] of Object.entries(rec)) {
      if (value.id !== key) {
        ctx.addIssue({
          code: 'custom',
          path: [key, 'id'],
          message: `id "${value.id}" does not match key "${key}"`
        })
      }
    }
  })
}

export const BoardSchema = z
  .object({
    nodes: byId(CanvasNodeSchema),
    groups: byId(GroupSchema),
    edges: byId(EdgeSchema),
    ghosts: byId(GhostSchema)
  })
  .superRefine((board, ctx) => {
    const nodes = Object.values(board.nodes)
    const questions = nodes.filter((n) => n.kind === 'question')
    if (questions.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['nodes'],
        message: `A workspace needs exactly one research-question card (found ${questions.length})`
      })
    }
    for (const n of nodes) {
      if (n.parentGroupId && !board.groups[n.parentGroupId]) {
        ctx.addIssue({
          code: 'custom',
          path: ['nodes', n.id, 'parentGroupId'],
          message: `Unknown group "${n.parentGroupId}"`
        })
      }
      if (n.kind === 'question' && n.parentGroupId) {
        ctx.addIssue({
          code: 'custom',
          path: ['nodes', n.id, 'parentGroupId'],
          message: 'The research question cannot be inside a group'
        })
      }
    }
    for (const e of Object.values(board.edges)) {
      for (const end of ['source', 'target'] as const) {
        if (!board.nodes[e[end]]) {
          ctx.addIssue({
            code: 'custom',
            path: ['edges', e.id, end],
            message: `Unknown node "${e[end]}"`
          })
        }
      }
    }
  })

export const ViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number().positive()
})

export const SessionSchema = z.object({
  viewport: ViewportSchema,
  selectedIds: z.array(z.string()),
  browserUrl: z.string(),
  viewMode: z.enum(VIEW_MODES),
  captureMode: z.enum(CAPTURE_MODES),
  browserOpen: z.boolean(),
  splitRatio: z.number().min(SPLIT_RATIO_MIN).max(SPLIT_RATIO_MAX)
})

export const WorkspaceSchema = z.object({
  version: z.literal(1),
  id,
  name: z.string().min(1),
  researchQuestion: z.string().optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
  session: SessionSchema,
  board: BoardSchema
})

export const WorkspaceSummarySchema = z.object({
  id,
  name: z.string(),
  researchQuestion: z.string().optional(),
  updatedAt: timestamp,
  nodeCount: z.number().int().nonnegative(),
  groupCount: z.number().int().nonnegative(),
  coverThumb: z.string().optional()
})

export const WorkspaceFileSchema = z.object({
  format: z.literal('webatlas'),
  version: z.literal(1),
  workspace: WorkspaceSchema,
  thumbs: z.record(id, z.string().startsWith('data:image/png;base64,')).optional()
})

/** What the renderer sends to Organize (checked in main: the renderer is untrusted). */
export const BoardSnapshotSchema = z.object({
  workspaceId: id,
  researchQuestion: z.string().optional(),
  questionNodeId: id,
  nodes: z
    .array(
      z.object({
        id,
        kind: z.enum(NODE_KINDS),
        title: z.string(),
        url: z.string().optional(),
        summary: z.string().optional(),
        text: z.string().optional(),
        tags: z.array(z.string()).max(100),
        note: z.string(),
        highlights: z.array(z.string()).max(500),
        groupId: id.optional()
      })
    )
    .max(1000),
  groups: z.array(z.object({ id, label: z.string(), memberIds: z.array(id) })).max(500),
  edges: z.array(z.object({ source: id, target: id, relation: z.enum(RELATIONS) })).max(5000)
})

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

/** Readable one-line summary of the first few validation problems. */
function describe(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((i) => `${i.path.length ? i.path.join('.') + ': ' : ''}${i.message}`)
    .join('; ')
}

/** Validates an exported/shared workspace file. Never throws. */
export function parseWorkspaceFile(data: unknown): ParseResult<WorkspaceFile> {
  const r = WorkspaceFileSchema.safeParse(data)
  return r.success
    ? { ok: true, value: r.data as WorkspaceFile }
    : { ok: false, error: describe(r.error) }
}

/** Validates a stored workspace.json. Never throws. */
export function parseWorkspace(data: unknown): ParseResult<Workspace> {
  const r = WorkspaceSchema.safeParse(data)
  return r.success
    ? { ok: true, value: r.data as Workspace }
    : { ok: false, error: describe(r.error) }
}

/** Validates an Organize snapshot. Never throws. */
export function parseSnapshot(data: unknown): ParseResult<BoardSnapshot> {
  const r = BoardSnapshotSchema.safeParse(data)
  return r.success
    ? { ok: true, value: r.data as BoardSnapshot }
    : { ok: false, error: describe(r.error) }
}

/** Validates a board on its own (used by tests and the command layer). */
export function parseBoard(data: unknown): ParseResult<Board> {
  const r = BoardSchema.safeParse(data)
  return r.success ? { ok: true, value: r.data as Board } : { ok: false, error: describe(r.error) }
}
