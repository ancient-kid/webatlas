// The only surface between the renderer and the main process (window.api).
// Contract from webatlas.architecture.md ("IPC contract"), plus the small additions
// recorded in the plan's Open Questions (explicit workspace ids, ai.status,
// import.sample, app.readyToClose and main → renderer events).
import type { BoardSnapshot, OrganizeResult, Workspace, WorkspaceSummary } from './types'

export type ExportFormat = 'md' | 'json' | 'canvas'

export interface CreateWorkspaceInput {
  name: string
  researchQuestion?: string
}

export interface EmbedItem {
  id: string
  text: string
}

/** Which AI keys are configured. Booleans only: keys never leave the main process. */
export interface AiStatus {
  anthropic: boolean
  groq: boolean
}

// ─── main → renderer events ────────────────────────────────────────────────

/** Actions from the webview's right-click menu. */
export type ContextAction =
  | { type: 'highlight'; text: string }
  | { type: 'link'; url: string; text?: string }
  | { type: 'page' }

/** Application-menu accelerators (they work even while the webview has focus). */
export const MENU_ACTIONS = [
  'capture',
  'highlight',
  'palette',
  'address',
  'toggle-browser'
] as const
export type MenuAction = (typeof MENU_ACTIONS)[number]

/** Payload of each event the main process can send to the renderer. */
export interface RendererEventMap {
  /** A popup from the webview; open it in the same pane. */
  'browser:open-url': [url: string]
  'browser:context-action': [action: ContextAction]
  'menu:action': [action: MenuAction]
  /** The window is closing: flush pending saves, then call app.readyToClose(). */
  'app:before-close': []
}
export type RendererEvent = keyof RendererEventMap

export const RENDERER_EVENTS = [
  'browser:open-url',
  'browser:context-action',
  'menu:action',
  'app:before-close'
] as const satisfies readonly RendererEvent[]

// ─── window.api ────────────────────────────────────────────────────────────

export interface WebAtlasApi {
  workspace: {
    list(): Promise<WorkspaceSummary[]>
    load(id: string): Promise<Workspace>
    save(workspace: Workspace): Promise<void>
    create(input: CreateWorkspaceInput): Promise<Workspace>
    delete(id: string): Promise<void>
    duplicate(id: string): Promise<WorkspaceSummary>
  }
  thumb: {
    /** Saves a PNG data URL; returns its `wa-thumb://…` URL. */
    save(workspaceId: string, nodeId: string, pngDataUrl: string): Promise<string>
  }
  ai: {
    embed(workspaceId: string, items: EmbedItem[]): Promise<Record<string, number[]>>
    /** One-line summary; '' when unavailable (no key, offline, error). */
    summarize(text: string): Promise<string>
    organize(snapshot: BoardSnapshot): Promise<OrganizeResult>
    status(): Promise<AiStatus>
  }
  export: {
    /** Opens a native save dialog; returns the saved path, or null if cancelled. */
    save(format: ExportFormat, content: string, suggestedName: string): Promise<string | null>
  }
  import: {
    /** Opens a native open dialog; returns the new workspace, or null if cancelled. */
    workspace(): Promise<Workspace | null>
    /** Imports the bundled sample workspace as a new workspace. */
    sample(): Promise<Workspace>
  }
  app: {
    /** Tells main the renderer has flushed its saves and the window may close. */
    readyToClose(): void
  }
  /** Subscribes to a main-process event; returns an unsubscribe function. */
  on<E extends RendererEvent>(
    event: E,
    callback: (...args: RendererEventMap[E]) => void
  ): () => void
}

/** Every request/response method of window.api, as "group.method". */
export type ApiMethod = {
  [G in Exclude<keyof WebAtlasApi, 'on'>]: `${G}.${Extract<keyof WebAtlasApi[G], string>}`
}[Exclude<keyof WebAtlasApi, 'on'>]

/** IPC channel for each window.api method (`domain:verb`). */
export const CHANNELS = {
  'workspace.list': 'workspace:list',
  'workspace.load': 'workspace:load',
  'workspace.save': 'workspace:save',
  'workspace.create': 'workspace:create',
  'workspace.delete': 'workspace:delete',
  'workspace.duplicate': 'workspace:duplicate',
  'thumb.save': 'thumb:save',
  'ai.embed': 'ai:embed',
  'ai.summarize': 'ai:summarize',
  'ai.organize': 'ai:organize',
  'ai.status': 'ai:status',
  'export.save': 'export:save',
  'import.workspace': 'import:workspace',
  'import.sample': 'import:sample',
  'app.readyToClose': 'app:ready-to-close'
} as const satisfies Record<ApiMethod, string>

export type Channel = (typeof CHANNELS)[ApiMethod]
