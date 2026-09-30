# Architecture — WebAtlas (Visual Research & Browser Tab Manager)

**Intent:** [webatlas.prd.md](webatlas.prd.md) · **Mode:** greenfield · **Builder:** solo, React + TypeScript · **Budget:** 6 hours, everything in scope done before Round 1
**Date:** 2026-09-30 · **Status:** decisions agreed in the architecture session

---

## Problem & goals

A student researching under deadline pressure needs every page, video or resource they open to land on a map, along with *why* they opened it and *what they took from it*, so that the structure of their research builds itself while they browse. In hackathon terms the build must show, on one laptop and in one live demo: a polished Obsidian Canvas-style board (Round 1 judges weigh UI), and working automatic organization on topics the judge picks (Round 2 judges weigh functionality). Every decision below is judged by one test: **does it get a complete, reliable, good-looking demo inside 6 solo hours?**

## Approaches considered

### App form
| Approach | Verdict |
|---|---|
| **Website (React SPA with an iframe browser pane)** | ❌ Rejected. Most sites refuse to load in iframes, and a web page can't read another site's content, take screenshots of it, see where it navigates, or read the user's text selection. It fails the core loop. |
| **Browser extension (side panel canvas)** | Viable, since it has full access to real tabs. Rejected because the canvas gets squeezed into a side panel, so there's no browser-and-canvas split in one window, which is the product's signature visual. |
| **Electron desktop app (Windows)** ⭐ | **Chosen.** A real Chromium browser pane gives full control: metadata, page text, screenshots, navigation events and selection. The Node main process hosts storage, embeddings and API keys, so there's no server to run. |
| Tauri | Rejected. It needs Rust for the webview work and has no Node runtime for local embeddings. |

### Embedded browser inside Electron
| Approach | Verdict |
|---|---|
| **`<webview>` tag** ⭐ | **Chosen.** It's a DOM element, so it sits naturally in a resizable split pane, and React overlays (the Ctrl+K palette, toasts) can render on top of it. It exposes navigation events, `capturePage()` and `executeJavaScript()`. Electron discourages it, but it is supported and fine for a demo. |
| `WebContentsView` | Rejected for now. It is the officially recommended API, but it is a native layer: React UI can't overlay it, and its position has to be synced by hand on every resize. That costs about an hour. |

### Canvas engine
| Approach | Verdict |
|---|---|
| **React Flow (`@xyflow/react`)** ⭐ | **Chosen.** Pan and zoom, fit-view, connection handles, labelled edges, multi-select and box-select, a resizer, parent/child groups, minimap and controls are all built in. Cards are plain React components. MIT licence. It matches the Obsidian Canvas feature set closely. |
| tldraw | Rejected. It's a drawing-first model that fights data-backed cards, and production use needs a licence key or shows a watermark. |
| Hand-rolled canvas | Rejected. 3+ hours to reach what React Flow gives for free. |

### Intelligent organization (PRD requirement #2)
| Approach | Verdict |
|---|---|
| LLM-only (send all the pages, get groups and edges back) | Simplest, but less consistent, needs a network, and cost grows with page count. |
| Embeddings-only | Offline and deterministic, but it can't produce *typed* relations (question→answer, supports, contradicts), which the brief explicitly asks for. |
| **Hybrid: local embeddings, then a Haiku agent that calls tools** ⭐ | **Chosen.** Embeddings compute similarity and candidate clusters locally, cheaply and fast. A Claude Haiku 4.5 agent then names clusters and labels relationships **by calling the same canvas commands the UI uses**, and every call becomes a ghost. If the model can't be reached, it falls back to unnamed embedding clusters. |

## Recommended approach

An **Electron + React + TypeScript** desktop app with two panes: a `<webview>` browser on the left and a **React Flow** canvas styled like Obsidian Canvas on the right.

- **Every change to the board goes through one command layer** in the renderer: `addNode`, `connect`, `tag`, `moveToGroup` and so on. The UI dispatches these commands, the undo/redo stack stores their inverses, and the AI agent emits them as **ghosts**, meaning proposed commands that are not applied until the user accepts them.
- **The main process** is the app's "backend". It holds the workspace files (one JSON file per workspace with autosave), thumbnails, local embeddings, the LLM router (Haiku first, Groq fallback), and all API keys.
- **The renderer never touches Node or secrets.** It talks to the main process through a small, typed set of IPC calls.

**Build order:** tools first, then AI. **Phase 1** builds the complete no-AI product: canvas, capture, notes and tags, search, views, workspaces, export. **Phase 2** adds embeddings and the Organize agent. The **chat agent is a stretch goal**, built only if time remains.

## Key decisions

### Stack & libraries
| Concern | Choice | Why / alternatives |
|---|---|---|
| Shell & tooling | **Electron** scaffolded with **electron-vite** (React + TS template) | Main, preload and renderer plus hot reload in one command. The alternative, Electron Forge, is slower to set up. |
| UI | **React + TypeScript**, **Tailwind CSS**, **shadcn/ui** (dialog, command palette, dropdown, tooltip), **lucide-react** icons | Round 1 rewards polish, and shadcn gives a consistent, good-looking UI with little effort. The builder already knows React and TS. |
| Canvas | **`@xyflow/react`** (React Flow v12): custom node types, `NodeResizer`, `NodeToolbar`, `MiniMap`, `Controls`, `Background` (dots) | See the approaches above. |
| State + command layer | **Zustand** store with a hand-written command dispatcher (plus **immer** for immutable updates) | Tiny, no boilerplate, and a natural home for undo/redo. Redux would be heavier with no benefit here. |
| Search | **Fuse.js** (fuzzy, in-memory, over titles, URLs, notes, highlights, tags and comments), shown in a shadcn **Command** (cmdk) palette | Instant at hackathon scale, and needs no index. |
| Page-text extraction | **`@mozilla/readability`** run inside the webview via `executeJavaScript` | Clean article text for summaries and embeddings, where raw HTML would add noise. |
| Local embeddings | **transformers.js** (`@huggingface/transformers`) with **all-MiniLM-L6-v2** (quantized, ~23 MB) | 384-dim vectors, runs on the CPU, fast, free, and works offline after the first download. |
| Clustering | **Hand-written, about 50 lines**: average-linkage agglomerative clustering on cosine similarity, cut at a threshold, plus top-k similar pairs as candidate edges | Deterministic and dependency-free. HDBSCAN (Python) would be overkill and would mean a sidecar. |
| LLM (Organize agent) | **Claude Haiku 4.5** (`claude-haiku-4-5`) via **`@anthropic-ai/sdk`**, using tool use with `strict: true` tool schemas | Reliable, schema-valid tool calls, good relational reasoning, and about $0.02 per Organize run on 30 pages. |
| LLM (fast per-page summary + fallback) | **Groq** via **`groq-sdk`** (a fast Llama-class model) | Near-instant one-line summaries on capture, and a fallback if Anthropic can't be reached. |
| Packaging | **None for the demo** (run with `npm run dev`). electron-builder only if time is left. | An installer adds no judging value. |

### Data model (shape)
- **Workspace** holds `id, name, researchQuestion?, createdAt, updatedAt` and **`session`**: `{ viewport {x,y,zoom}, selectedIds[], browserUrl, viewMode, captureMode }`. This `session` block is what makes "resume exactly where you left off" work.
- **Node** (a card) holds `id, kind: 'webpage'|'video'|'pdf'|'note'|'question', url?, title, faviconUrl?, thumbnailPath?, summary?, text? (extracted, for embeddings), highlights[] {id, quote, createdAt}, note, comments[] {id, text, createdAt}, tags[], color, position, size, parentGroupId?, capturedFromNodeId?, capturedAt`.
- **Group** holds `id, label, color, category: 'topic'|'source'|'importance'|'custom', position, size, note, comments[]`. It is shown as a React Flow parent node, so the cards inside it move with it.
- **Edge** holds `id, source, target, label?, relation: 'opened-from'|'related'|'supports'|'contradicts'|'answers'|'source-of'|'custom', color, origin: 'provenance'|'user'|'ai'`.
- **Ghost** holds `id, command (a serialised command that has not been applied), rationale, confidence`. It is kept in the workspace file so it survives a restart, but is never counted as board content until accepted.
- **Command log** is an in-memory undo/redo stack of `{ command, inverse }`. It is *not* saved, so a restart starts with fresh history.
- **Embeddings** are stored as a separate `embeddings.json` per workspace, keyed by `nodeId` together with a hash of the node's text, so they're only recomputed when content changes.

**On-disk layout (under Electron's user-data folder):** `workspaces/<id>/workspace.json`, `workspaces/<id>/embeddings.json`, `workspaces/<id>/thumbs/<nodeId>.png`, plus a small `index.json` (the workspace list for the home screen: name, updatedAt, node count, cover thumbnail). Saves are debounced (about 500 ms) and **atomic**: each save writes a temporary file and then renames it over the old one, so a crash mid-save never corrupts a workspace.

### Boundaries & contracts
- **Process security:** the renderer runs with `contextIsolation: true`, `nodeIntegration: false` and `sandbox: true`. The preload script exposes one typed `window.api` object and nothing else. The `<webview>` uses its own persistent `partition` (a separate cookie jar), has **no** preload with Node access, and is only ever driven *from* the renderer through `executeJavaScript` (to read metadata, text and selection) and `capturePage`.
- **Secrets:** `ANTHROPIC_API_KEY` and `GROQ_API_KEY` are read only in the main process, from a git-ignored `.env`. They are never sent to the renderer, never written to a workspace or export file, and never committed.
- **IPC contract** (the only surface between the renderer and the main process):
  - `workspace.list / load / save / create / delete / duplicate`
  - `thumb.save(nodeId, pngDataUrl)`
  - `ai.embed(nodes[]) → vectors` · `ai.summarize(text) → string` · `ai.organize(boardSnapshot) → ghostCommands[]` · (stretch) `ai.chat(messages, boardSnapshot) → stream`
  - `export.save(format, content)`, which opens a native save dialog. `import.workspace(file)` handles loading a shared workspace.
- **External services:** only the Anthropic API and the Groq API, both called from the main process. Everything else stays on the device, which matches the PRD's "Everything stays on your device." The one thing that leaves the device is page text sent to the LLM when the user clicks Organize. Page text is truncated to a few hundred tokens per node before sending.
- **The agent's tool surface is the command layer.** Organize gives Haiku the tools `proposeGroup(nodeIds, label, category)`, `proposeEdge(source, target, relation, rationale)` and `proposeTag(nodeId, tag)`. It gets **no** destructive tools (no delete, no move). Its output is always ghosts. **The user is always in control, by construction.**

### Other decisions
- **The command layer comes before the canvas.** Undo/redo, ghosts and the future chat agent all depend on it, and it is expensive to retrofit. Each command has `apply(state)` and `invert(state)`. Accepting a ghost just dispatches its command, so it can be undone like any user action.
- **Provenance capture:** the renderer tracks `lastCapturedNodeId` for the current tab. On navigation (or on the webview's `new-window` event, which is redirected into the same pane), the next capture sets `capturedFromNodeId` and adds an `opened-from` edge automatically.
- **Resource kinds** are detected from the URL and content type (YouTube and Vimeo become `video`, `.pdf` or `application/pdf` becomes `pdf`, anything else is `webpage`). Each kind gets its own card design.
- **Highlights** come from a hotkey or the webview's right-click menu. The renderer runs `window.getSelection().toString()` in the webview and attaches the quote to the node for the current URL, capturing the page first if it isn't on the board yet.
- **Views:** graph (React Flow), **focus** (the selected group or node plus its neighbours, with everything else dimmed or hidden), and **list** (a table grouped by group or tag). The grid view is out of scope.
- **Exports:** Markdown, JSON (the full workspace) and **JSON Canvas (`.canvas`)** so the board opens in Obsidian. It maps almost one-to-one onto React Flow and takes about 20 minutes. **Import:** load a shared workspace JSON as a new workspace, which partly answers the PRD's collaboration question.
- **Onboarding:** welcome screen, a sample workspace (bundled JSON), and a short hint overlay. The coach-mark tour is out of scope.

## Missing pieces
What has to be built because it doesn't exist as a library:
1. **The command layer:** the dispatcher, the inverse of each command, the undo/redo stack, and applying or dismissing ghosts.
2. **Obsidian-style card components:** webpage, video, PDF, note and question cards, plus a group node, a ghost style (dashed, translucent, with Accept/Reject on hover), and a floating selection toolbar.
3. **The capture pipeline:** navigation events lead to metadata, text (Readability), a thumbnail and a summary (Groq), then a node and a provenance edge.
4. **The clustering function:** similarity matrix, agglomerative clustering, candidate edges.
5. **The Organize agent:** the prompt, three strict tools, the tool-call loop (bounded, for example at most 3 turns), and mapping tool calls to ghosts.
6. **Workspace persistence:** index, atomic save, session restore.
7. **Exporters:** Markdown, JSON and JSON Canvas, plus the importer.
8. **Sample workspace content:** a pre-built research topic that looks good in the demo.

### Time budget (for the 6-hour build, not a task plan)
| Block | Budget |
|---|---|
| Scaffold, split layout, webview with navigation | 0.75 h |
| Command layer and store, then React Flow canvas with Obsidian-style cards, groups, edges and toolbar | 1.5 h |
| Capture pipeline (metadata, thumbnail, provenance, highlights, resource kinds) | 1 h |
| Notes, tags, comments, colours, Ctrl+K, focus and list views | 0.75 h |
| Workspace home, resume, sample workspace, export and import | 0.5 h |
| Embeddings, clustering and the Haiku Organize agent, rendered as ghosts | 1 h |
| Polish pass and demo rehearsal | 0.5 h |
| **Stretch, only if ahead:** "Ask the board" chat agent (Haiku, same command tools, streaming) | +1 h |

## Spikes & experiments

Run spikes **1 and 2 within the first 45 minutes** and **spike 3 at the start of the AI block**.

```
Question:      Does <webview> give us what capture needs on real demo sites?
Spike:         One webview. Log did-navigate and new-window events, capturePage() to a PNG,
               executeJavaScript to read the title, og:image, Readability text and the selection,
               on Wikipedia, arXiv, YouTube and one news site. Timebox 20 min.
Decision rule: all four work → proceed. A site blocks or behaves oddly → drop it from the demo script.
               Core APIs fail → switch to WebContentsView (+1 h, cut the list view).
```

```
Question:      Does transformers.js run inside Electron's main process (onnxruntime-node native module)?
Spike:         Embed 3 strings in main with all-MiniLM-L6-v2 and log cosine similarities. Timebox 20 min.
Decision rule: works → keep it in main. Native-module or ABI errors → run transformers.js in a
               hidden renderer or Web Worker with the WASM backend (no native modules) and call it over IPC.
               Both fail → skip embeddings and let Haiku cluster from titles and summaries (LLM-only).
```

```
Question:      Are Haiku's suggestions good on topics we didn't pick in advance? (The PRD's riskiest assumption.)
Spike:         Capture about 10 pages on a topic you've never tried, run Organize, and count the ghosts
               you'd accept. Repeat on a second topic. Timebox 20 min.
Decision rule: ≥60% acceptable → ship as is. 40–60% → tighten the prompt, restrict to 3 relation types,
               raise the similarity threshold. <40% → ship clusters only (no typed edges) and rename the
               feature "Suggest groups".
```

**Cheap calls we just made (no spike needed):** storage format, search library, exports, view modes, colour palette. All can be changed later at little cost.

## Open questions
- [ ] **Chat agent ("Ask the board"):** build it only if the time budget shows at least 1 hour spare after the polish pass. Decide at the 5-hour mark.
- [ ] **Live web previews in cards, or static thumbnails:** default to **thumbnails**, with the live page in the left pane. Revisit only if there's spare time, since live webviews inside cards are heavy.
- [ ] **Is import-and-merge enough for "collaborative contribution"?** Import-as-new-workspace is decided. A true *merge* into an existing board is deferred. Settle it by asking the organizers how collaboration is judged.
- [ ] **Groq model choice:** pick whichever fast Llama-class model is available on the key at build time. It only produces one-line summaries, so quality needs are low.
- [ ] **Which 2–3 relation types to demo:** the default is `opened-from` (automatic), `supports`, `answers`. Confirm after spike 3.
- [ ] **Local PDFs from disk** (from the PRD): out of scope unless there's time. Web PDFs open in the webview's built-in viewer and are captured as `pdf` cards.
