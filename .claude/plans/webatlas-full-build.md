# Feature: WebAtlas — full MVP build (Electron split browser + Obsidian-style research canvas + Organize agent)

The following plan should be complete, but it's important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils, types and models. Import from the right files. This is a **greenfield** repo: at plan time it contains only `webatlas.prd.md`, `webatlas.architecture.md` and `DESIGN.md`. Every "pattern" below is either a decision inherited from those docs or a pattern this plan establishes in an early task that later tasks MIRROR.

## Feature Description

WebAtlas is a Windows desktop app (Electron + React + TypeScript). An embedded Chromium browser (`<webview>`) sits on the left and an Obsidian Canvas-style infinite canvas (React Flow) on the right. While a student browses, pages, videos, PDFs and links are captured onto the canvas as cards. Each card has a thumbnail, favicon, extracted text, a one-line summary, highlights, notes, tags and an automatic "opened from" provenance edge. The student organizes cards with coloured groups and labelled edges, searches everything with Ctrl+K, and switches between graph, focus and list views. Workspaces autosave and resume exactly where the student left off. Boards export to Markdown, JSON and JSON Canvas (`.canvas`, opens in Obsidian). **Organize** embeds pages locally (transformers.js, MiniLM), clusters them, and asks Claude Haiku 4.5 to name clusters and propose typed relationships. It does this through the same command layer the UI uses, and every proposal appears as a dashed **ghost** the student accepts or rejects. Nothing is auto-applied.

## User Story

As a student researching a topic one to three days before a deadline
I want every page, video or resource I open to land on a map with why I opened it and what I took from it, and to have the map suggest its own structure
So that I can see how my research fits together and turn it into a submission without re-finding sources

## Problem Statement

Research done in a browser is a flat, forgetful list of tabs. Canvas and notes tools need manual copy-paste after the fact. Nothing captures structure *while* you browse, and nothing suggests relationships between arbitrary pages that the user stays in control of. The build must also win two judging rounds: Round 1 weighs UI polish, and Round 2 weighs working automatic organization on topics the judge picks. It has to be done in a 6-hour solo build.

## Solution Statement

Build exactly the architecture in `webatlas.architecture.md`:

- **One command layer** (Zustand + immer, hand-written dispatcher) is the only way the board changes. Commands are serialisable `{type, payload}` records with `apply`/`invert`. Undo/redo stores `{command, inverse}`. Ghosts are unapplied commands. Accepting a ghost is a normal, undoable dispatch.
- **Main process = backend**: atomic JSON workspace storage, thumbnails served through a custom protocol, local embeddings, clustering, and the LLM router (Haiku → Groq → offline clusters). All API keys live here.
- **Renderer** is sandboxed, talks only through the typed `window.api`, and drives the `<webview>` from outside with `executeJavaScript` and `capturePage`.
- **UI** uses the DESIGN.md components ported to typed TSX (`components/wa/`), with the DESIGN.md tokens as CSS variables. Tailwind is used for layout only, mapped to the tokens. shadcn supplies behaviour primitives only (Dialog, Command/cmdk, Tooltip, DropdownMenu, Popover), restyled with the tokens.
- **Build order is "tools first, AI second"**, with a runnable checkpoint after every phase.

## Out of Scope / Non-Goals

- Not included: the "Ask the board" chat agent (`ai.chat`). It is a stretch goal, decided at the 5-hour mark, and gets a separate plan if built.
- Not included: packaging or installers (electron-builder), auto-update, code signing. The demo runs with `npm run dev`.
- Not included: grid view, the coach-mark tour, HTML snapshot export, bookmark or pasted-URL import, per-workspace colour and icon, local PDFs from disk, live web previews inside cards (static thumbnails only).
- Not included: *merging* an imported workspace into an existing board. Import always creates a new workspace.
- ~~Not included: automated end-to-end or UI tests.~~ **Superseded 2026-10-01**: unit, component and Playwright end-to-end tests are all in scope. Every task in [webatlas-tasks.md](webatlas-tasks.md) lists its tests and a manual checklist.
- Not included: multi-tab browsing. There is one webview, and popups are redirected into it.
- Not included: nested groups (at most one parent level), and edges to or from groups (only cards connect).
- Not changing: the three design/product docs in the repo root. They are inputs and must not be edited.

## Feature Metadata

**Feature Type**: New Capability (greenfield product)
**Estimated Complexity**: High (broad surface in a 6 h budget; each piece is individually moderate)
**Primary Systems Affected**: Electron main (storage, protocol, menu, AI), preload bridge, renderer (store and command layer, canvas, browser pane, search, views, home)
**Dependencies**: electron + electron-vite, react 18/19, @xyflow/react v12, zustand, immer, fuse.js, cmdk (via shadcn), @mozilla/readability, @huggingface/transformers, @anthropic-ai/sdk, groq-sdk, zod, dotenv, react-resizable-panels, lucide-react, sonner, tailwindcss v4 + @tailwindcss/vite, @fontsource fonts, vitest

## Related Work

**Implements**: `webatlas.prd.md` (MVP steps 1–8) · **Epic / architecture**: `webatlas.architecture.md` (inherited; not re-decided here) · **Design system**: `DESIGN.md`

**Back-references**: none (first plan in the repo).

**Forward-references**:

- (none yet. Expected: `.claude/plans/ask-the-board-chat-agent.md` if the stretch goal is taken)

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

- `webatlas.architecture.md` (whole file, 162 lines) - Why: **binding decisions**: stack, data model (lines 69–78), IPC contract (lines 83–87), security boundaries (lines 81–82), agent tool surface (line 89), spikes and decision rules (lines 123–151). Do not diverge without logging it in Open Questions.
- `webatlas.prd.md` lines 72–119 - Why: MVP script (the acceptance path) and the Obsidian Canvas interaction table (lines 95–106) that the canvas must reproduce.
- `DESIGN.md` §1 lines 19–62 - Why: content rules (sentence case, no emoji, no "!", "(suggested)" on ghosts, verbs for edge labels) and screen-building rules.
- `DESIGN.md` §2 lines 66–168 - Why: every colour, type, spacing, radius and shadow token, light **and** dark. `tokens.css` is transcribed from these tables verbatim.
- `DESIGN.md` Appendix A lines 456–543 - Why: `bundle.css`. Port it verbatim into `src/renderer/src/styles/wa.css` (drop its Google Fonts `@import`; fonts are bundled locally).
- `DESIGN.md` Appendix B lines 545–726 - Why: reference implementation of every component. Port each `function X(p)` to a typed TSX component with the same markup and class names.
- `DESIGN.md` Appendix C lines 728–748 - Why: the prop types for the ported components.

### New Files to Create

Directory layout follows the electron-vite `react-ts` template (`src/main`, `src/preload`, `src/renderer`) plus a `src/shared` folder imported by all three.

```
.env.example                              # ANTHROPIC_API_KEY=, GROQ_API_KEY=, GROQ_MODEL=, GROQ_ORGANIZE_MODEL=
vitest.config.ts
components.json                           # shadcn config
resources/sample/sample.webatlas.json     # sample workspace (placeholder first, real one in Phase 7)
src/shared/types.ts                       # Workspace, CanvasNode, Group, Edge, Ghost, Command, Session, BoardSnapshot…
src/shared/schema.ts                      # zod schemas for workspace files + organize tool inputs
src/shared/api.ts                         # WebAtlasApi interface (window.api) + IPC channel names
src/shared/kind.ts                        # detectKind(url, contentType), normalizeUrl(url), hostOf(url)
src/shared/kind.test.ts
src/shared/export/markdown.ts
src/shared/export/jsonCanvas.ts
src/shared/export/geometry.ts             # absolutePosition(node, groups)
src/shared/export/export.test.ts
src/main/index.ts                         # window, protocol, menu, webview hardening, close-flush (REPLACES template)
src/main/env.ts                           # dotenv load + key presence
src/main/ipc.ts                           # registers every ipcMain.handle
src/main/storage/paths.ts
src/main/storage/atomicWrite.ts
src/main/storage/atomicWrite.test.ts
src/main/storage/workspaceStore.ts        # list/load/save/create/delete/duplicate/import + index.json
src/main/thumbs.ts                        # thumb.save + wa-thumb:// protocol handler
src/main/exportImport.ts                  # export.save (native dialog), import.workspace, import.sample
src/main/menu.ts                          # accelerators Alt+A, Alt+H, Ctrl+K, Ctrl+L → 'menu:action'
src/main/ai/embed.ts                      # transformers.js pipeline + embeddings.json cache
src/main/ai/cluster.ts                    # agglomerative clustering + candidate edges (pure)
src/main/ai/cluster.test.ts
src/main/ai/summarize.ts                  # Groq one-liner
src/main/ai/tools.ts                      # strict tool schemas + toolCall → Ghost mapping (pure)
src/main/ai/tools.test.ts
src/main/ai/prompt.ts                     # system prompt + snapshot → user message
src/main/ai/organize.ts                   # router: haiku loop → groq loop → offline clusters
src/preload/index.ts                      # REPLACES template: contextBridge.exposeInMainWorld('api', …)
src/preload/index.d.ts                    # declare global { interface Window { api: WebAtlasApi } }
src/renderer/index.html                   # CSP update
src/renderer/src/main.tsx
src/renderer/src/App.tsx                  # screen router: home | workspace
src/renderer/src/styles/tokens.css
src/renderer/src/styles/wa.css
src/renderer/src/styles/globals.css       # tailwind v4 + @theme inline mapping to tokens + fonts
src/renderer/src/lib/utils.ts             # cn() (shadcn)
src/renderer/src/lib/theme.ts             # prefers-color-scheme → data-theme
src/renderer/src/components/ui/*          # shadcn: dialog, command, tooltip, dropdown-menu, popover, sonner
src/renderer/src/components/wa/{Icon,Button,TagChip,NodeCardView,NoteCardView,QuestionCardView,GroupFrameView,GhostSuggestion,SelectionToolbarView,CaptureBar,ViewSwitcher,WorkspaceCard}.tsx
src/renderer/src/store/commands/registry.ts   # CommandDef map, applyCommand, invertCommand
src/renderer/src/store/commands/nodes.ts
src/renderer/src/store/commands/edges.ts
src/renderer/src/store/commands/groups.ts
src/renderer/src/store/commands/ghosts.ts
src/renderer/src/store/commands/commands.test.ts
src/renderer/src/store/boardStore.ts          # zustand: board, past, future, dispatch, undo, redo, silent ops
src/renderer/src/store/actions.ts             # action creators: compute payloads from state, then dispatch
src/renderer/src/store/appStore.ts            # screen, current workspace meta, session, ui flags
src/renderer/src/store/persistence.ts         # debounced autosave + flush
src/renderer/src/features/home/{Home,Welcome,NewWorkspaceDialog}.tsx
src/renderer/src/features/workspace/WorkspaceScreen.tsx   # split layout + top bar + side panel
src/renderer/src/features/browser/{BrowserPane,webviewScripts,useCapture,useProvenance}.ts(x)
src/renderer/src/features/canvas/{CanvasView,useFlowSync,placement,keyboard,SelectionToolbar,EdgeEditor}.tsx/ts
src/renderer/src/features/canvas/nodes/{WebNode,NoteNode,QuestionNode,GroupNode,GhostGroupNode}.tsx
src/renderer/src/features/canvas/edges/LabeledEdge.tsx
src/renderer/src/features/inspector/Inspector.tsx
src/renderer/src/features/search/{CommandPalette,searchIndex}.ts(x)
src/renderer/src/features/search/searchIndex.test.ts
src/renderer/src/features/views/{focus.ts,ListView.tsx}
src/renderer/src/features/ai/{OrganizeButton,SuggestionsPanel,ghostsToFlow}.ts(x)
src/renderer/src/features/export/ExportMenu.tsx
src/renderer/src/features/onboarding/HintOverlay.tsx
```

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING!

- [electron-vite getting started](https://electron-vite.org/guide/) · [Dependency handling / externalizeDepsPlugin](https://electron-vite.org/guide/dependency-handling)
  - Why: scaffold, script names, how main-process deps (transformers.js, SDKs) stay external.
- [Electron `<webview>` tag](https://www.electronjs.org/docs/latest/api/webview-tag) (sections: `capturePage`, `executeJavaScript`, `dom-ready`, `did-navigate`, `did-navigate-in-page`, `page-title-updated`, `page-favicon-updated`, `partition`, `allowpopups`)
  - Why: every browser-pane capability.
- [Electron security: verify webview options before creation](https://www.electronjs.org/docs/latest/tutorial/security#12-verify-webview-options-before-creation) (`will-attach-webview`)
  - Why: strip preload and force isolation on the guest.
- [`webContents.setWindowOpenHandler`](https://www.electronjs.org/docs/latest/api/web-contents#contentssetwindowopenhandlerhandler)
  - Why: **the webview `new-window` event named in the architecture was removed in Electron 22.** Popups are caught in main and forwarded to the renderer.
- [`protocol.handle`](https://www.electronjs.org/docs/latest/api/protocol#protocolhandlescheme-handler) + [`registerSchemesAsPrivileged`](https://www.electronjs.org/docs/latest/api/protocol#protocolregisterschemesasprivilegedcustomschemes)
  - Why: serve thumbnails to the sandboxed renderer as `wa-thumb://…`.
- [Menu accelerators](https://www.electronjs.org/docs/latest/api/menu) and [`context-menu` event](https://www.electronjs.org/docs/latest/api/web-contents#event-context-menu)
  - Why: hotkeys must work while focus is inside the webview (renderer keydown never sees those keys), and the right-click "Add highlight / Add link to canvas" items.
- [React Flow v12: custom nodes](https://reactflow.dev/learn/customization/custom-nodes) · [Sub flows / parentId](https://reactflow.dev/learn/layouting/sub-flows) · [NodeResizer](https://reactflow.dev/api-reference/components/node-resizer) · [NodeToolbar](https://reactflow.dev/api-reference/components/node-toolbar) · [Custom edges + EdgeLabelRenderer](https://reactflow.dev/learn/customization/custom-edges) · [useReactFlow (setCenter, fitView, getIntersectingNodes, screenToFlowPosition)](https://reactflow.dev/api-reference/hooks/use-react-flow)
  - Why: all canvas mechanics. **Parents must precede children in the nodes array. Child positions are relative to the parent.**
- [transformers.js v3 pipelines](https://huggingface.co/docs/transformers.js/pipelines) · [env.cacheDir](https://huggingface.co/docs/transformers.js/api/env) · model `Xenova/all-MiniLM-L6-v2`
  - Why: `pipeline('feature-extraction', …, { dtype: 'q8' })`, `{ pooling: 'mean', normalize: true }`.
- Anthropic TS SDK tool use (verified from the claude-api skill, current as of 2026-09): `strict: true` is a **top-level field on the tool definition**, GA, **no beta header**. The schema must set `additionalProperties: false` and list every property in `required`. Use the manual loop over `client.messages.create`, with `stop_reason` checks. Return **all** `tool_result` blocks in **one** user message, with `is_error: true` for failures. Parse inputs as objects, never with string matching. Use SDK types `Anthropic.Tool`, `Anthropic.MessageParam`, `Anthropic.ToolUseBlock`, `Anthropic.ToolResultBlockParam`. Model id: `claude-haiku-4-5` (use exactly this string, with no date suffix). Do not send `thinking` (not needed) and do not send `effort` (errors on Haiku 4.5).
- [Groq tool use (OpenAI-compatible)](https://console.groq.com/docs/tool-use) · [groq-sdk](https://github.com/groq/groq-typescript)
  - Why: summaries plus the Organize fallback loop.
- [JSON Canvas spec 1.0](https://jsoncanvas.org/spec/1.0/)
  - Why: `.canvas` exporter (node types `text|link|group`, edges `fromNode/toNode/label/toEnd`, colours `"1"`–`"6"` or hex).
- [shadcn/ui Tailwind v4 install](https://ui.shadcn.com/docs/tailwind-v4) · [Command](https://ui.shadcn.com/docs/components/command)
  - Why: behaviour primitives only.
- [Fuse.js options](https://www.fusejs.io/api/options.html) (`keys` weights, `includeMatches`, `threshold`, `ignoreLocation`)
- [@mozilla/readability](https://github.com/mozilla/readability#usage) (usage on a cloned `document`)

### Patterns to Follow

This is greenfield, so the following patterns are **established by this plan** and every task must use them.

**Naming conventions**
- Files: React components `PascalCase.tsx`. Hooks and modules `camelCase.ts`. Tests sit beside the file as `*.test.ts`.
- Types: `PascalCase`. The canvas card type is `CanvasNode` (not `Node`, which clashes with the DOM `Node` and React Flow's `Node`). Import React Flow's type as `import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react'`.
- Command types: `camelCase` verbs: `addNodes`, `removeNodes`, `updateNode`, `moveItems`, `resizeItem`, `addTags`, `removeTag`, `addHighlight`, `removeHighlight`, `addComment`, `connect`, `disconnect`, `updateEdge`, `createGroup`, `updateGroup`, `removeGroup`, `setParent`, `removeGhosts`, `restoreGhosts`, `batch`.
- IPC channels: `domain:verb`, for example `workspace:list`, `thumb:save`, `ai:organize`. Renderer events are `browser:open-url`, `browser:context-action`, `menu:action`, `app:before-close`.
- CSS: DESIGN.md component classes keep their `wa-*` names. Tailwind utilities are used only for layout (flex, grid, gap, sizing), with token-mapped colour names (`bg-surface`, `text-ink-muted`, `border-line`).

**Command pattern (the core, used everywhere)**
```ts
// src/shared/types.ts
export type Command =
  | { type: 'addNodes'; payload: { nodes: CanvasNode[] } }
  | { type: 'updateNode'; payload: { id: string; patch: Partial<CanvasNode> } }
  | { type: 'batch'; payload: { commands: Command[] } }
  | /* … one variant per command type */;

// src/renderer/src/store/commands/registry.ts
export interface CommandDef<C extends Command> {
  // Must be deterministic in (state, payload). NO Date.now(), NO randomUUID() in here:
  // ids and timestamps are generated by action creators and carried in payload so redo replays identically.
  apply(draft: Board, payload: C['payload']): void          // mutates an immer draft
  invert(before: Board, payload: C['payload']): Command      // computed from state BEFORE apply
  canApply?(state: Board, payload: C['payload']): boolean    // used to drop stale ghosts
}
```
- `boardStore.dispatch(cmd)`: `const inverse = invertCommand(state.board, cmd); const board = produce(state.board, d => applyCommand(d, cmd)); past.push({command: cmd, inverse}); future = []`.
- `undo()`: pop from `past`, apply `inverse` (without recording), push to `future`. `redo()`: pop from `future`, re-dispatch `command` (this recomputes the inverse).
- Components **never** call `dispatch` with hand-built payloads. They call action creators in `store/actions.ts`, which read state, generate ids and timestamps, and dispatch.
- Non-user system updates (summary arriving late, thumbnail path, ghost list replaced by Organize) use `patchSilently(recipe)` or `setGhosts(list)`. These change the board **without** a history entry.

**Error handling**
- Main IPC handlers never throw raw errors to the renderer for expected failures. Return typed results (`OrganizeResult` carries `mode` and `message`), and only let unexpected errors reject. Main logs with `console.error('[area]', err)`.
- Renderer shows expected failures as `sonner` toasts in DESIGN.md voice: short, sentence case, no "!". For example: "Couldn't reach the AI service. Showing unnamed groups from your pages."
- Webview calls (`executeJavaScript`, `capturePage`) are each wrapped in `try/catch` with a fallback value. A capture must still create a card even if text, thumbnail or summary fails.

**Logging**
- `console.info('[capture]', …)`, `console.info('[organize]', { mode, clusters, ghosts, ms })`. Tag every log with a bracketed area. No logging library.
- **Never log API keys or full page text.**

**DESIGN.md porting rule**
- Port the markup and classes 1:1 from Appendix B into TSX, typed with the Appendix C props. The only changes: `onClick`/callback props get wired, `Icon` renders `lucide-react` icons (mapping below, `strokeWidth={1.75}`), and components used as React Flow nodes receive data from `NodeProps`.
- Icon map: globe→`Globe`, play→`Play` (with `fill="currentColor"`), file→`FileText`, note→`StickyNote`, compass→`Compass`, search→`Search`, plus→`Plus`, check→`Check`, x→`X`, link→`Link2`, trash→`Trash2`, tag→`Tag`, graph→`Share2`, focus→`Focus`, list→`List`, palette→`Palette`, zoom→`ZoomIn`, arrow→`ArrowRight`, clock→`Clock`.

---

## IMPLEMENTATION PLAN

Phases run top to bottom. Each phase ends with a **runnable checkpoint** (`npm run dev` works and the listed behaviour is visible). The time targets come from the architecture doc's budget.

### Phase 0: Scaffold and the two early spikes (target 0:45)

Scaffold electron-vite, add dependencies, and harden the window. Run **spike 1** (webview capabilities) and **spike 2** (transformers.js in main) within the first 45 minutes, and apply their decision rules.

### Phase 1: Shared types and the command layer (target 0:30)

**Depends on:** Phase 0 (project exists)
**Independent of:** Phase 2 (main storage). Phases 1 and 2 can run in parallel.

Types, zod schemas, every command's apply and invert, the store, and unit tests. Nothing visual.

### Phase 2: Main-process storage, thumbnails, IPC and preload (target 0:25)

**Depends on:** Phase 0, and `src/shared/types.ts` + `api.ts` (Task 1.1). Do Task 1.1 first, then Phases 1 and 2 can proceed in parallel.

Atomic workspace persistence, `index.json`, the `wa-thumb://` protocol, the typed preload bridge, the close-flush handshake.

### Phase 3: Design system port, app shell, home and workspace screen (target 0:30)

**Depends on:** Phases 1 and 2

Tokens and fonts, the `wa` components, the home/welcome screen, the new-workspace dialog, the split layout with a (still plain) webview, autosave and resume.

### Phase 4: Canvas (target 1:00)

**Depends on:** Phase 3

React Flow wired to the store: question, web, note and group nodes, labelled edges, selection toolbar, keyboard, grouping by drag, undo and redo.

### Phase 5: Browser pane and capture pipeline (target 1:00)

**Depends on:** Phase 4 (capture dispatches into the canvas)

CaptureBar, navigation, manual and auto capture, provenance edges, thumbnails, resource kinds, highlights, the context menu, link drag-drop, Groq summaries.

### Phase 6: Inspector, search, views (target 0:45)

**Depends on:** Phase 4
**Independent of:** Phase 5, except for manual testing with real captured data.

The side-panel inspector (note, tags, highlights, comments), Ctrl+K, focus view, list view.

### Phase 7: Export, import, sample workspace, onboarding (target 0:30)

**Depends on:** Phases 5 and 6. The exporters themselves (Task 7.1) are pure and **independent**, so they can be written any time after Task 1.1.

### Phase 8: Organize (embeddings, clustering, Haiku agent, ghosts) (target 1:00)

**Depends on:** Phase 4 (ghost rendering) and Phase 5 (captured text). Tasks 8.1–8.4 (main-side AI) are **independent** of Phases 3–7 and can be built in parallel after Task 1.1.

Starts with **spike 3** (quality on unseen topics) and applies its decision rule.

### Phase 9: Polish and rehearsal (target 0:30)

The visual pass, dark-mode check, demo-script rehearsal three times in a row.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable. The standard validation trio used below:
- `TC` = `npm run typecheck`
- `LINT` = `npm run lint`
- `BUILD` = `npm run build` (electron-vite build of main, preload and renderer; catches import and bundling errors without launching)

---

### Phase 0 — Scaffold and spikes

#### Task 0.1 CREATE project scaffold (electron-vite react-ts) in the repo root

- **IMPLEMENT**:
  1. `npm create @quick-start/electron@latest _scaffold -- --template react-ts --skip`. If it still prompts, answer No to the updater plugin and No to the download mirror.
  2. Move every file from `_scaffold/` into the repo root, except `.git`. Keep the existing `*.md` docs. Delete `_scaffold/`.
  3. Set `"name": "webatlas"` in `package.json`, then `npm install`.
  4. Add to `.gitignore`: `.env`, `out/`, `dist/`, `node_modules/`.
  5. Create `.env.example` with empty `ANTHROPIC_API_KEY=`, `GROQ_API_KEY=`, `GROQ_MODEL=llama-3.1-8b-instant`, `GROQ_ORGANIZE_MODEL=llama-3.3-70b-versatile`.
- **GOTCHA**: The template's `src/main/index.ts` sets `sandbox: false` and its preload uses `@electron-toolkit/preload`. Both get replaced in Task 0.3 and Task 2.4. Keep `@electron-toolkit/utils` (it provides `is.dev` and `optimizer`).
- **VALIDATE**: `npm run typecheck && npm run build`
- **SATISFIES**: AC-infra

#### Task 0.2 ADD dependencies

- **IMPLEMENT**:
  - `npm i @xyflow/react zustand immer fuse.js @mozilla/readability @huggingface/transformers @anthropic-ai/sdk groq-sdk zod dotenv react-resizable-panels lucide-react sonner cmdk clsx tailwind-merge class-variance-authority @fontsource-variable/fraunces @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono`
  - `npm i -D tailwindcss @tailwindcss/vite vitest`
  - Add scripts `"test": "vitest run"` and `"test:watch": "vitest"`.
  - Create `vitest.config.ts` with `test.environment = 'node'`, `include: ['src/**/*.test.ts']`, and alias `@renderer` → `src/renderer/src`, `@shared` → `src/shared`.
  - Add the `@shared` alias to `electron.vite.config.ts` for main, preload and renderer, and add `paths` for it in `tsconfig.node.json` and `tsconfig.web.json`. Make sure both tsconfigs `include` `src/shared/**/*`.
  - Add `tailwindcss()` from `@tailwindcss/vite` to the renderer plugins in `electron.vite.config.ts`.
- **GOTCHA**: Keep `externalizeDepsPlugin()` on main and preload. transformers.js and onnxruntime-node must **not** be bundled into main. transformers.js pulls in `sharp` for images. It has Windows prebuilds; if `npm i` fails on sharp, retry with `npm i --include=optional sharp`.
- **VALIDATE**: `npm run typecheck && npm run build && npx vitest run --passWithNoTests`
- **SATISFIES**: AC-infra

#### Task 0.3 UPDATE `src/main/index.ts`: hardened window, webview enabled, dev-only spike harness

- **IMPLEMENT**:
  - `BrowserWindow({ width: 1440, height: 900, show: false, autoHideMenuBar: true, backgroundColor: '#f3efe6', webPreferences: { preload, sandbox: true, contextIsolation: true, nodeIntegration: false, webviewTag: true } })`.
  - Add `mainWindow.webContents.on('will-attach-webview', (_e, wp, params) => { delete wp.preload; wp.nodeIntegration = false; wp.contextIsolation = true; wp.sandbox = true; if (!params.partition?.startsWith('persist:webatlas')) params.partition = 'persist:webatlas-browse' })`.
  - Add `app.on('web-contents-created', (_e, wc) => { if (wc.getType() === 'webview') wc.setWindowOpenHandler(({ url }) => { mainWindow?.webContents.send('browser:open-url', url); return { action: 'deny' } }) })`.
  - Update the CSP in `src/renderer/index.html` to: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: wa-thumb:; font-src 'self' data:; connect-src 'self' wa-thumb:`.
- **GOTCHA**: Do **not** use the webview `new-window` event from the architecture doc. It no longer exists in current Electron, so the `setWindowOpenHandler` above replaces it. The same `web-contents-created` hook is reused in Task 5.4 for the context menu.
- **VALIDATE**: `npm run typecheck && npm run build`
- **SATISFIES**: AC-security

#### Task 0.4 SPIKE 1: webview capabilities (timebox 20 min; throwaway code)

- **IMPLEMENT**:
  - In `App.tsx` temporarily render `<webview src="https://en.wikipedia.org/wiki/Climate_change_adaptation" partition="persist:webatlas-browse" allowpopups style={{width:'100%',height:'100%'}} />`, plus buttons that, after `dom-ready`:
    - log `did-navigate`, `did-navigate-in-page` and `page-favicon-updated`
    - call `capturePage()` and show `img.resize({width:520}).toDataURL()` in an `<img>`
    - run `executeJavaScript` to read the title, `og:image`, `document.contentType` and `getSelection().toString()`
    - inject the Readability source (via `import src from '@mozilla/readability/Readability.js?raw'`) and log `textContent.length`
  - Try Wikipedia, arXiv (an abs page and a PDF), YouTube, and one news site.
  - Add `// @ts-expect-error` or a JSX declaration for `webview` if TS complains (Electron ships `Electron.WebviewTag`). Declare it in `src/renderer/src/env.d.ts`: `declare global { namespace JSX { interface IntrinsicElements { webview: React.DetailedHTMLProps<React.HTMLAttributes<Electron.WebviewTag>, Electron.WebviewTag> & { src?: string; partition?: string; allowpopups?: string } } } }`.
- **Decision rule (architecture doc)**:
  - Everything works → proceed.
  - One site misbehaves → drop it from the demo script and note it in Open Questions.
  - The core APIs fail → switch to `WebContentsView` (+1 h, and cut the list view). **Stop and tell the user** before switching.
- **GOTCHA**:
  - Any webview method called before `dom-ready` throws.
  - `allowpopups` must be the string `"true"` in React, not a boolean, or React strips it.
  - Do not bind `src` to changing React state later. After the first mount, navigate with `webview.loadURL()`.
- **VALIDATE**: manual, via `npm run dev`. Record the results in the plan's AMENDMENTS section, then remove the spike UI.
- **SATISFIES**: AC-3 (capture feasibility)

#### Task 0.5 SPIKE 2: transformers.js in main (timebox 20 min)

- **IMPLEMENT**:
  - In main, behind `if (is.dev && process.env.WA_SPIKE_EMBED)`, dynamically import `@huggingface/transformers`.
  - Set `env.cacheDir = join(app.getPath('userData'), 'models')`.
  - Create `pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' })` and embed 3 strings (two about sea walls, one about pasta) with `{ pooling: 'mean', normalize: true }`.
  - Log the pairwise dot products. The related pair should score well above the unrelated one.
  - Run with `$env:WA_SPIKE_EMBED='1'; npm run dev` (PowerShell).
- **Decision rule**:
  - Works → keep embeddings in main (Task 8.1 as written).
  - Native-module or ABI error → move `embed.ts` into a hidden `BrowserWindow` renderer or worker using the WASM backend (`device: 'wasm'`) and call it over IPC.
  - Both fail → skip embeddings entirely and have Haiku cluster from titles and summaries (Task 8.4's offline path then groups by domain and tag).
  - Record the outcome in AMENDMENTS.
- **GOTCHA**:
  - **Use a dynamic `await import()`**. A static import can break main's CJS bundle, and it would also slow down startup.
  - The first run downloads about 23 MB. Pre-warm it once before the demo so the venue network isn't needed.
- **VALIDATE**: Log shows 3 similarities within 20 s of launch.
- **SATISFIES**: AC-7 feasibility

---

### Phase 1 — Shared types and command layer

#### Task 1.1 CREATE `src/shared/types.ts` and `src/shared/api.ts`

- **IMPLEMENT** (field names exactly as in `webatlas.architecture.md` lines 70–76):
  ```ts
  export type Cat = 'rose' | 'amber' | 'moss' | 'teal' | 'blue' | 'plum'
  export type NodeKind = 'webpage' | 'video' | 'pdf' | 'note' | 'question'
  export type Relation = 'opened-from' | 'related' | 'supports' | 'contradicts' | 'answers' | 'source-of' | 'custom'
  export type GroupCategory = 'topic' | 'source' | 'importance' | 'custom'
  export interface XY { x: number; y: number }
  export interface Size { w: number; h: number }
  export interface Highlight { id: string; quote: string; createdAt: number }
  export interface Comment { id: string; text: string; createdAt: number }
  export interface CanvasNode { id: string; kind: NodeKind; url?: string; title: string; faviconUrl?: string;
    thumbnailPath?: string /* wa-thumb:// url */; summary?: string; text?: string; highlights: Highlight[];
    note: string; comments: Comment[]; tags: string[]; color?: Cat; position: XY /* relative to parent if parentGroupId */;
    size?: Size; parentGroupId?: string; capturedFromNodeId?: string; capturedAt: number }
  export interface Group { id: string; label: string; color: Cat; category: GroupCategory; position: XY; size: Size; note: string; comments: Comment[] }
  export interface Edge { id: string; source: string; target: string; label?: string; relation: Relation; color?: Cat; origin: 'provenance' | 'user' | 'ai' }
  export interface Ghost { id: string; command: Command; rationale: string; confidence: number; kind: 'group' | 'edge' | 'tag'; title: string }
  export interface Board { nodes: Record<string, CanvasNode>; groups: Record<string, Group>; edges: Record<string, Edge>; ghosts: Record<string, Ghost> }
  export type ViewMode = 'graph' | 'focus' | 'list'
  export interface Session { viewport: { x: number; y: number; zoom: number }; selectedIds: string[]; browserUrl: string; viewMode: ViewMode; captureMode: 'manual' | 'auto' }
  export interface Workspace { version: 1; id: string; name: string; researchQuestion?: string; createdAt: number; updatedAt: number; session: Session; board: Board }
  export interface WorkspaceSummary { id: string; name: string; researchQuestion?: string; updatedAt: number; nodeCount: number; groupCount: number; coverThumb?: string }
  export interface BoardSnapshot { workspaceId: string; researchQuestion?: string; questionNodeId: string;
    nodes: { id: string; kind: NodeKind; title: string; url?: string; summary?: string; text?: string; tags: string[]; note: string; highlights: string[]; groupId?: string }[];
    groups: { id: string; label: string; memberIds: string[] }[]; edges: { source: string; target: string; relation: Relation }[] }
  export interface OrganizeResult { ghosts: Ghost[]; mode: 'haiku' | 'groq' | 'offline'; message?: string }
  export type Command = /* full discriminated union: see the Patterns section; one variant per command in Task 1.3 */
  ```
  `api.ts` defines the `WebAtlasApi` interface (the IPC contract in the architecture doc, lines 84–87):
  - `workspace.{list, load(id), save(ws), create({name, researchQuestion?}), delete(id), duplicate(id)}`
  - `thumb.save(workspaceId, nodeId, pngDataUrl) → Promise<string>`
  - `ai.{embed(workspaceId, items), summarize(text), organize(snapshot) → OrganizeResult, status() → {anthropic, groq}}`
  - `export.save(format: 'md'|'json'|'canvas', content, suggestedName) → Promise<string|null>`
  - `import.{workspace() → Promise<Workspace|null>, sample() → Promise<Workspace>}`
  - `app.readyToClose()`
  - `on(channel: RendererEvent, cb) → unsubscribe`

  Also export the `CHANNELS` constant map and `type RendererEvent = 'browser:open-url' | 'browser:context-action' | 'menu:action' | 'app:before-close'`.
- **GOTCHA**:
  - `thumb.save` takes an explicit `workspaceId` (the architecture sketch says `thumb.save(nodeId, …)`). This is a signature refinement, not a boundary change, and it is logged in Open Questions.
  - The four renderer events and `app.readyToClose` / `ai.status` are small additions needed for webview popups, hotkeys and safe close.
- **VALIDATE**: `npm run typecheck`
- **SATISFIES**: AC-infra, AC-8

#### Task 1.2 CREATE `src/shared/schema.ts` (zod) and `src/shared/kind.ts` + tests

- **IMPLEMENT**:
  - zod `WorkspaceSchema` mirroring `Workspace`, with `.passthrough()` avoided. Use `z.infer` only for validation and keep the `types.ts` interfaces as the source of truth. Export `WorkspaceFileSchema = z.object({ format: z.literal('webatlas'), version: z.literal(1), workspace: WorkspaceSchema, thumbs: z.record(z.string()).optional() })`.
  - `detectKind(url, contentType?)`:
    - youtube.com/watch, youtu.be/, vimeo.com/\d → `video`
    - `.pdf` path (case-insensitive, ignoring the query) or `application/pdf` → `pdf`
    - otherwise → `webpage`
  - `normalizeUrl(url)`: lowercase the host, drop the `#hash`, drop `utm_*` params, drop the trailing `/`. Keep `v=` for YouTube.
  - `hostOf(url)`: return the host.
- **VALIDATE**: `npx vitest run src/shared/kind.test.ts` (cases: YouTube watch, youtu.be, Vimeo, arXiv PDF with a query, `application/pdf` on an extensionless URL, Wikipedia, utm stripping, hash stripping)
- **SATISFIES**: AC-3 (resource kinds), AC-infra

#### Task 1.3 CREATE command layer: `store/commands/{registry,nodes,edges,groups,ghosts}.ts`

- **IMPLEMENT**: One `CommandDef` per type (see the Patterns section). Semantics:
  - `addNodes{nodes}`: inserts. Inverse: `removeNodes{ids}`.
  - `removeNodes{ids}`: skips `kind === 'question'` (it can never be deleted). Cascades by removing connected edges and ghosts that reference the ids. Inverse: `batch[addNodes{removed nodes}, connect×{removed edges}, restoreGhosts{removed ghosts}]`.
  - `updateNode{id, patch}`: inverse is `updateNode{id, prevValuesOfPatchedKeys}`, where `undefined` values mean delete the key.
  - `moveItems{moves:[{id, to}]}`: works for node **or** group ids. Inverse uses the prior positions.
  - `resizeItem{id, size}`: works for a node or a group. Inverse restores the prior size (or `undefined`).
  - `addTags{nodeIds, tag}`: tags are lowercased and trimmed, with no duplicates. Inverse: `removeTag` only for the nodes that lacked the tag. `removeTag{nodeIds, tag}` is symmetric.
  - `addHighlight{nodeId, highlight}` / `removeHighlight{nodeId, highlightId}` are inverses of each other. `addComment{targetId, comment}` works on a node or a group, and its inverse removes it.
  - `connect{edge}`: no-op if the source or target is missing or an identical `source+target+relation` edge exists. Inverse: `disconnect{ids:[edge.id]}`. `disconnect{ids}`: inverse re-connects each removed edge. `updateEdge{id, patch}`: prev-values inverse.
  - `createGroup{group, memberIds}`, where `group` has id, label, color and category **without** position or size. `apply` computes the layout deterministically from state:
    1. Take the absolute bbox of the members.
    2. Place the group at `(minX-32, minY-64)`.
    3. Pack the members in a grid: `cols = ceil(sqrt(n))`, cell `292×(maxMemberHeight+32)` where member height = `size?.h ?? 240`, 32 px padding.
    4. Set each member's `parentGroupId` and its position relative to the group.
    5. Compute the group size from the grid.
    Inverse: `batch[setParent back to previous parents with previous positions, removeGroup{id}]`. Build the inverse exactly as the prior state.
  - `removeGroup{id}`: un-parents the members, converting relative → absolute. Inverse: `batch[restore the group record, setParent members with their old relative positions]`.
  - `updateGroup{id, patch}`: prev-values inverse.
  - `setParent{items:[{id, groupId|null, position}]}`: sets the parent and position together, with the payload carrying the already-converted position. Inverse uses the prior parent and position.
  - `removeGhosts{ids}`: inverse `restoreGhosts{ghosts}`, and vice versa.
  - `batch{commands}`: apply in order. Inverse is `batch` of the inverses in **reverse** order. Compute each sub-inverse against the state *after* the previous sub-commands. Implement this by applying to a scratch `produce` sequentially.
  - `canApply` for ghosts: every referenced node id exists.
- **GOTCHA**:
  - **Determinism**: no `Date.now()` or `crypto.randomUUID()` inside `apply` or `invert`. Action creators supply ids and times.
  - React Flow child positions are relative to the parent, so the store keeps the same convention. Use one helper for conversion, `absolutePosition(nodeOrGroup, board)` in `src/shared/export/geometry.ts` (shared with the exporters).
- **VALIDATE**: `npm run typecheck`
- **SATISFIES**: AC-4 (undo covers everything), AC-7 (ghost accept is undoable)

#### Task 1.4 CREATE `store/boardStore.ts` and `store/actions.ts`

- **IMPLEMENT**:
  - zustand store `{ board, past: {command, inverse}[] (cap 200), future: Command[], dispatch, undo, redo, canUndo, canRedo, load(board) (clears history), patchSilently(recipe:(d: Board)=>void), setGhosts(ghosts: Ghost[]) }`. Use `immer`'s `produce` directly (not the zustand immer middleware), so the store holds plain frozen objects.
  - `actions.ts` exports plain functions that read `useBoardStore.getState()`, build payloads (ids via `crypto.randomUUID()`, `Date.now()`), and dispatch:
    - `addNoteAt(pos)`, `deleteSelection(ids)`, `moveCommitted(moves)`, `resizeCommitted(id, size)`, `setColor(ids, cat)`, `tagItems(ids, tag)`, `untag`
    - `addHighlight(nodeId, quote)`, `addComment(targetId, text)`, `connectNodes(source, target, relation='related', origin='user')`, `setEdgeRelation(id, relation, label?)`
    - `groupSelection(ids, label)`, `ungroup(id)`, `dropIntoGroup(nodeIds, groupId|null)` (converts coordinates, then dispatches `setParent`)
    - `acceptGhost(id)` → `batch[ghost.command, removeGhosts{[id]}]`, with `origin: 'ai'` forced on edges and `color` defaulted for groups
    - `rejectGhost(id)` → `removeGhosts`, `acceptAllGhosts()`, `rejectAllGhosts()`
    - `updateQuestion(text)` → `updateNode` on the question node, plus updating the app store's `researchQuestion`
  - Default group colours by category: topic→teal, source→blue, importance→rose, custom→moss.
- **PATTERN**: the command pattern in the Patterns section.
- **VALIDATE**: `npm run typecheck`
- **SATISFIES**: AC-4, AC-7

#### Task 1.5 CREATE `store/commands/commands.test.ts`

- **IMPLEMENT**: Build a fixture board (question node, 3 web nodes, 1 note, 1 edge). For **every** command type, assert that `apply` then `apply(inverse)` deep-equals the original board (the round-trip property). Also test:
  - the question node can't be removed
  - `removeNodes` cascades edges and ghosts and undo restores them
  - `createGroup` packs members and undo restores the exact positions and parents
  - `batch` inverse ordering
  - `acceptGhost` then `undo` restores the ghost and removes the edge
  - `redo` after `undo` produces an identical board (determinism)
  - `connect` duplicate is a no-op
- **VALIDATE**: `npx vitest run src/renderer/src/store`
- **SATISFIES**: AC-4, AC-7, AC-tests

---

### Phase 2 — Main storage, thumbnails, IPC, preload

#### Task 2.1 CREATE `src/main/storage/{paths,atomicWrite}.ts` + test

- **IMPLEMENT**:
  - `paths.ts`: `root = join(app.getPath('userData'), 'workspaces')`, `wsDir(id)`, `wsFile(id)`, `embFile(id)`, `thumbDir(id)`, `thumbFile(id, nodeId)`, `indexFile`. Validate every id with `/^[A-Za-z0-9-]{1,64}$/` and throw otherwise (path-traversal guard).
  - `atomicWrite(file, data)`: `mkdir -p` the dir, write `file + '.tmp-' + process.pid`, then `fs.rename` over the target. On a Windows `EPERM`/`EBUSY`, retry up to 5 times with a 40 ms backoff. Serialise writes per file with an in-memory promise chain (`Map<file, Promise>`), so two saves never race.
- **GOTCHA**: Make `paths.ts` take the root through an `initPaths(root)` call so tests can pass a temp dir without importing `electron`.
- **VALIDATE**: `npx vitest run src/main/storage` (test: 20 concurrent writes → the final content is the last one and no `.tmp-*` files are left behind)
- **SATISFIES**: AC-8 (resume, no corruption)

#### Task 2.2 CREATE `src/main/storage/workspaceStore.ts`

- **IMPLEMENT**:
  - `list()` reads `index.json` (missing → `[]`) sorted by `updatedAt` desc.
  - `load(id)` reads and zod-validates. On failure, try `workspace.json.bak`. If that also fails, throw `Error('Workspace file is damaged')`.
  - `save(ws)` sets `updatedAt`, before overwriting copies the current file to `.bak` (cheap safety net), atomic-writes, then updates the index entry: nodeCount excludes the question node, groupCount, and `coverThumb` = the thumbnailPath of the most recent captured node.
  - `create({name, researchQuestion})` builds the workspace with a question node at `(0,0)`, with `title = researchQuestion ?? ''` and `kind:'question'`, plus a default session: viewport `{x: 400, y: 300, zoom: 1}`, `browserUrl: 'https://www.google.com'`, `viewMode: 'graph'`, `captureMode: 'manual'`.
  - `delete(id)`: `rm -r` the dir and remove it from the index.
  - `duplicate(id)`: new id, name + " (copy)". Copy the thumbs dir and rewrite `wa-thumb://<old>/` → `wa-thumb://<new>/` in node thumbnailPaths.
  - `importFile(json)`: validate `WorkspaceFileSchema`, assign a new workspace id, write the thumbs from data URLs, rewrite the thumbnail paths, save, and return the workspace.
- **VALIDATE**: `npm run typecheck && npm run build`
- **SATISFIES**: AC-8, AC-9 (import)

#### Task 2.3 CREATE `src/main/thumbs.ts`: `wa-thumb://` protocol + `thumb.save`

- **IMPLEMENT**:
  - Before `app.whenReady`: `protocol.registerSchemesAsPrivileged([{ scheme: 'wa-thumb', privileges: { standard: true, secure: true, supportFetchAPI: true } }])`.
  - After ready: `protocol.handle('wa-thumb', req => { const u = new URL(req.url); /* host = workspaceId, pathname = /<nodeId>.png */ validate ids; return net.fetch(pathToFileURL(thumbFile(ws, node)).toString()) })`.
  - `saveThumb(ws, nodeId, dataUrl)`: decode base64 PNG, atomic-write, return `` `wa-thumb://${ws}/${nodeId}.png?v=${Date.now()}` ``.
- **GOTCHA**:
  - With `standard: true` the host is lowercased. UUIDs are already lowercase, and the id regex must accept only lowercase `[a-f0-9-]` for workspace ids.
  - Strip `?v=` before resolving.
- **VALIDATE**: `npm run typecheck && npm run build`
- **SATISFIES**: AC-3 (thumbnails)

#### Task 2.4 REPLACE preload + CREATE `src/main/ipc.ts` + `src/main/env.ts`; close-flush handshake

- **IMPLEMENT**:
  - `env.ts`: `dotenv.config({ path: join(process.cwd(), '.env') })`. Export `keys = { anthropic: process.env.ANTHROPIC_API_KEY || '', groq: … }` and `hasKey`.
  - `preload/index.ts`: `contextBridge.exposeInMainWorld('api', api)` where every method is `ipcRenderer.invoke(CHANNELS.x, …)`. `on(ch, cb)` accepts only the 4 `RendererEvent` names (whitelist) and returns an unsubscribe. Import **only** `electron` and `@shared/api` (types and constants).
  - `preload/index.d.ts`: `declare global { interface Window { api: WebAtlasApi } }`.
  - `ipc.ts`: `ipcMain.handle` for every channel, delegating to `workspaceStore`, `thumbs`, `exportImport` (Task 7.2) and `ai/*` (Phase 8). Stub the AI handlers now: `summarize` → `''`; `organize` → `{ghosts:[], mode:'offline', message:'Not built yet'}`.
  - Close handshake in `index.ts`: on `mainWindow.on('close', e)`, the first time `e.preventDefault()`, send `app:before-close`, and wait for `app:ready-to-close` (with a 1500 ms timeout), then `mainWindow.destroy()`.
- **GOTCHA**:
  - The sandboxed preload can only `require('electron')`. electron-vite bundles `@shared` constants into it, which is fine, but do not import Node modules.
  - **Keys never cross IPC.** `ai.status` returns booleans only.
- **VALIDATE**: `npm run typecheck && npm run build`
- **SATISFIES**: AC-security, AC-8

---

### Phase 3 — Design system, shell, home, workspace screen

#### Task 3.1 CREATE styles: `tokens.css`, `wa.css`, `globals.css`; fonts; theme

- **IMPLEMENT**:
  - `tokens.css`: `:root, [data-theme="light"] { --canvas:#f3efe6; … }` and `[data-theme="dark"] { … }` for **every** token in DESIGN.md §2.1 (colours) and §2.5 (shadows, per theme), plus `--space-1..7`, `--radius-sm|md|lg|pill`, and `--font-display: "Fraunces Variable", "Iowan Old Style", Georgia, serif; --font-sans: "IBM Plex Sans", system-ui, "Segoe UI", sans-serif; --font-mono: "IBM Plex Mono", ui-monospace, Consolas, monospace`.
  - `wa.css`: DESIGN.md Appendix A verbatim, **minus** the first `@import` line.
  - `globals.css`: `@import "tailwindcss";` then `@theme inline { --color-canvas: var(--canvas); --color-surface: var(--surface); --color-surface-sunken: var(--surface-sunken); --color-ink: var(--ink); --color-ink-muted: var(--ink-muted); --color-ink-subtle: var(--ink-subtle); --color-line: var(--line); --color-line-strong: var(--line-strong); --color-brand: var(--brand); --color-on-brand: var(--on-brand); --color-brand-soft: var(--brand-soft); --color-danger: var(--danger); --font-display: var(--font-display); --font-sans: var(--font-sans); --font-mono: var(--font-mono); }`. Set `body{background:var(--canvas);color:var(--ink);font-family:var(--font-sans)}`.
  - Import in `main.tsx`: `@fontsource-variable/fraunces`, `@fontsource/ibm-plex-sans/{400,500,600}.css`, `@fontsource/ibm-plex-mono/400.css`, then tokens, wa and globals.
  - `lib/theme.ts`: set `document.documentElement.dataset.theme` from `matchMedia('(prefers-color-scheme: dark)')` and listen for changes.
- **GOTCHA**:
  - Fonts are **bundled locally** (not Google Fonts as DESIGN.md says for its web bundle), so the demo works offline and under the CSP.
  - Tailwind v4 preflight resets `button` and heading styles. The `wa-*` classes set their own, and `wa.css` is imported **after** Tailwind's base (use `@layer` order, or import `wa.css` last) so it wins.
- **VALIDATE**: `npm run typecheck && npm run build`, then `npm run dev` shows a warm-paper background in light mode and the night chart when Windows is in dark mode.
- **SATISFIES**: AC-10 (polish), AC-dark

#### Task 3.2 ADD shadcn primitives

- **IMPLEMENT**:
  - Add `"compilerOptions": {"baseUrl": ".", "paths": {"@renderer/*": ["src/renderer/src/*"]}}` to the root `tsconfig.json`.
  - Write `components.json` (style `new-york`, tsx, tailwind css `src/renderer/src/styles/globals.css`, aliases `components: "@renderer/components"`, `utils: "@renderer/lib/utils"`, `ui: "@renderer/components/ui"`).
  - Run `npx shadcn@latest add dialog command tooltip dropdown-menu popover sonner --yes`.
  - Restyle the generated components' classes to tokens: `bg-surface`, `text-ink`, `border-line`, `rounded-[var(--radius-lg)]` for Dialog and Command, `shadow-[var(--shadow-overlay)]`.
  - Remove any `bg-background`/`text-foreground` shadcn variables, or alias them in `@theme inline` (`--color-background: var(--surface); --color-foreground: var(--ink); --color-popover: var(--surface); --color-muted: var(--surface-sunken); --color-accent: var(--brand-soft); --color-border: var(--line); --color-ring: var(--focus);`). **Prefer aliasing**, since it's faster.
- **GOTCHA**: If the shadcn CLI can't resolve the aliases in this multi-tsconfig layout, copy the component sources from the shadcn docs manually into `components/ui/`. Don't sink time here.
- **VALIDATE**: `npm run typecheck && npm run build`
- **SATISFIES**: AC-10

#### Task 3.3 CREATE `components/wa/*.tsx`: port DESIGN.md components

- **IMPLEMENT**: Port `Icon`, `Button`, `TagChip`, `GhostSuggestion`, `SelectionToolbarView`, `CaptureBar`, `ViewSwitcher` and `WorkspaceCard` 1:1 from Appendix B, with Appendix C props plus callbacks:
  - `ViewSwitcher{value, onChange, views?}`
  - `CaptureBar{url, mode, onModeChange, onAdd, onNavigate, onBack, onForward, onReload, canGoBack, canGoForward}`. The URL box becomes an `<input>` with `wa-cap__url` styling, and back, forward and reload `wa-tb` buttons sit before it.
  - `SelectionToolbarView{color, onColor, onTag, onNote, onOpen, onZoom, onDelete, showOpen}`
  - `WorkspaceCard{…, onOpen, menu}`
  Also create the pure presentational card bodies `NodeCardView`, `NoteCardView`, `QuestionCardView` and `GroupFrameView`, matching the Appendix B markup. The React Flow node wrappers in Phase 4 reuse them.
  - `CaptureBar` width: `100%`, not the demo 640 px.
  - Every button gets an `aria-label` and a shadcn `Tooltip`.
  - The `NodeCardView` favicon uses `<img src={faviconUrl}>` with `onError` falling back to the letter tile.
  - `NodeCardView` shows at most 3 tags, then "+N". It shows only the newest highlight. If `node.note` is non-empty, it shows a small `note` icon with tooltip "Has a note" (DESIGN.md: notes don't go in the web card body).
  - When `node.color` is set, the card border is `2px solid var(--cat-<c>)`.
  - Type badges: web→"Web page", video→"Video", pdf→"PDF". Map `webpage`→`web` for the design type.
- **PATTERN**: DESIGN.md Appendix B lines 575–722, Appendix C lines 731–747.
- **VALIDATE**: `npm run typecheck && npm run lint`
- **SATISFIES**: AC-10, AC-3 (distinct resource kinds)

#### Task 3.4 CREATE `store/appStore.ts` + `store/persistence.ts`

- **IMPLEMENT**:
  - `appStore`: `{ screen: 'home'|'workspace', workspace: Omit<Workspace,'board'|'session'> | null, session: Session, ui: { paletteOpen, sidePanel: 'details'|'suggestions'|null, organizing: boolean, hintsSeen } }`, with setters. `openWorkspace(ws)` → `boardStore.load(ws.board)`, set session, `screen='workspace'`. `closeWorkspace()` → flush, then `screen='home'`.
  - `persistence.ts`: `startAutosave()` subscribes to boardStore `board` and appStore `session`/`workspace` changes, with a 500 ms debounce, and calls `window.api.workspace.save(assemble())`. `flush()` cancels the timer and awaits the save. Register `window.api.on('app:before-close', async () => { await flush(); window.api.app.readyToClose() })`.
- **GOTCHA**: `patchSilently` and `setGhosts` changes must also autosave, and they do because the subscription is on `board`.
- **VALIDATE**: `npm run typecheck`
- **SATISFIES**: AC-8

#### Task 3.5 CREATE home: `Home.tsx`, `Welcome.tsx`, `NewWorkspaceDialog.tsx`; `App.tsx` router

- **IMPLEMENT**:
  - `App.tsx`: `screen === 'home' ? <Home/> : <WorkspaceScreen/>`, plus the `<Toaster/>`.
  - `Home`: `workspace.list()`. If it's empty, render `Welcome`:
    - "WebAtlas" in `display-xl` (Fraunces 600, 48/48, -0.02em)
    - tagline "Your browsing, drawn as a map."
    - primary "Create workspace", secondary "Open sample workspace"
    - caption "Everything stays on your device."
    - 48 px margins
  - Otherwise, a header "Your workspaces" (`display-lg`) with "New workspace" (primary) and "Import" (secondary) buttons, and a responsive grid (gap `space-5`) of `WorkspaceCard` sorted by `updatedAt`.
    - Card shows `opened` = relative time ("Opened 2h ago").
    - Card dropdown: Duplicate, Export JSON, Delete. Delete asks for confirmation with the text "Delete ‘{name}’? This can't be undone." and a `reject`-variant Delete button.
    - If `coverThumb` exists, show it in `wa-ws__map` instead of the decorative SVG.
  - `NewWorkspaceDialog`: Name (required) and Research question (optional, placeholder "What are you trying to answer?"). Create → `workspace.create` → `openWorkspace`.
- **VALIDATE**: `npm run typecheck && npm run lint`, then `npm run dev`: create a workspace, reach the (empty) workspace screen, relaunch, and the card is listed.
- **SATISFIES**: AC-1, AC-2, AC-8

#### Task 3.6 CREATE `WorkspaceScreen.tsx` (split layout) + `BrowserPane.tsx` (basic)

- **IMPLEMENT**:
  - `react-resizable-panels` `PanelGroup direction="horizontal"`: left `Panel defaultSize={42} minSize={25}` = `BrowserPane`, then `PanelResizeHandle` (4 px, `bg-line`, hover `bg-line-strong`), then the right `Panel`.
  - The right panel is a column:
    - Top bar (48 px, `bg-surface`, bottom `border-line`), containing:
      - a back-to-home button
      - the workspace name (`title` style)
      - a `ViewSwitcher`
      - a Search button (ghost variant, kbd "Ctrl+K")
      - an Organize button (added in Phase 8; placeholder now)
      - the Export dropdown (Phase 7)
      - undo/redo icon buttons
    - Below the top bar, the canvas area plus the right side panel (320 px, collapsible).
  - `BrowserPane`: `CaptureBar` + `<webview>` filling the rest, `partition="persist:webatlas-browse"`, `allowpopups="true"`, initial `src = session.browserUrl`. Keep a ref.
    - Wire back, forward and reload.
    - Wire address submit → `toUrl(input)`: if it has no spaces and contains a `.` or starts with `http`, prefix `https://` if needed. Otherwise use `https://www.google.com/search?q=` + encoded input. Then call `webview.loadURL`.
    - On `did-navigate` / `did-navigate-in-page` (main frame), update the address box and `session.browserUrl`.
    - Subscribe to `browser:open-url` → `loadURL`.
- **GOTCHA**:
  - While dragging the splitter, the webview swallows mouse events. Use `onDragging` on `PanelResizeHandle` to set `pointer-events:none` on the webview during the drag.
  - Only set `src` once (use a `useState` initialised at mount). Never re-render a changed `src`.
- **VALIDATE**: `npm run dev`: browse via the address bar, resize the split smoothly, and after a relaunch and reopen the browser returns to the last URL.
- **SATISFIES**: AC-3, AC-8

---

### Phase 4 — Canvas

#### Task 4.1 CREATE canvas node components: `WebNode`, `NoteNode`, `QuestionNode`, `GroupNode`

- **IMPLEMENT**:
  - Each is a `memo` React Flow custom node receiving `data: { id }` and reading its record from `useBoardStore(s => s.board.nodes[id])` (a fine-grained selector, so a move doesn't re-render every card).
  - Each renders the matching `*View` from Task 3.3, passing `selected`.
  - Four `<Handle>`s (top, right, bottom, left, each `type="source"`, with `ConnectionMode.Loose` on the flow) styled as `wa-handle`. They are visible when the card is selected or hovered.
  - `NodeResizer` when selected (minWidth 200, minHeight 120). It reports the final size through `onResizeEnd` → `resizeCommitted`.
  - `NoteNode`: double-click → an in-place `<textarea>` (`body` style). Blur or Ctrl+Enter commits `updateNode{note text in title}`. Store the note text in `title` for kind `note`, since it's the searchable, exported text field. Escape cancels.
  - `QuestionNode`: `QuestionCardView`, double-click → inline edit → `updateQuestion`. `meta` = "`{n}` sources · `{g}` groups". No delete, no resizer.
  - `GroupNode`: `GroupFrameView` sized to `group.size`, with `NodeResizer`. The label is double-click editable (`updateGroup`).
- **GOTCHA**: Use `className="nodrag"` on the textarea and inputs so typing doesn't drag the node, and `nowheel` on scrollable areas.
- **VALIDATE**: `npm run typecheck && npm run lint`
- **SATISFIES**: AC-4, AC-10

#### Task 4.2 CREATE `edges/LabeledEdge.tsx`

- **IMPLEMENT**:
  - Use `getBezierPath` + `BaseEdge` + `EdgeLabelRenderer`. The label pill uses the DESIGN.md `.wa-edge__label` styles, positioned at `labelX/labelY` with `pointer-events: all` and the `nodrag nopan` classes.
  - Stroke 2 px. Colour, in order of precedence:
    1. `edge.color` → `var(--cat-c)`
    2. `origin==='ai'` → `var(--brand)`
    3. otherwise `var(--line-strong)`
  - Arrowhead: `markerEnd={{ type: MarkerType.ArrowClosed, color, width: 16, height: 16 }}`.
  - Label text: `edge.label ?? relationLabel(relation)`, where `relationLabel` = opened-from→"opened from", related→"related", supports→"supports", contradicts→"contradicts", answers→"answers", source-of→"source of", custom→label.
  - Selected edges get a brand outline on the pill.
  - `data.ghost` → dashed `6 5` with `ghost-line`, and the pill gets the `--ghost` class with "?" appended.
- **VALIDATE**: `npm run typecheck`
- **SATISFIES**: AC-4, AC-7

#### Task 4.3 CREATE `canvas/useFlowSync.ts`: store ↔ React Flow bridge

- **IMPLEMENT**: A hook returning `{nodes, edges, onNodesChange, onEdgesChange, onConnect, onNodeDragStop}`.
  - Local `useState<RFNode[]>`. A `useEffect` on `board` rebuilds the array:
    - groups first (type `group`, `style: { width, height }`, `zIndex: 0`)
    - then cards (type by kind, `parentId: parentGroupId`, `position` as stored, `style` width/height from `size`, `zIndex: 1`)
    - then ghost groups (Task 8.6)
    - Carry over `measured`, `selected` and `dragging` from the previous array **by id**.
  - `onNodesChange(changes)`: `setNodes(ns => applyNodeChanges(changes, ns))`. Then:
    - `select` changes → mirror the selected ids into `appStore.session.selectedIds`
    - ignore `remove` (deletion goes through keyboard.ts / the toolbar)
    - `dimensions` with `resizing === false` after a resize → `resizeCommitted` (via NodeResizer `onResizeEnd` instead, which is simpler)
  - `onNodeDragStop(_e, _node, dragged)`: compute moves for every dragged node whose position changed, then group-membership changes:
    - for each dragged **card**, `getIntersectingNodes(card)` filtered to type `group`, and take the first
    - if the membership differs → `dropIntoGroup` (computes absolute → relative)
    - else → `moveCommitted`
    - Wrap both in one `batch` so the drag is one undo step.
  - `onConnect({source,target})` → `connectNodes(source, target)`.
  - Edges come from `board.edges` plus ghost edges (Task 8.6), all `type: 'labeled'`.
- **GOTCHA**:
  - A parent must precede its children in the array, or React Flow throws or warns.
  - Snap grid `[32,32]` applies to drags. Positions stored after a snap are already multiples of 32.
  - Do not create a command per drag frame. Commit only on drag stop.
- **VALIDATE**: `npm run typecheck`
- **SATISFIES**: AC-4

#### Task 4.4 CREATE `CanvasView.tsx` + `keyboard.ts` + `placement.ts`

- **IMPLEMENT**:
  - `<ReactFlow nodeTypes edgeTypes {...useFlowSync()} connectionMode={ConnectionMode.Loose} snapToGrid snapGrid={[32,32]} zoomOnDoubleClick={false} deleteKeyCode={null} selectionOnDrag={false} panOnDrag multiSelectionKeyCode="Shift" selectionKeyCode="Shift" minZoom={0.1} maxZoom={2} defaultViewport={session.viewport} onMoveEnd={(_,vp)=>setSession({viewport: vp})} proOptions={{hideAttribution:true}} colorMode={theme}>`.
  - Children: `<Background variant={BackgroundVariant.Dots} gap={32} size={1.5} color="var(--canvas-dot)" />`, `<Controls showInteractive={false}/>`, `<MiniMap pannable zoomable nodeColor={…category colour or var(--line-strong)} maskColor="rgb(0 0 0 / .08)"/>`.
  - Style the wrapper `bg-canvas`.
  - Double-click on the pane: the wrapper's `onDoubleClick` checks `(e.target as Element).classList.contains('react-flow__pane')`, then `screenToFlowPosition` → `addNoteAt(pos)` → select the new note and start editing it.
  - Drop support (used in Task 5.6): `onDragOver` preventDefault, `onDrop` reads `text/uri-list`.
  - `keyboard.ts` (a window `keydown` listener active while the workspace screen is mounted, ignored when `e.target` is an input, textarea or contenteditable):
    - Delete/Backspace → `deleteSelection`
    - Ctrl+Z → undo; Ctrl+Shift+Z or Ctrl+Y → redo
    - Ctrl+A → select all nodes (set `selected` on the RF nodes)
    - arrows → `moveCommitted` by ±32 px for the selection
    - Escape → clear the selection
    - Ctrl+K → open the palette. This is a fallback; the menu accelerator handles it when the webview has focus.
  - `placement.ts`: `findFreeSpot(board, near: XY, size={w:260,h:240})`. Starting at `near`, scan in 32 px steps to the right and then down for up to 40 tries, and return the first spot whose rect doesn't intersect any top-level card or group rect (with a 16 px margin).
- **VALIDATE**: `npm run dev`, then check:
  - Double-click adds a note.
  - Dragging moves cards, and Ctrl+Z undoes the move.
  - Dragging a handle to another card makes a "related" edge.
  - Delete removes, and undo restores both the node and its edges.
  - The question card can't be deleted.
- **SATISFIES**: AC-4

#### Task 4.5 CREATE `SelectionToolbar.tsx` + `EdgeEditor.tsx`

- **IMPLEMENT**:
  - `NodeToolbar nodeId={selectedIds} isVisible={selectedIds.length>0 && !dragging} position={Position.Top} offset={12}` rendering `SelectionToolbarView`:
    - Colour → `setColor` on the selected nodes and groups.
    - Tag → a Popover with an input and existing-tag suggestions → `tagItems`.
    - Note → open the Inspector focused on the note field (Task 6.1).
    - Open in browser pane → `webview.loadURL(node.url)`. Shown only for a single web, video or pdf card. The webview ref comes from `appStore` / a module-level ref setter in `BrowserPane`.
    - Zoom to selection → `fitView({ nodes: selected, padding: 0.3, duration: 250 })`.
    - Delete → `deleteSelection`.
    - With two or more cards selected, add a "Group" button (icon `focus`, label "Group") → `groupSelection(ids, 'New group')`, then focus the label for editing.
  - `EdgeEditor`: on `onEdgeDoubleClick`, a DropdownMenu at the pointer with relations (related, supports, contradicts, answers, source of, custom…) → `setEdgeRelation`, plus "Delete link" (danger) → `disconnect`. "Custom…" opens a small input for the label.
- **VALIDATE**: `npm run dev`: colour, tag, group, relabel an edge, undo each.
- **SATISFIES**: AC-4

**Phase 4 checkpoint**: an Obsidian-like canvas with the question, notes, edges, groups and toolbar, with undo and redo everywhere, persisted across a relaunch.

---

### Phase 5 — Browser pane and capture

#### Task 5.1 CREATE `browser/webviewScripts.ts`

- **IMPLEMENT**: Exported string builders, each an IIFE **expression** returning JSON-serialisable data:
  - `META_SCRIPT` returns `{ title: document.title, ogTitle, ogImage, description: meta[name=description]|og:description, contentType: document.contentType, favicon: absolute href of link[rel~=icon] or origin+'/favicon.ico', siteName: og:site_name }`.
  - `readabilityScript(src)` = `` `(() => { try { ${src}; const doc = document.cloneNode(true); const r = new Readability(doc).parse(); return r ? (r.textContent || '').replace(/\\s+/g,' ').trim().slice(0, 20000) : '' } catch (e) { return '' } })()` ``
  - `SELECTION_SCRIPT` = `(() => String(window.getSelection() || '').trim())()`
- **GOTCHA**:
  - Trusted-Types sites (YouTube) may throw inside Readability, and the try/catch returns `''`. For video, fall back to `description`.
  - `executeJavaScript` needs the `dom-ready` state. The caller checks a `ready` ref.
- **VALIDATE**: `npm run typecheck`
- **SATISFIES**: AC-3

#### Task 5.2 CREATE `browser/useProvenance.ts`

- **IMPLEMENT**: Track `lastNodeIdForTab` (ref).
  - On `did-navigate` / `did-navigate-in-page`: if `normalizeUrl(newUrl)` matches an existing node's url → set `lastNodeIdForTab` to that node (revisiting a card makes it the parent). Otherwise keep the previous value, so the next capture is "opened from" it.
  - Address-bar navigation (typed URL or search) → reset to `null`, because a typed URL isn't "opened from" anything. Expose `markTypedNavigation()` for BrowserPane to call before `loadURL`.
  - After a capture → set it to the new node.
  - `browser:open-url` popups keep the parent (they are "opened from" the current page).
- **VALIDATE**: `npm run typecheck`
- **SATISFIES**: AC-3 (provenance)

#### Task 5.3 CREATE `browser/useCapture.ts`: capture pipeline

- **IMPLEMENT**: `capturePage(opts?: { source: 'manual'|'auto'|'highlight' }) → Promise<string /*nodeId*/>`:
  1. `url = webview.getURL()`. If it's `about:blank` or a Google search results page (`google.*/search`), toast "Open a result first, then add it" and return.
  2. **Dedupe**: an existing node with the same `normalizeUrl` → select it, `setCenter` on it (duration 300), and return its id. For auto mode, stay silent.
  3. `meta = await exec(META_SCRIPT)`. Then `kind = detectKind(url, meta.contentType)`. Then `text = kind==='webpage' ? await exec(readabilityScript(src)) : kind==='video' ? meta.description : ''`.
  4. `id = crypto.randomUUID()`. `img = await webview.capturePage()`. `thumbnailPath = await api.thumb.save(wsId, id, img.resize({ width: 520 }).toDataURL())`, inside try/catch; on failure leave it undefined and show the skeleton.
  5. `parent = provenance.lastNodeIdForTab` (if it still exists). `position = findFreeSpot(board, parent ? rightOf(parent) : viewportCentre())`.
  6. Build the node: `title = meta.ogTitle || meta.title || hostOf(url)`; for pdf, use the last URL path segment decoded when the title is empty; `faviconUrl` from the `page-favicon-updated` cache or `meta.favicon`; `text`; `capturedFromNodeId: parent`; `capturedAt: Date.now()`; empty collections.
  7. Dispatch **one** `batch[addNodes{[node]}, connect{opened-from edge parent→node, origin:'provenance'}]` when there's a parent, otherwise just `addNodes`. Set `provenance.last = id`.
  8. If the node is outside the viewport → `fitView({nodes:[node, parent?], padding: .4, duration: 300, maxZoom: 1})`. Select the new node.
  9. Fire and forget: `api.ai.summarize((meta.description ?? '') + '\n' + text.slice(0, 3000))` → `patchSilently(d => { if (d.nodes[id]) d.nodes[id].summary = s })`.
  10. Toast "Added to canvas", with an Undo action (manual only).
  - Also `captureLink(url, title?, at?)` for links: no thumbnail (skeleton), `kind = detectKind(url)`, title = link text or host, parent = the node of the current page if it's on the board, position = `at ?? findFreeSpot(...)`.
  - Auto mode: in BrowserPane, on main-frame `did-navigate` / `did-navigate-in-page` with a changed normalized URL, debounce 1500 ms after the last `did-stop-loading` / `page-title-updated`, then `capturePage({source:'auto'})`. Skip search-results pages, `about:`, and duplicates.
- **GOTCHA**:
  - SPA navigations (YouTube) change the title late, hence the 1.5 s debounce.
  - `capturePage` captures only the visible viewport, which is fine for thumbnails.
  - The `NativeImage` returned in a sandboxed renderer supports `resize` and `toDataURL`. Spike 1 confirms this; if it doesn't, pass the raw data URL and have main resize it with `nativeImage.createFromDataURL(...).resize(...)` inside `thumb.save`.
- **VALIDATE**: `npm run typecheck && npm run lint`, then `npm run dev`:
  - Capture Wikipedia → a card appears with its thumbnail. Click a link, capture → an "opened from" edge appears.
  - YouTube → a video card. An arXiv PDF → a PDF card.
  - Auto mode → each navigation adds a card with no duplicates.
- **SATISFIES**: AC-3

#### Task 5.4 CREATE `src/main/menu.ts` + webview context menu (hotkeys work inside the webview)

- **IMPLEMENT**:
  - `Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: 'WebAtlas', submenu: [...] }]))` with items that `mainWindow.webContents.send('menu:action', id)`:
    - `capture` Alt+A
    - `highlight` Alt+H
    - `palette` CmdOrCtrl+K
    - `address` CmdOrCtrl+L
  - Keep the default Edit roles (undo, redo, cut, copy, paste, selectAll) so text inputs work. **Do not** bind Ctrl+Z to a custom action in the menu (it would hijack textarea undo). Canvas undo stays in `keyboard.ts`.
  - Also add `{ role: 'toggleDevTools' }` in dev.
  - In the `web-contents-created` webview branch: `wc.on('context-menu', (_e, p) => { const items = []; if (p.selectionText) items.push({ label: 'Add highlight to canvas', click: () => send('browser:context-action', { type: 'highlight', text: p.selectionText }) }); if (p.linkURL) items.push({ label: 'Add link to canvas', click: () => send(..., { type: 'link', url: p.linkURL, text: p.linkText }) }); items.push({ label: 'Add page to canvas', click: () => send(..., { type: 'page' }) }); Menu.buildFromTemplate([...items, {type:'separator'}, {role:'copy'}]).popup() })`.
  - Renderer: `window.api.on('menu:action', …)` → capture, highlight, open the palette, or focus the address input. `browser:context-action` → `addHighlight` / `captureLink` / `capturePage`.
- **GOTCHA**:
  - When the webview has focus, renderer `keydown` never fires. That's why hotkeys go through menu accelerators.
  - `autoHideMenuBar` keeps accelerators working.
  - Context-menu `selectionText` works in the **PDF viewer**, where `getSelection()` does not.
- **VALIDATE**: `npm run dev`: click into the page, press Alt+A → captured. Right-click a link → "Add link to canvas".
- **SATISFIES**: AC-3, AC-5 (Ctrl+K from anywhere)

#### Task 5.5 ADD highlight flow

- **IMPLEMENT**: `highlightSelection(textFromMenu?)`:
  - `quote = textFromMenu ?? await exec(SELECTION_SCRIPT)`. If it's empty → toast "Select text on the page first".
  - Find the node for the current URL. If there isn't one, `await capturePage({source:'highlight'})`.
  - Dispatch `addHighlight(nodeId, quote.slice(0, 600))` and toast "Highlight added".
  - The card shows the newest highlight on the `highlight` token background.
- **VALIDATE**: `npm run dev`: select text, press Alt+H → the quote appears on the card, and Ctrl+Z removes it.
- **SATISFIES**: AC-3 (highlights)

#### Task 5.6 ADD link drag-drop onto canvas

- **IMPLEMENT**: In `CanvasView`, `onDrop`: `const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')`. If it's `http(s)` → `captureLink(url, undefined, screenToFlowPosition({x:e.clientX,y:e.clientY}))`.
- **GOTCHA**: Drag from the webview into the host document works at the OS drag-data level. If it doesn't work on the demo machine, drop this task. The button, hotkey and context menu already cover capture.
- **VALIDATE**: `npm run dev`: drag a link from the page onto the canvas.
- **SATISFIES**: AC-4 (Obsidian "drag items in")

#### Task 5.7 IMPLEMENT `src/main/ai/summarize.ts` (Groq)

- **IMPLEMENT**:
  - `new Groq({ apiKey: keys.groq })` (created lazily).
  - `chat.completions.create({ model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant', max_tokens: 60, temperature: 0.2, messages: [{role:'system', content:'Summarise the page in one plain sentence of at most 20 words. No preamble, no quotes.'}, {role:'user', content: text.slice(0, 3000)}] }, { timeout: 8000 })`.
  - Return the trimmed first line, or `''` on any error or a missing key.
  - Wire it into `ipc.ts`.
- **VALIDATE**: `npm run typecheck && npm run build`. Manual: a captured card shows its summary within a few seconds (shown under the title in `caption` style, `ink-muted`, 2-line clamp).
- **SATISFIES**: AC-3

**Phase 5 checkpoint**: the full research loop (browse → capture with thumbnail, provenance and summary → highlight) works in both manual and auto modes.

---

### Phase 6 — Inspector, search, views

#### Task 6.1 CREATE `inspector/Inspector.tsx` (side panel "Details" tab)

- **IMPLEMENT**:
  - For a single selected card or group, show:
    - the title (editable input → `updateNode`)
    - URL (mono, `url` style, click → open in the pane)
    - kind badge
    - captured time and "opened from {parent title}" (clickable → jump)
    - summary
    - **Your note** textarea (commit on blur → `updateNode{note}`)
    - Tags (TagChips, an × to `untag`, an input to add)
    - Highlights list (each on `highlight`, × → `removeHighlight`)
    - Comments (list plus an input → `addComment`)
  - For a group: label, category select, colour swatches, note, comments, member count.
  - Nothing selected → the empty state "Select a card to see its details".
  - Multi-select → "{n} selected", plus bulk tag and colour.
- **GOTCHA**: Commit text edits on blur or Enter as **one** command, not per keystroke.
- **VALIDATE**: `npm run dev`: edit a note, tag, delete a highlight, add a comment. Undo works for each.
- **SATISFIES**: AC-4 (notes and tags), data-model comments

#### Task 6.2 CREATE `search/searchIndex.ts` + test, and `CommandPalette.tsx`

- **IMPLEMENT**:
  - `buildDocs(board)` → one doc per node `{id, type: kind→(web|video|pdf|note), title, url, note, highlights: string[], tags: string[], comments: string[], summary, groupLabel}`, one per group `{type:'group', title: label}`, and one per distinct tag `{type:'tag', title:'#'+tag, ids: nodeIdsWithTag}`.
  - `new Fuse(docs, { keys: [{name:'title',weight:3},{name:'tags',weight:2},{name:'highlights',weight:1.5},{name:'note',weight:1.5},{name:'url',weight:1},{name:'summary',weight:1},{name:'comments',weight:1}], includeMatches: true, threshold: 0.35, ignoreLocation: true, minMatchCharLength: 2 })`.
  - `search(q)` → the top 8, with a `match` line from the first match key:
    - "Title · host"
    - "Highlight · “…snippet…”" (40 chars around the match)
    - "Note · in group X"
    - "Tag · N nodes"
  - Memoise the index on `board.nodes` / `board.groups` identity.
  - `CommandPalette`: the shadcn `CommandDialog` with `shouldFilter={false}`, restyled to `.wa-pal` (560 px, `radius-lg`, `shadow-overlay`). Rows use `wa-pal__row` (icon plus two lines). The footer is from DESIGN.md.
  - Enter →
    - a node or group: if `viewMode==='list'`, switch to graph. Select it and `setCenter(x+w/2, y+h/2, {zoom: 1, duration: 300})` using absolute coordinates.
    - a tag: select all tagged nodes and `fitView` them.
- **VALIDATE**: `npx vitest run src/renderer/src/features/search` (tests: title fuzzy "rotterdm"→hit; highlight text hit returns a "Highlight ·" match line; tag doc aggregates ids; cap at 8). Manual: Ctrl+K from the webview and from the canvas.
- **SATISFIES**: AC-5

#### Task 6.3 CREATE `views/focus.ts` + wire focus mode

- **IMPLEMENT**:
  - `focusSet(board, selectedIds)`:
    - the anchor = the selection, or the question node if nothing is selected
    - plus 1-hop neighbours via edges
    - plus, for a group, its members; for a member, its group
  - In `useFlowSync`, when `viewMode==='focus'`, nodes and edges outside the set get `className: 'wa-dim'` (`opacity:.15; pointer-events:none`, 150 ms transition).
  - On entering focus mode or changing the selection → `fitView({ nodes: set, padding: .3, duration: 250 })`.
- **VALIDATE**: `npm run dev`: select a card, switch to Focus → the neighbours stay bright and the rest dims.
- **SATISFIES**: AC-6

#### Task 6.4 CREATE `views/ListView.tsx`

- **IMPLEMENT**:
  - A table replacing the canvas when `viewMode==='list'`, on `bg-canvas` with no dots. A "Group by" segmented control (Group | Tag).
  - Sections in `overline` style with the group colour dot. Each section is a table with columns: type badge, Title (+ host in mono), Tags (≤3), Highlights count, Captured (relative time).
  - Row hover `surface-sunken`. Row click → switch to graph and jump (reuse `jumpTo`).
  - Ungrouped cards come last under "Not in a group". Notes are listed under the "Notes" section.
- **VALIDATE**: `npm run dev`: switch to List, group by tag, click a row → jumps to the card on the graph.
- **SATISFIES**: AC-6

---

### Phase 7 — Export, import, sample, onboarding

#### Task 7.1 CREATE `src/shared/export/{geometry,markdown,jsonCanvas}.ts` + tests

**Independent of** Phases 3–6. This can run any time after Task 1.1.

- **IMPLEMENT**:
  - `geometry.absolutePosition(item, board)` = position + parent group position.
  - `toMarkdown(ws)`:
    - `# {name}`, `> Research question: …`, and the export date
    - per group, `## {label}` with `*{category}*`, then per card `### [{title}]({url}) · {Kind}`, with bullets for Summary, "Opened from [{parent}]", Note, and `> “{highlight}”` lines, then `Tags: #a #b`
    - `## Not in a group`, `## Notes` (note cards), `## Relationships` (`- A → supports → B`, excluding ghosts)
    - **Ghosts are never exported.**
  - `toJsonCanvas(ws)` → `{ nodes, edges }` per the JSON Canvas 1.0 spec:
    - groups → `{id, type:'group', label, x, y, width, height, color}`
    - web, video and pdf cards → `{type:'link', url, x, y, width: size?.w ?? 260, height: size?.h ?? 240}` (absolute coordinates)
    - note and question cards → `{type:'text', text}`, where the question text is `## ` + question
    - edges → `{id, fromNode, toNode, toEnd:'arrow', label: label ?? relationLabel, color}`
    - colours: rose→"1", amber→"2", moss→"4", teal→"5", plum→"6", blue→"#2c62b8"
    - Emit group nodes **before** children (Obsidian z-order). Round coordinates to integers.
  - `toWorkspaceFile(ws)` → `{format:'webatlas', version:1, workspace: ws}` (main adds `thumbs`).
- **VALIDATE**: `npx vitest run src/shared/export` (tests: child absolute coords; ghosts excluded; colour map; Markdown contains the group heading, highlight quote and relationship line; JSON Canvas edge ids are unique and reference existing nodes)
- **SATISFIES**: AC-9

#### Task 7.2 CREATE `src/main/exportImport.ts` + `ExportMenu.tsx`

- **IMPLEMENT**:
  - `export.save(format, content, name)`:
    - `dialog.showSaveDialog(mainWindow, { defaultPath: sanitize(name) + ext, filters })`
    - for `json`, parse the content and add `thumbs` (read `thumbs/*.png` → data URLs, skipping any over 400 KB)
    - write the file, and return the path or null
  - `import.workspace()`: `showOpenDialog` with filter `*.json;*.webatlas.json` → `workspaceStore.importFile`.
  - `import.sample()`: read `join(app.getAppPath(), 'resources/sample/sample.webatlas.json')` → `importFile`, named "Sample: Coastal adaptation".
  - `ExportMenu` (DropdownMenu in the top bar): "Markdown (.md)", "JSON (.json)", "Obsidian Canvas (.canvas)". Toast "Exported to {filename}".
  - Wire Home's Import button and the Welcome screen's "Open sample workspace".
- **VALIDATE**: `npm run build`, then `npm run dev`: export all three; open the `.canvas` in Obsidian if it's installed (otherwise check the JSON by eye); import the JSON → a new workspace with thumbnails.
- **SATISFIES**: AC-9, AC-1

#### Task 7.3 CREATE `resources/sample/sample.webatlas.json` (placeholder now, real one in Phase 9)

- **IMPLEMENT**: Hand-write a valid `WorkspaceFile`:
  - question "How do coastal cities fund climate adaptation?"
  - about 12 cards (Wikipedia pages on climate adaptation and green bonds, an IPCC AR6 WG2 chapter 6 PDF, a Rotterdam water-squares video, OECD and World Bank pages, 2 notes)
  - 3 groups ("Funding models" teal/topic, "Case studies" moss/topic, "Must cite" rose/importance)
  - 4 `opened-from` edges and 3 typed edges (supports, answers)
  - no thumbs yet
  This keeps the Welcome button working before the real sample exists.
- **VALIDATE**: add a vitest case in `export.test.ts` that reads the sample file and parses it with `WorkspaceFileSchema` → `npx vitest run src/shared/export`
- **SATISFIES**: AC-1

#### Task 7.4 CREATE `onboarding/HintOverlay.tsx`

- **IMPLEMENT**:
  - On the first workspace open (`localStorage['wa.hintsSeen']` unset, read in try/catch), show 3 dismissible hint bubbles (surface card, `shadow-lift`, `caption`):
    - next to the CaptureBar: "Add the page you're reading. Alt+A"
    - on the canvas: "Double-click empty space to write a note"
    - by Organize: "Organize suggests groups and links. You decide what stays."
  - "Got it" dismisses all. No tour.
- **VALIDATE**: `npm run dev`
- **SATISFIES**: AC-1

---

### Phase 8 — Organize (spike 3 first)

#### Task 8.1 CREATE `src/main/ai/embed.ts`

- **IMPLEMENT**:
  - Lazy singleton `getExtractor()`: dynamic import, `env.cacheDir = userData/models`, `pipeline('feature-extraction','Xenova/all-MiniLM-L6-v2',{dtype:'q8'})`.
  - `embed(workspaceId, items:{id,text}[])`:
    - load `embeddings.json` (`{ [nodeId]: { hash, v: number[] } }`)
    - `hash = sha1(text)`, and compute only the misses in batches of 16 with `{pooling:'mean', normalize:true}` (`output.tolist()`)
    - atomic-write the cache and return a `Record<id, number[]>`
  - Embedding text per node = `title + '. ' + (summary ?? '') + ' ' + tags.join(' ') + ' ' + note + ' ' + highlights.join(' ') + ' ' + (text ?? '').slice(0, 1200)`.
  - Warm up (fire and forget) on app ready, so the first Organize isn't a cold start.
- **GOTCHA**: If spike 2 moved embeddings to a hidden window, implement the same signature there.
- **GOTCHA (measured in T03)**: with the 8-bit model, a text embedded inside a padded batch differs slightly from the same text embedded alone (cosine ≈ 0.994). This is harmless for clustering, but to keep cached vectors comparable, embed cache misses **one text per call** (about 7 ms each once loaded), or accept the drift. Prefer one per call.
- **VALIDATE**: `npm run typecheck && npm run build`
- **SATISFIES**: AC-7

#### Task 8.2 CREATE `src/main/ai/cluster.ts` + tests (pure)

- **IMPLEMENT**:
  - `cosine(a,b)` is a dot product (vectors are normalised).
  - `clusterNodes(ids, vecs, { threshold = 0.45, maxClusters = 6 })`: average-linkage agglomerative clustering.
    1. Start from singletons.
    2. Repeatedly merge the pair with the highest mean pairwise similarity while it is `>= threshold`.
    3. Return clusters of size ≥2, sorted by size desc, capped at `maxClusters`, each with `cohesion` = the mean intra-cluster similarity.
  - `candidateEdges(ids, vecs, existingPairs, { minSim = 0.5, topK = 12 })`: all pairs not already connected (either direction), sorted by sim desc, top K.
  - `questionLinks(questionVec, ids, vecs, { minSim = 0.35, topK = 6 })`.
  - Export the thresholds as named constants so spike 3 can tune them.
- **VALIDATE**: `npx vitest run src/main/ai/cluster.test.ts` (synthetic 3-D normalised vectors: two tight groups + one outlier → 2 clusters, and the outlier is excluded; threshold 0.99 → no clusters; existing pairs are excluded from candidates; deterministic output order)
- **SATISFIES**: AC-7

#### Task 8.3 CREATE `src/main/ai/tools.ts` + tests (pure)

- **IMPLEMENT**:
  - The three tool definitions (`Anthropic.Tool[]`), all with `strict: true`, `additionalProperties: false`, and every property in `required`:
    - `proposeGroup { nodeIds: string[] (minItems 2), label: string (≤ 4 words), category: enum topic|source|importance, rationale: string, confidence: number }`
    - `proposeEdge { source: string, target: string, relation: enum supports|contradicts|answers|related, rationale: string, confidence: number }`
    - `proposeTag { nodeId: string, tag: string, rationale: string, confidence: number }`
  - Plus `toGroqTools()`, which maps them to the OpenAI `{type:'function', function:{name, description, parameters}}` shape.
  - `toolCallToGhost(name, input, ctx)`:
    - zod-validate `input`
    - check that every id is in `ctx.nodeIds` (the question id is allowed as an edge target)
    - drop confidence < 0.4 (DESIGN.md: never render below 40%)
    - dedupe against existing edges and groups and against ghosts already produced this run
    - return `{ ghost } | { error: string }`
  - Ghost commands:
    - group → `{type:'createGroup', payload:{group:{id: uuid, label, category, color: categoryColour}, memberIds: nodeIds}}`, `title: 'Group {n} pages as “{label}”'`
    - edge → `{type:'connect', payload:{edge:{id, source, target, relation, origin:'ai'}}}`, `title: '{srcTitle} → {relation} → {tgtTitle}'`
    - tag → `{type:'addTags', payload:{nodeIds:[nodeId], tag}}`
- **VALIDATE**: `npx vitest run src/main/ai/tools.test.ts` (unknown id → error; confidence 0.3 → dropped; a duplicate edge is dropped; a valid group maps to a createGroup ghost; label is trimmed)
- **SATISFIES**: AC-7

#### Task 8.4 CREATE `src/main/ai/prompt.ts` + `src/main/ai/organize.ts` (router + bounded loops)

- **IMPLEMENT**:
  - `organize(snapshot)`:
    1. Candidates are nodes with kind ≠ question. If there are fewer than 3 → return `{ghosts:[], mode:'offline', message:'Capture a few more pages first'}`.
    2. `vecs = await embed(...)` (a question vector too, from `researchQuestion`).
    3. `clusters = clusterNodes(ungroupedIds)`, `pairs = candidateEdges(allIds)`, `qLinks = questionLinks(...)`.
    4. `buildPrompt(snapshot, clusters, pairs, qLinks)`.
       - System prompt: "You organise a student's research map. Call tools only; no prose. Name each cluster worth keeping with proposeGroup (label: 1–4 words, sentence case, names the shared topic). For candidate pairs, call proposeEdge only when the relationship is clear from the text: supports (source backs a claim in target), answers (source answers the research question or target question), contradicts (they disagree). Use related sparingly. Each rationale is one short sentence naming the shared evidence, e.g. 'Both cover Rotterdam water squares.' Give a calibrated confidence 0–1. Propose at most 6 groups, 10 edges, 6 tags. Only use ids given."
       - User message: the research question, then per node `id | kind | title | host | summary | tags | text[0..600]`, then `Clusters: [c1: id,id,…(cohesion .62)]`, `Candidate pairs: id↔id (.71)`, `Question-relevant: id (.48)`.
       - The text truncation (600 chars/node) is the architecture's "few hundred tokens per node".
    5. **Haiku loop** (if an anthropic key is set):
       - `client = new Anthropic({ apiKey: keys.anthropic, timeout: 30_000, maxRetries: 1 })`
       - up to **3 turns**: `client.messages.create({ model: 'claude-haiku-4-5', max_tokens: 4096, system, tools, tool_choice: { type: 'auto' }, messages })`
       - collect `tool_use` blocks → `toolCallToGhost`, and reply with **one** user message holding every `tool_result` (`'ok'` or `is_error: true` + message)
       - stop when `stop_reason !== 'tool_use'`
       - result → `{ghosts, mode:'haiku'}`
    6. On an Anthropic error (catch `Anthropic.APIConnectionError`, `Anthropic.RateLimitError`, `Anthropic.APIError`) or a missing key → **Groq loop**: the same prompt, `toGroqTools()`, model `GROQ_ORGANIZE_MODEL || 'llama-3.3-70b-versatile'`, max 3 turns, `tool_choice:'auto'`, `role:'tool'` results. → `mode:'groq'`, `message: 'Used the backup model.'`
    7. On a Groq error or missing key → **offline**: one ghost per cluster, with `label = the most common domain or tag among the members, or 'Suggested group {i}'`, `rationale = '{n} pages with similar text'`, `confidence = cohesion`, and no edges. → `mode:'offline'`, `message:"Couldn't reach the AI service. Showing unnamed groups from your pages."`
    8. Log `[organize]` with mode, counts and ms. Page text is never logged.
- **GOTCHA**:
  - **No `thinking`, no `effort`, no assistant prefill** on Haiku 4.5.
  - Parse `tool_use.input` as an object. Don't string-match it.
  - Bound the loop at 3 turns and the whole call at about 45 s. The renderer shows a spinner.
- **VALIDATE**: `npm run typecheck && npm run build`
- **SATISFIES**: AC-7

#### Task 8.5 SPIKE 3: suggestion quality on unseen topics (timebox 20 min)

- **IMPLEMENT**:
  - With Tasks 8.1–8.4 wired (and 8.6 done enough to see ghosts), capture about 10 pages on a topic never tried before and run Organize. Count the acceptable ghosts. Repeat on a second topic.
  - Tune `threshold`, `minSim` and the prompt.
- **Decision rule**:
  - ≥60% acceptable → ship.
  - 40–60% → tighten the prompt, restrict relations to `supports|answers|contradicts`, and raise `minSim` to 0.55.
  - <40% → ship clusters only: remove `proposeEdge` from the tool list, and rename the button and panel "Suggest groups".
  - Record the result in AMENDMENTS.
- **VALIDATE**: manual (recorded percentages)
- **SATISFIES**: AC-7 (PRD ≥60% hypothesis)

#### Task 8.6 CREATE `ai/ghostsToFlow.ts`, `OrganizeButton.tsx`, `SuggestionsPanel.tsx`, `GhostGroupNode.tsx`

- **IMPLEMENT**:
  - `ghostsToFlow(board)`: filter ghosts through `canApply`.
    - A group ghost → an RF node `{id:'ghost-'+g.id, type:'ghostGroup', position: bbox(members).topLeft - (24,48), style:{width,height: bbox + padding}, zIndex: -1, selectable:false, draggable:false}`. It renders `GroupFrameView ghost` with label = the proposed label + " (suggested)". It shows **Accept** / **Reject** `sm` buttons on hover next to the label (`pointer-events: all` only on the buttons).
    - An edge ghost → an RF edge `{id:'ghost-'+id, type:'labeled', data:{ghost:true, ghostId}}`. Hovering the label pill shows ✓ / ✕.
    - A tag ghost → shown only in the panel, plus a dashed TagChip "(suggested)" on the card.
  - `OrganizeButton` (top bar, `variant="secondary"` with the `graph` icon; the browser pane's "Add to canvas" is the screen's primary button, and the question card is the canvas's single brand fill):
    - label "Organize", then "Organizing…" with a spinner and disabled while running
    - on click: `snapshot = buildSnapshot(board, workspace)`, `res = await api.ai.organize(snapshot)`, `setGhosts(res.ghosts)` (replacing the previous pending ghosts), open the side panel "Suggestions" tab
    - toast `res.message` or "{n} suggestions to review"
  - `SuggestionsPanel`:
    - the header "Suggestions ({n})" with "Accept all" / "Reject all"
    - a list of `GhostSuggestion` cards (kind cluster/edge, title, reason, confidence) with `onAccept={acceptGhost}` / `onReject={rejectGhost}`
    - hovering a card highlights its ghost on the canvas (set `hoveredGhostId` in appStore, and the ghost node or edge gets a `wa-ghost-hot` class with a thicker dash)
    - empty state: "No suggestions yet. Capture a few pages, then press Organize."
- **GOTCHA**:
  - Ghost RF nodes must not be members of the store. They are derived. Their ids are prefixed `ghost-` and ignored by `onNodesChange` → store sync.
  - Accepting a group ghost packs its members (Task 1.3 `createGroup`). Call `fitView` on the new group afterwards so the change is visible.
- **VALIDATE**: `npm run dev`:
  - Organize shows dashed groups and edges on the canvas and cards in the panel.
  - Accept → it turns solid (a group in its colour, an edge in brand teal), and Ctrl+Z restores the ghost.
  - Reject removes it.
  - Unplug the network → the offline message and unnamed groups.
- **SATISFIES**: AC-7

---

### Phase 9 — Polish and rehearsal

#### Task 9.1 Visual polish pass against DESIGN.md rules

- **IMPLEMENT**: Check the DESIGN.md "Rules for building screens" (lines 55–61):
  - only the QuestionCard is brand-filled on the canvas
  - `focus` rings (2 px solid, 2 px offset) on every control, including React Flow Controls
  - `shadow-lift` while dragging: `.react-flow__node.dragging .wa-card { box-shadow: var(--shadow-lift) }`
  - edge labels in sentence-case verbs
  - no emoji and no "!" in copy
  - overline badges uppercase via CSS
  - dark mode (flip Windows theme): contrast, the minimap mask, the Controls background (`.react-flow__controls-button { background: var(--surface); color: var(--ink); border-color: var(--line) }`)
  - `.react-flow__attribution` hidden
  - cursor states
  - empty canvas state: the question card centred plus hint overlay
- **VALIDATE**: `npm run lint && npm run typecheck && npm test && npm run build`
- **SATISFIES**: AC-10, AC-dark

#### Task 9.2 REPLACE sample with the real one + rehearse

- **IMPLEMENT**:
  - In the app, build the sample topic for real: capture about 12 pages (reusing the placeholder's list), add highlights, notes and 3 groups, and run Organize and accept a few suggestions.
  - Export JSON (with embedded thumbs) → overwrite `resources/sample/sample.webatlas.json`. Keep it under 3 MB (thumbs are resized to 520 px).
  - Pre-warm the embeddings model cache.
  - Rehearse the PRD MVP script (steps 1–8) **3 times in a row** with no crash (Level 4 below).
- **VALIDATE**: `npx vitest run src/shared/export` (the sample-schema test still passes) + the manual rehearsal checklist
- **SATISFIES**: AC-1, AC-11 (demo reliability)

---

## TESTING STRATEGY

The user chose Vitest unit tests for pure logic only, plus typecheck and lint, with no automated end-to-end tests. There are no existing tests to mirror, so the conventions set here are:

- Test files sit beside their subject as `*.test.ts` and run in the `node` environment.
- No Electron imports in tested modules. Functions that need paths or `app` take them as parameters (for example `initPaths(root)`).
- Fixtures are built inline with small factory helpers (`makeNode({ ...overrides })`) at the top of each test file.

### Unit Tests

| File | What it proves |
|---|---|
| `src/renderer/src/store/commands/commands.test.ts` | Round-trip `apply → apply(inverse)` equals the original for every command. Cascades, question protection, `createGroup` packing and undo, batch ordering, ghost accept/undo, redo determinism. |
| `src/shared/kind.test.ts` | `detectKind`, `normalizeUrl` |
| `src/main/storage/atomicWrite.test.ts` | Concurrent writes leave the last content and no tmp files |
| `src/main/ai/cluster.test.ts` | Clustering thresholds, exclusion of existing pairs, determinism |
| `src/main/ai/tools.test.ts` | Tool-input validation → ghost mapping, confidence floor, dedupe |
| `src/shared/export/export.test.ts` | Markdown and JSON Canvas shape, absolute coordinates, ghost exclusion, colour map, the sample file passes the schema |
| `src/renderer/src/features/search/searchIndex.test.ts` | Fuzzy hits, match-line text, tag aggregation, the 8-row cap |

### Integration Tests

None automated (by decision). The integration path is the Level 4 manual checklist, run 3 times in a row.

### Edge Cases

- Capturing the same URL twice (including `#hash` and `utm_` variants) selects the existing card and doesn't duplicate it.
- A capture on a Google results page or `about:blank` is refused with a toast.
- Readability throws (Trusted Types) → the card is still created, with an empty `text`.
- `capturePage` fails → a skeleton thumbnail, and the card is still created.
- Highlight with an empty selection → toast. Highlight on a page not yet on the board → the page is captured first.
- A PDF selection via the context menu (because `getSelection` fails in the PDF viewer).
- Deleting a card with edges and group membership → undo restores all three.
- Deleting the question card → no-op.
- Dragging a card into, out of and between groups is one undo step each.
- A ghost referencing a node deleted after Organize is dropped by `canApply` and not rendered.
- Running Organize twice replaces the pending ghosts and never duplicates accepted edges.
- No API keys → offline clusters and the message. Fewer than 3 cards → the "capture a few more pages" message.
- Closing the window within 500 ms of an edit → the close handshake flushes the save.
- A corrupted `workspace.json` → falls back to `.bak`.
- An imported file that isn't WebAtlas → toast "This file isn't a WebAtlas workspace".
- Dark mode: every token pair stays readable, and the dots stay subtle.

---

## VALIDATION COMMANDS

Run from the repo root (PowerShell or Git Bash; all commands are non-interactive).

### Level 1: Syntax and style

```
npm run typecheck
npm run lint
```

### Level 2: Unit tests

```
npm test
```

### Level 3: Build (integration of main, preload and renderer bundles)

```
npm run build
```

### Level 4: Manual validation (the demo script; run 3 times in a row with no crash or dead end)

1. With the userData `workspaces` folder deleted (`Remove-Item -Recurse "$env:APPDATA\webatlas\workspaces"`), run `npm run dev` → the Welcome screen shows "Everything stays on your device."
2. "Open sample workspace" → the board shows thumbnails, groups and typed edges. Go back home.
3. "Create workspace" with a question → the question card is centred and the hint overlay appears.
4. Search "coastal flood insurance" in the address bar, open a result, press **Alt+A** with focus inside the page → a card appears with thumbnail, favicon and a summary within a few seconds.
5. Click a link in the page, press Alt+A → the new card has an **opened from** edge.
6. Open a YouTube video → a video card. Open an arXiv PDF → a PDF card. Each is visually distinct.
7. Toggle **Auto**, navigate 3 pages → 3 cards and no duplicates.
8. Select text, press **Alt+H** → the quote appears on the card. Right-click a link → "Add link to canvas".
9. Double-click the canvas → edit a note. Drag a handle → an edge. Double-click the edge → "supports". Select 3 cards → Group → rename → colour.
10. Ctrl+Z ×3 and Ctrl+Shift+Z ×3 → state restored exactly.
11. Ctrl+K "flood" → the result shows its match line. Enter pans to the card.
12. Focus view with a card selected → neighbours are bright. List view grouped by tag → click a row → it jumps.
13. **Organize** → ghosts appear dashed with reasons. Accept 2, reject 1, then Ctrl+Z the last accept → the ghost is back.
14. Export Markdown, JSON and Canvas → the files are written. Import the JSON from Home → a new workspace with thumbnails.
15. Close the app right after an edit. Relaunch → the workspace card shows the counts. Open it → all nodes, edges, notes, viewport, view mode, capture mode and the browser URL are restored.
16. Switch Windows to dark mode → the whole UI is readable.
17. Disconnect the network, then Organize → the offline message and unnamed groups, with no crash.

### Level 5: Additional validation (optional)

- Open the exported `.canvas` in Obsidian (if it's installed) → the groups, links and labelled edges render.
- DevTools console (`Ctrl+Shift+I` in dev) shows no React Flow warnings about parent order or missing `nodeTypes`.

---

## ACCEPTANCE CRITERIA

- [ ] **AC-1** First launch shows the Welcome screen with Start blank / Open sample and "Everything stays on your device." The sample opens with thumbnails and the hint overlay shows once.
- [ ] **AC-2** Creating a workspace with a name and an optional research question puts a non-deletable question anchor card on the canvas.
- [ ] **AC-3** Split browser and canvas. "Add to canvas" (button, Alt+A from inside the page, context menu) captures webpage, video, PDF and any link as visually distinct cards with favicon, title, thumbnail and summary. Manual/Auto toggle. An automatic "opened from" edge. Highlights attach to the card. Duplicates are not created.
- [ ] **AC-4** Obsidian-style editing: pan and zoom, fit, double-click note, select, box/shift-select, move, resize, connect with labelled arrows, groups that carry their children, a colour palette, a floating toolbar (colours, tag, note, open, zoom, delete, group), Delete, Ctrl+A, arrow nudge, and **undo/redo for every change, including accepted AI suggestions**.
- [ ] **AC-5** Ctrl+K (from anywhere, including inside the webview) searches titles, URLs, notes, highlights, tags and comments, shows what matched, and jumps to the node.
- [ ] **AC-6** Graph, focus and list views, switchable with the ViewSwitcher.
- [ ] **AC-7** Organize produces ghost groups and ghost typed edges (at least supports and answers) with a one-sentence reason and confidence, **never auto-applied**. Accept and Reject work per item and in bulk, and accept is undoable. It falls back to Groq, then to offline clusters, with a clear message. Spike 3's decision has been applied.
- [ ] **AC-8** Autosave (debounced about 500 ms, atomic, flushed on close). Workspace home lists the workspaces sorted by last opened. Reopening restores all nodes, edges, notes, viewport, selection, view mode, capture mode and the browser's last page.
- [ ] **AC-9** Export to Markdown, JSON (with thumbnails) and JSON Canvas. Importing a JSON creates a new workspace.
- [ ] **AC-10** The UI follows DESIGN.md tokens, type and components. There is one brand fill on the canvas (the question card), and every control has a focus ring and a word or tooltip.
- [ ] **AC-dark** Light and dark themes follow the OS.
- [ ] **AC-security** The renderer is sandboxed with context isolation, the webview has no preload, and API keys exist only in main (never in IPC payloads, exports or logs).
- [ ] **AC-tests** `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` all pass.
- [ ] **AC-11** The Level 4 checklist passes 3 times in a row.
- [ ] **AC-infra** The scaffold, aliases and scripts work (`npm run dev` launches).

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in order (parallelisable phases noted)
- [ ] Each task's validation passed immediately after the task
- [ ] Spike 1, 2 and 3 outcomes recorded in AMENDMENTS, with decision rules applied
- [ ] All Level 1–3 commands pass with zero errors
- [ ] Level 4 manual checklist passed 3× consecutively
- [ ] Acceptance criteria all met
- [ ] `.env` not committed; `.env.example` committed
- [ ] Code reviewed for quality and maintainability

---

## OPEN QUESTIONS / ASSUMPTIONS

Answered in the clarifying round (2026-09-30):

- One plan with phased checkpoints; the chat agent is excluded (stretch).
- DESIGN.md components ported to TSX as the visual source of truth. Tailwind is for layout mapped to the tokens, and shadcn for behaviour only.
- Vitest for pure logic plus typecheck and lint, no automated end-to-end tests.
- The sample topic is "coastal cities fund climate adaptation", with thumbnails captured by the app and committed.
- Dark mode follows the OS, with no toggle.
- Drag and resize commit one command on end. The highlight hotkey is Alt+H. npm. `.env.example` is committed.

Refinements to the architecture's IPC sketch (not boundary changes; flagged per "inherit, don't re-decide"):

- `thumb.save(workspaceId, nodeId, png)` takes an explicit workspace id. `ai.embed` likewise takes the workspace id (its cache is per workspace).
- Added `ai.status()` (booleans only), `import.sample()`, `app.readyToClose()`, and renderer events `browser:open-url`, `browser:context-action`, `menu:action`, `app:before-close`. They are needed because the webview `new-window` event was removed from Electron, because hotkeys must work while focus is in the webview, and for a safe close-flush.
- Organize tools add `rationale` and `confidence` to `proposeGroup` and `proposeTag` (the architecture listed them only on `proposeEdge`). DESIGN.md requires every suggestion to show a reason, and cards below 40% confidence are hidden.

Assumptions (confirm if wrong; none block execution):

- **Assumed**: fonts are bundled locally via `@fontsource` rather than loaded from Google Fonts, so the demo is offline-safe. This deviates from DESIGN.md's delivery note, not from its type choices.
- **Assumed**: icons use `lucide-react` (architecture) mapped onto DESIGN.md's icon names at stroke width 1.75. DESIGN.md explicitly allows swapping in a library.
- **Assumed**: notes on web cards (`node.note`) live in the Inspector with a small indicator on the card, never in the card body (DESIGN.md NodeCard "Don't"). Note *cards* store their text in `title`.
- **Assumed**: accepting a ghost group packs its members into a grid inside the new group (deterministic layout), instead of drawing a frame around scattered cards.
- **Assumed**: JSON Canvas export uses `link` nodes for web, video and pdf cards (live previews in Obsidian), so per-card notes and highlights are only in the Markdown and JSON exports.
- **Assumed**: the Groq models are `llama-3.1-8b-instant` for summaries and `llama-3.3-70b-versatile` for the Organize fallback, both overridable by env (architecture open question "Groq model choice").
- **Assumed**: the default search engine for the address bar is Google.
- Still open, from the architecture and not blocking: the chat agent (decide at the 5 h mark); whether import-as-new is enough for "collaborative contribution" (ask the organizers); the final 2–3 demo relation types (after spike 3).

## NOTES (open canvas)

**Why the React Flow sync is shaped this way.** React Flow v12 wants controlled nodes that include `measured` dimensions, which only `applyNodeChanges` writes. Deriving nodes purely from the store on every render loses `measured`, and then fitView and the MiniMap misbehave. So the React Flow array is local state that gets **rebuilt from the store when the board changes**, carrying `measured` and `selected` over by id, while transient drag frames live only in React Flow's state. The store sees exactly one command per gesture. This is also what makes undo granular per gesture, as agreed.

**Why action creators are separate from commands.** Commands must be deterministic (redo replays them, ghosts serialise them). Everything non-deterministic (uuids, `Date.now()`, "where is free space", coordinate conversion that depends on measured sizes) happens in `actions.ts` before dispatch. `createGroup` is the one command that computes layout inside `apply`, and it is still deterministic because it depends only on the board state and the payload.

**Router order for Organize.** Haiku (strict tools, best relational reasoning) → Groq (the same tools in OpenAI format, fast, and a different network endpoint in case one is blocked at the venue) → offline embedding clusters. The offline path is what the architecture calls "falls back to unnamed embedding clusters". It still demos "automatic organization" with no network, just without typed edges.

**Cut list if the build runs over** (the PRD says to take time from extras and simplify, not drop features). In this order:
1. link drag-drop (5.6)
2. the Groq Organize fallback (skip straight to offline)
3. edge-ghost hover buttons on the canvas (keep the panel)
4. list view "group by tag" (keep group-by-group only)
5. JSON thumbnail embedding (import shows skeletons)

Never cut: undo, provenance, ghosts with Accept/Reject, resume, Markdown/JSON export.

**Time map vs the architecture's budget.**

| Phase | Budget |
|---|---|
| 0 | 0.75 h |
| 1+2 | 0.9 h |
| 3 | 0.5 h |
| 4 | 1.0 h |
| 5 | 1.0 h |
| 6 | 0.75 h |
| 7 | 0.5 h |
| 8 | 1.0 h |
| 9 | 0.5 h |
| **Total** | **≈6.9 h** |

This is about 0.9 h over the architecture's 6 h. Parallelising Phase 2 with Phase 1, and Tasks 7.1 and 8.1–8.4 with the UI phases (for example with worktrees), brings the critical path to about 6 h. Solo, apply the cut list early.

**Risk register.**

| Risk | Likelihood | Mitigation |
|---|---|---|
| Webview API gaps on a demo site | Low–Med | Spike 1; drop the site from the script |
| onnxruntime-node inside Electron | Med | Spike 2 decision rule; WASM hidden window |
| AI quality on unseen topics | Med | Spike 3 decision rule; "Suggest groups" fallback |
| Hotkeys not firing inside the webview | High if done naively | Menu accelerators (Task 5.4) |
| Venue network | Med | Local fonts, pre-warmed model, offline Organize path, sample workspace |
| React Flow parent/child ordering bugs | Med | Groups first in the array; one geometry helper; commands tests |

## AMENDMENTS

<!-- Append-only. Record the spike 1/2/3 outcomes here during execution. -->

- 2026-10-01 — Execution mode changed from one-pass to **gated, task-by-task**. The build is split into 19 tasks (T01–T19) in [webatlas-tasks.md](webatlas-tasks.md). Each needs automated checks, a user check and a commit before the next starts. The technical content of this plan is unchanged and is the reference for each task. The Phase 3 design-system work gains a dev-only component gallery (T07) for visual review, removed in T19.
- 2026-10-01 — **No commits by Claude.** The user commits manually after checking each task. Ignore any "commit" wording elsewhere in this plan.
- 2026-10-01 — **Testing strategy expanded** (this replaces "Vitest for pure logic only, no e2e" in TESTING STRATEGY and in the clarifying answers):
  - Three layers:
    - unit (Vitest, node)
    - component (Vitest + jsdom + @testing-library/react + user-event)
    - end-to-end (Playwright `_electron` against the built app)
  - Supported by test-only hooks:
    - `WA_E2E` and `WA_USER_DATA` (isolated data folder)
    - `WA_AI_MOCK` (fixed AI and embedding results, no network)
    - `WA_E2E_SAVE_DIR` (bypass the file dialogs)
    - a read-only `window.__waDebug`
    - `data-testid` attributes
    - a local fixture web server in `e2e/fixtures/site/`
  - The harness is set up in T01. Every task adds its own tests and a detailed manual checklist (webatlas-tasks.md).
  - New dev dependencies: `@playwright/test`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`.
  - New scripts: `test:e2e` (build, then `playwright test`) and `test:all`.
  - These add roughly 2–3 h to the estimate.
- 2026-10-01 — **Spike 1 (T02) result: proceed with `<webview>`.** No sites dropped from the demo, and no switch to WebContentsView. On Wikipedia, arXiv abstract, arXiv PDF, YouTube and BBC News, every site loads, logs link navigation, thumbnails via renderer-side `capturePage()` (works in the sandbox), and forwards popups into the same pane. YouTube in-page navigation fires `did-navigate-in-page`. Metadata and selection work, except that the PDF has no title and an empty `getSelection()`. Readability text: Wikipedia 20000 (cap), arXiv abstract 1911, BBC 1437, **YouTube 0** (Trusted Types blocks `innerHTML`), **PDF 0**. Consequences, already in the plan:
  - T11 falls back to the URL filename for PDF titles and to the meta description for YouTube text.
  - T12 takes PDF highlights from the context menu's `selectionText`, not `getSelection()`.
  - The page scripts live in `src/renderer/src/features/browser/webviewScripts.ts` + `readability.ts`, with regression tests in `webviewScripts.test.ts` and `e2e/webview.spec.ts`.
  - The preload exposes `api.on('browser:open-url')`.
- 2026-10-01 — **User requirement: flexible layout, the browser pane is under the user's control.** No permanent browser and no rigid window sizes.
  - (1) The browser/canvas split is freely resizable by dragging the divider, with sensible minimums only.
  - (2) The user can **open and close the browser pane** at any time (a top-bar toggle button with tooltip + shortcut **Ctrl+B**, plus a collapse control on the pane). When closed, the canvas takes the full width.
  - (3) Capture actions (Alt+A, Alt+H, context menu) need a page. When the pane is closed, Alt+A/Alt+H **open the pane** instead of failing silently, and "Open in browser pane" from a card also opens it.
  - (4) The pane's open or closed state and the split ratio are saved per workspace and restored on resume.
  - **Data model:** `Session` gains `browserOpen: boolean` (default `true`) and `splitRatio: number` (browser pane width as a percentage, default 42, clamped 20–80). Added in T04.
  - **Layout:** implemented in T08 with `react-resizable-panels` (a collapsible Panel driven from the store), and covered by T08's component and E2E tests and checklist.
  - **Webview lifetime:** while collapsed, the webview stays mounted but hidden, so the page, scroll position and history survive closing and reopening the pane.
- 2026-10-01 — **Spike 2 (T03) result: keep embeddings in the Electron main process.** transformers.js 4.3 + onnxruntime-node load fine in Electron 39's main process, so no hidden-window or WASM fallback is needed.
  - Model: `Xenova/all-MiniLM-L6-v2`, dtype `q8`, 384 dims; `model_quantized.onnx` is about 22 MB, cached in `userData/models`.
  - Timings: the first run including download took 17 s. A cold load from cache takes 263 ms, and each later call about 7 ms.
  - Quality: sea wall ↔ sea wall 0.617, sea wall ↔ pasta 0.013.
  - Code: `src/main/ai/embeddingModel.ts` (lazy load with retry on failure, `embedTexts`, `cosine`). The spike runner is `embedSpike.ts` behind `WA_SPIKE_EMBED=1` (replaced in T17).
  - Test hooks: `WA_MODEL_CACHE` (shared cache) and `WA_SKIP_MODEL=1`.
  - Note for T17: batch padding shifts q8 vectors slightly (≈0.994), so embed cache misses one text per call.
- 2026-10-01 — **T05 (command layer) implementation notes.** These refine Tasks 1.3–1.4 without changing any boundary.
  - **22 commands**, not 20: `removeComment` (undoes `addComment`) and `addGroups` (undoes `removeGroup`) were added in T04.
  - **Shared helpers:** `src/shared/export/geometry.ts` (`absolutePosition`, `toGroupSpace`, `nodeSize`, `GRID`, `CARD_WIDTH`, `CARD_HEIGHT`, `GROUP_PAD`) and `src/shared/tags.ts` (`normalizeTag`: trim, strip a leading `#`, collapse spaces, lowercase). Both live in `shared` because main (T17's tag ghosts) and the exporters need them too.
  - **Exact undo for removals:** `removeTag`, `removeHighlight` and `removeComment` undo by restoring the previous array (`updateNode`/`updateGroup`), so tag and highlight order survive undo.
  - **Payload values are deep-copied into the board** (`copy()` in `commands/def.ts`). Immer only tracks objects from the base state, so a card added and then tagged in the same batch would otherwise mutate the command payload and corrupt history. A regression test covers this.
  - **No-op commands record no history.** Moving to the same spot or removing a highlight that doesn't exist leaves the board object unchanged, and `dispatch` returns false.
  - `createGroup` cells use the widest and tallest member (default card widths from DESIGN.md: web/video/pdf 260, note 220; default height 240) plus 32 px. Members are packed in reading order.
  - **Deleting a group removes the frame only**, and its cards stay where they are (as in Obsidian Canvas). The question card is never deleted or grouped.
  - `updateNode` ignores `kind` and `parentGroupId`, since parent changes go through `setParent`.
  - **Accepting a stale ghost** (one whose card is gone) drops it silently with no undo step.
  - **`updateQuestion`** edits the question card only. Keeping the app store's `researchQuestion` in sync is wired in T08, when the app store exists.
- 2026-10-01 — **T06 (storage, thumbnails, IPC) implementation notes.**
  - **Ids:** workspace ids must match `^[a-z0-9][a-z0-9-]{0,63}$`, all lowercase because they are the `wa-thumb://` host, which Chromium lowercases. Card ids must match `^[A-Za-z0-9_-]{1,128}$`. Every id is checked before it becomes part of a path. A URL like `wa-thumb://ws/../../x.png` is normalised by the URL parser and stays inside that workspace's thumbs folder.
  - **Safety nets:**
    - `.bak` is refreshed only from a current file that is still valid, so a damaged file never overwrites the backup.
    - Loading a damaged `workspace.json` restores it from `.bak`.
    - A lost or unreadable `index.json` is rebuilt from the workspace folders.
    - `save` refuses a workspace that has been deleted, so a late autosave can't bring it back.
    - Writes, index updates and per-workspace operations are queued with `serialize()`.
  - **Close handshake:** main sends `app:before-close`, waits up to 1.5 s for the renderer's `readyToClose`, then waits for main's own queued writes, and only then destroys the window. The renderer side is `lib/closeHandshake.ts`; T08 passes its autosave `flush()` into it.
  - **IPC:**
    - Handlers accept calls only from the app window's webContents and re-throw errors with a clean message.
    - The AI handlers are stubs until T11 and T17.
    - `export.save` and `import.workspace` already work, with native dialogs, or `WA_E2E_SAVE_DIR` in tests, where import picks the newest `.json` there. T16 adds the exporters, thumbnail embedding and the UI.
    - `import.sample` reports "not available yet" until T16.
  - **`.env`** is read from the project folder, but not in E2E runs, which only use the environment they are given. `ai.status` returns booleans only.
  - **Test hooks:** main passes `--wa-e2e` to the preload, which exposes `window.waE2E`, and the renderer then installs a frozen `window.__waDebug`. `getSession()` returns null until T08.
  - **`src/preload/index.d.ts` was renamed to `window.d.ts`.** TypeScript ignores a `.d.ts` that sits next to a same-named `.ts`, so the E2E specs couldn't see the `window.api` types.
  - **`.prettierignore`** now excludes `e2e/fixtures/site`, so the fixture pages stay byte-for-byte.
- 2026-10-01 — **T07 (design system port) implementation notes.**
  - **Styles:**
    - `tokens.css` is generated from the DESIGN.md §2 tables (31 colours × 2 themes, 3 shadows × 2, 7 spacing, 4 radius, 3 font stacks).
    - `wa.css` is Appendix A verbatim, without the Google Fonts `@import`, and is excluded from Prettier.
    - App additions live in `wa-app.css`, using the same `wa-*` naming and tokens only.
    - `tokens.test.ts` reads DESIGN.md live and checks both files.
    - Tailwind sits in `@layer`, so the unlayered `wa-*` styles always win.
  - **Fonts:** bundled through `@fontsource-variable/fraunces/opsz.css` (family "Fraunces Variable", optical size and weight axes) and IBM Plex Sans 400/500/600 and Mono 400.
  - **shadcn primitives:** written by hand on Radix (`@radix-ui/react-tooltip`, `-popover`, `-dropdown-menu`, `-dialog`, newly added), not with the shadcn CLI.
    - Each Tooltip carries its own Provider, so components work without app setup.
    - The cmdk `Command` wrapper is deferred to T14, where it is first used.
  - **Icons:** lucide-react, mapped onto the DESIGN.md names, plus six app icons: back, forward, reload, more, group and panel open/close.
  - **Components** live in `components/wa/`: Icon, Button, TagChip, NodeCardView, NoteCardView, QuestionCardView, GroupFrameView, EdgeView, CanvasSurface, GhostSuggestion, SelectionToolbarView, CaptureBar, ViewSwitcher, WorkspaceCard and CommandPaletteView. Additions beyond Appendix B:
    - **NodeCardView:**
      - a `summary` line (for T11)
      - a "Has a note" flag
      - colour border
      - a skeleton when the thumbnail is missing or broken
      - a letter when the favicon is broken
      - `showHandles` so React Flow can draw real handles
    - **GhostSuggestion:** a `tag` kind and hover reporting. It renders nothing below 40% confidence.
    - **SelectionToolbarView:** an optional Group button. Clicking the active colour clears it.
    - **CaptureBar:** an editable address with Enter to go and Escape to cancel, plus back, forward and reload buttons.
    - **WorkspaceCard:** a real cover image, a menu slot, and "Opened …" from `lib/time.ts`.
  - **Theme:** `lib/theme.ts` follows the OS (`prefers-color-scheme`) live, with no in-app toggle. In the E2E tests Playwright's default light emulation is switched off, so Electron's `nativeTheme` drives it.
  - **Gallery:** `features/dev/Gallery.tsx`, reached with `?gallery` or View → Component gallery (Ctrl+Shift+G). The menu item exists only in dev and E2E runs. Removed in T19.
- 2026-10-01 — **T08 (home, split screen, autosave) implementation notes.**
  - **Split layout is hand-written** (`features/workspace/SplitLayout.tsx`), not `react-resizable-panels`, which was uninstalled. That library's v4 collapse model can't easily keep the `<webview>` mounted while it is hidden, or stop a drag from collapsing a pane.
    - **Divider:** mouse drag (pointer capture, plus a shield so the web page can't swallow the pointer) and keyboard (arrows ±2%, Shift ±10%, Home and End). It is labelled as a separator with its current value.
    - **Limits:** the width stays within `SPLIT_RATIO_MIN`–`MAX` (20–80%), and the open browser pane is never narrower than 320px.
    - **Hidden browser:** the left side drops to zero width and becomes invisible, but its content stays mounted, so the same document and scroll position come back.
  - **Top bar:** spans the whole window, so the browser toggle is reachable when the pane is hidden. It holds Home, the workspace name, Hide/Show browser, the view switcher, and undo/redo.
    - Search, Organize and Export buttons are added in the tasks that make them work (T14, T18 and T16), instead of as dead placeholders now.
  - **Ctrl+B:** a renderer key handler covers focus inside the app; the menu accelerator (`src/main/menu.ts`, which now builds the whole app menu) covers focus inside the web page. A menu event within 250 ms of a handled key press counts as the same press.
  - **Autosave** (`store/persistence.ts`):
    - Board, session or workspace changes are saved 500 ms after the last change.
    - `flush()` saves now and waits for a save already in progress.
    - Opening a workspace (`store/workspaceActions.ts`) pauses autosave around the swap, so opening never triggers a save.
    - A failed save is retried by the next change or flush.
    - The window-close handshake calls `autosave.flush()`.
    - `researchQuestion` is taken from the question card's title at save time, which keeps it in sync with question edits (the T05 note).
  - **Capture bar:** a CSS grid inside a size container on the browser pane. It uses two rows normally, one row when the pane is at least 860px wide, and a compact layout below 420px.
  - **Placeholders until later tasks:** "Open sample workspace" reports that the sample isn't available yet (T16), the card menu's "Export JSON" says export arrives later (T16), and "Add to canvas" is disabled (T11). Import from the Home screen already works.
- 2026-10-01 — **T09 (canvas core) implementation notes.**
  - **Floating links:** edges don't store handle ids, so `LabeledEdge` attaches each end to the middle of the side facing the other card (`canvas/geometry.ts` `linkEnds`). Arrowheads are SVG markers coloured through CSS (one per tone: neutral, AI teal, ghost, six categories), so they follow the theme.
  - **Linking like Obsidian:** a link can be dropped anywhere on the target card, not only on a handle (`onConnectEnd` looks up the card under the pointer).
  - **One command per gesture:**
    - Drags commit in `commitDrag` (moves plus parent changes, as one undo step). The drop target is the smallest group whose frame contains the card's centre.
    - Resizes commit in `resizeCommitted(id, size, position)` (a corner resize may also move the item).
    - Arrow keys nudge through `nudge`.
    - `deleteSelection` also removes selected links.
  - **Resizing:** only the four corners resize; the edge resize lines are disabled because they sat over the connection handles.
  - **React Flow sync** (`useFlowSync`): the local node and edge arrays are rebuilt during render when the board object changes (the "adjust state during render" pattern), carrying `measured`, `selected` and `dragging` over. Selection (cards, groups and links) is mirrored into `session.selectedIds` and restored on resume.
  - **Editing:** text is edited in place (`InlineText`). New nodes are invisible until React Flow measures them, so the editor focuses on the next frames rather than relying on `autoFocus`. Clicking empty canvas ends editing.
  - **Dev helper:** `window.__waDev.groupSelected(label)` exists in development and E2E runs, until T10 adds the Group button. Removed in T19.
  - **Test setup:** `src/renderer/src/test/setup.ts` stubs `ResizeObserver` and `DOMMatrixReadOnly` for React Flow in jsdom.
  - **Moved to T18:** the "ghost nodes are prefixed `ghost-`" case in `boardToFlow.test`. Ghosts aren't drawn until T18 (`ghostsToFlow`).
  - **Noticed for T10:** grouping packs the cards at their current top-left, so a new group can overlap other cards (for example the question card). This needs a placement pass when the Group button arrives.
- 2026-10-01 — **T10–T12 built as one batch, at the user's request** (with tests, checklists and a break-it check for each).
  - **T10 (toolbar, link editor):**
    - `SelectionToolbar` uses React Flow `NodeToolbar` around a store-driven `SelectionControls`, which can be tested without React Flow.
    - **Note button:** on a page card it opens a small popover for the card's own note (the Inspector arrives in T13); on a note or the question it starts in-place editing.
    - **Tag popover** suggests existing tags.
    - **Group** (2+ cards) creates "New group" with its label ready to rename.
    - **New groups never cover other cards:** `NewGroup.position` is now optional in the command, and `groupSelection` picks a free spot when the natural frame would overlap (this resolves the T09 note).
    - **Link menu:** opened by double-clicking a link or its label; it holds the relations, Custom… (label field) and Delete link.
    - **Link labels** sit above everything, including links inside groups.
    - **Registries:** `canvasControl` (select, reveal, zoomTo, centre) and `browserControl` (navigate, exec, thumbnail and more) let features reach the canvas and the browser without prop drilling.
  - **T11 (capture):**
    - `features/capture/capture.ts` is a pure pipeline with injected dependencies; `capture/index.ts` wires it to the real app.
    - **Provenance:** typing an address resets the parent; following a link keeps it; revisiting a captured page makes that card the parent; a capture becomes the parent.
    - **Race fixed:** the parent is decided when a capture starts. A slow capture doesn't become the parent if an address was typed while it ran.
    - Each capture plus its "opened from" link is one undo step. The summary arrives later through `patchSilently`, with no undo step.
    - **Uncapturable pages:** Google's own pages (home, `/search`, `/webhp`) and non-http pages give a toast instead (silent in Auto mode).
    - **Auto mode** captures 1.5 s after the page settles and dedupes by normalised URL.
    - **Groq summaries** live in `src/main/ai/summarize.ts`. Test runs (`WA_E2E` with `WA_AI_MOCK=1`) return a fixed mock sentence.
    - **CSP:** `img-src` now allows `http:` so favicons from plain-http sites load.
    - **Cards** show at most four lines of the newest highlight.
  - **T12 (shortcuts, context menu, highlights, link drop):**
    - **Research menu:** Alt+A capture, Alt+H highlight, Ctrl+K search (placeholder toast until T14), Ctrl+L address bar.
    - **Hidden browser:** with the pane hidden, Alt+A and Alt+H show it and explain, instead of capturing.
    - **Right-click menu** (`buildPageContextMenu`): Add highlight / link / page to canvas, plus Copy. E2E runs keep the menu on `globalThis.__waContextMenu` instead of popping it up.
    - **Highlights** are capped at 600 characters; a page not yet on the canvas is captured first.
    - **Links dropped** on the canvas (`text/uri-list`) become cards at the drop point.
- 2026-10-01 — **Groq model changed to `qwen/qwen3.8-27b`** (user's decision: Groq discontinued the Llama models). This replaces the "Assumed: llama-3.1-8b-instant / llama-3.3-70b-versatile" note in Open Questions.
  - It is the default in `src/main/ai/summarize.ts` (`DEFAULT_GROQ_MODEL`) and in `.env.example`, for both `GROQ_MODEL` and `GROQ_ORGANIZE_MODEL`. `GROQ_MODEL` in `.env` still overrides it.
  - Qwen 3 reasons before answering by default, so summaries send `reasoning_effort: "none"` (documented at console.groq.com/docs/reasoning). `cleanSummary` also drops any `<think>…</think>` block.
  - **Checked live:** one sentence returned in 191 ms with no reasoning text.
  - **For T17 (Organize fallback on Groq):** decide per call whether reasoning helps; if it's left on, use `reasoning_format: "hidden"` or `"parsed"` and allow a bigger `max_tokens`.
