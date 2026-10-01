// The WebAtlas data model, shared by main, preload and renderer.
// Field names follow webatlas.architecture.md ("Data model"). Positions of items inside a
// group are relative to the group (the React Flow parent/child convention).

/** The six category colours from DESIGN.md. */
export const CATS = ['rose', 'amber', 'moss', 'teal', 'blue', 'plum'] as const
export type Cat = (typeof CATS)[number]

export const NODE_KINDS = ['webpage', 'video', 'pdf', 'note', 'question'] as const
export type NodeKind = (typeof NODE_KINDS)[number]

export const RELATIONS = [
  'opened-from',
  'related',
  'supports',
  'contradicts',
  'answers',
  'source-of',
  'custom'
] as const
export type Relation = (typeof RELATIONS)[number]

export const GROUP_CATEGORIES = ['topic', 'source', 'importance', 'custom'] as const
export type GroupCategory = (typeof GROUP_CATEGORIES)[number]

export const EDGE_ORIGINS = ['provenance', 'user', 'ai'] as const
export type EdgeOrigin = (typeof EDGE_ORIGINS)[number]

export const VIEW_MODES = ['graph', 'focus', 'list'] as const
export type ViewMode = (typeof VIEW_MODES)[number]

export const CAPTURE_MODES = ['manual', 'auto'] as const
export type CaptureMode = (typeof CAPTURE_MODES)[number]

export const GHOST_KINDS = ['group', 'edge', 'tag'] as const
export type GhostKind = (typeof GHOST_KINDS)[number]

export interface XY {
  x: number
  y: number
}

export interface Size {
  w: number
  h: number
}

export interface Highlight {
  id: string
  quote: string
  createdAt: number
}

export interface Comment {
  id: string
  text: string
  createdAt: number
}

/** A card on the canvas. Named CanvasNode to avoid clashing with DOM/React Flow `Node`. */
export interface CanvasNode {
  id: string
  kind: NodeKind
  url?: string
  /** Card title. For `note` cards this is the note text; for `question` it is the question. */
  title: string
  faviconUrl?: string
  /** `wa-thumb://<workspaceId>/<nodeId>.png?v=…` */
  thumbnailPath?: string
  /** One-line summary (Groq), filled in after capture. */
  summary?: string
  /** Extracted page text, used for embeddings and search. */
  text?: string
  highlights: Highlight[]
  /** The student's own note about this card (shown in the side panel). */
  note: string
  comments: Comment[]
  tags: string[]
  /** Category colour; absent means no colour. */
  color?: Cat
  /** Relative to the parent group when `parentGroupId` is set, otherwise absolute. */
  position: XY
  /** Set only after the user resizes the card. */
  size?: Size
  parentGroupId?: string
  capturedFromNodeId?: string
  capturedAt: number
}

export interface Group {
  id: string
  label: string
  color: Cat
  category: GroupCategory
  position: XY
  size: Size
  note: string
  comments: Comment[]
}

export interface Edge {
  id: string
  source: string
  target: string
  label?: string
  relation: Relation
  color?: Cat
  origin: EdgeOrigin
}

// ─── Commands ──────────────────────────────────────────────────────────────
// Every change to a board is one of these serialisable records. The command layer
// (T05) implements apply/invert for each; ghosts store one that has not been applied.

export type NodePatch = Partial<Omit<CanvasNode, 'id'>>
export type GroupPatch = Partial<Omit<Group, 'id'>>
export type EdgePatch = Partial<Omit<Edge, 'id' | 'source' | 'target'>>

/** A group to create; its position and size are computed from its members. */
export interface NewGroup {
  id: string
  label: string
  color: Cat
  category: GroupCategory
  /** Where to put the frame; by default just above and left of its members. */
  position?: XY
}

export interface ParentChange {
  id: string
  groupId: string | null
  /** Position in the new coordinate space (relative to the group, or absolute). */
  position: XY
}

export type Command =
  | { type: 'addNodes'; payload: { nodes: CanvasNode[] } }
  | { type: 'removeNodes'; payload: { ids: string[] } }
  | { type: 'updateNode'; payload: { id: string; patch: NodePatch } }
  | { type: 'moveItems'; payload: { moves: { id: string; to: XY }[] } }
  | { type: 'resizeItem'; payload: { id: string; size: Size | null } }
  | { type: 'addTags'; payload: { nodeIds: string[]; tag: string } }
  | { type: 'removeTag'; payload: { nodeIds: string[]; tag: string } }
  | { type: 'addHighlight'; payload: { nodeId: string; highlight: Highlight } }
  | { type: 'removeHighlight'; payload: { nodeId: string; highlightId: string } }
  | { type: 'addComment'; payload: { targetId: string; comment: Comment } }
  | { type: 'removeComment'; payload: { targetId: string; commentId: string } }
  | { type: 'connect'; payload: { edge: Edge } }
  | { type: 'disconnect'; payload: { ids: string[] } }
  | { type: 'updateEdge'; payload: { id: string; patch: EdgePatch } }
  | { type: 'createGroup'; payload: { group: NewGroup; memberIds: string[] } }
  | { type: 'addGroups'; payload: { groups: Group[] } }
  | { type: 'updateGroup'; payload: { id: string; patch: GroupPatch } }
  | { type: 'removeGroup'; payload: { id: string } }
  | { type: 'setParent'; payload: { items: ParentChange[] } }
  | { type: 'removeGhosts'; payload: { ids: string[] } }
  | { type: 'restoreGhosts'; payload: { ghosts: Ghost[] } }
  | { type: 'batch'; payload: { commands: Command[] } }

export type CommandType = Command['type']
export type CommandOf<T extends CommandType> = Extract<Command, { type: T }>

export const COMMAND_TYPES = [
  'addNodes',
  'removeNodes',
  'updateNode',
  'moveItems',
  'resizeItem',
  'addTags',
  'removeTag',
  'addHighlight',
  'removeHighlight',
  'addComment',
  'removeComment',
  'connect',
  'disconnect',
  'updateEdge',
  'createGroup',
  'addGroups',
  'updateGroup',
  'removeGroup',
  'setParent',
  'removeGhosts',
  'restoreGhosts',
  'batch'
] as const satisfies readonly CommandType[]

/** An AI suggestion: a command that is shown dashed and only applied when accepted. */
export interface Ghost {
  id: string
  kind: GhostKind
  /** One-line title for the suggestion card, e.g. "Group 3 pages as “Case studies”". */
  title: string
  command: Command
  /** One sentence saying why (always shown to the student). */
  rationale: string
  /** 0–1. Suggestions below 0.4 are never shown. */
  confidence: number
}

export interface Board {
  nodes: Record<string, CanvasNode>
  groups: Record<string, Group>
  edges: Record<string, Edge>
  ghosts: Record<string, Ghost>
}

// ─── Workspace & session ───────────────────────────────────────────────────

export interface Viewport {
  x: number
  y: number
  zoom: number
}

/** Everything needed to "resume exactly where you left off". */
export interface Session {
  viewport: Viewport
  selectedIds: string[]
  browserUrl: string
  viewMode: ViewMode
  captureMode: CaptureMode
  /** Whether the browser pane is open (the user can hide it; the canvas then fills the window). */
  browserOpen: boolean
  /** Browser pane width as a percentage of the window (see SPLIT_RATIO_* in session.ts). */
  splitRatio: number
}

export interface Workspace {
  version: 1
  id: string
  name: string
  researchQuestion?: string
  createdAt: number
  updatedAt: number
  session: Session
  board: Board
}

/** One row of the workspace home screen (index.json). */
export interface WorkspaceSummary {
  id: string
  name: string
  researchQuestion?: string
  updatedAt: number
  /** Cards excluding the research-question card. */
  nodeCount: number
  groupCount: number
  coverThumb?: string
}

/** A shared/exported workspace file. `thumbs` maps nodeId → PNG data URL. */
export interface WorkspaceFile {
  format: 'webatlas'
  version: 1
  workspace: Workspace
  thumbs?: Record<string, string>
}

// ─── AI ────────────────────────────────────────────────────────────────────

/** What the Organize agent sees: text truncated, no thumbnails, no positions. */
export interface BoardSnapshot {
  workspaceId: string
  researchQuestion?: string
  questionNodeId: string
  nodes: {
    id: string
    kind: NodeKind
    title: string
    url?: string
    summary?: string
    text?: string
    tags: string[]
    note: string
    highlights: string[]
    groupId?: string
  }[]
  groups: { id: string; label: string; memberIds: string[] }[]
  edges: { source: string; target: string; relation: Relation }[]
}

export type OrganizeMode = 'haiku' | 'groq' | 'offline'

export interface OrganizeResult {
  ghosts: Ghost[]
  mode: OrganizeMode
  /** Shown to the student as a toast when set, e.g. the offline fallback notice. */
  message?: string
}
