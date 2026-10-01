# WebAtlas — task breakdown (gated execution)

**Source plan:** [webatlas-full-build.md](webatlas-full-build.md). Each task points to the plan's task numbers for implementation detail. The plan is the "how"; this file is the order, the tests and the gates.

## Rules of execution

1. **One task at a time.** Nothing from the next task is started until you say "start T0x".
2. **No commits by Claude.** Claude never runs `git commit`, `git push` or any other command that changes history. You commit yourself after checking. Claude may run read-only git commands (`git status`, `git diff`) to show you what changed.
3. **Every task has two kinds of checks:**
   - **Automated tests**, written in the same task, which must pass before handing over.
   - **A manual checklist.** Every step has an action and an expected result, and every behaviour the task adds gets its own step.
4. **Handover report**, sent when a task is finished:
   - the files changed
   - the output of every automated test command, pass or fail
   - anything that could not be done or behaves differently from the plan
   - the manual checklist, ready to follow
5. You go through the checklist and report any step that fails. Claude fixes it and re-runs the automated tests. The task is done when you say so, and then you commit.
6. Scope changes are logged in the source plan's AMENDMENTS.

Status legend: ⬜ not started · 🔄 in progress · 👀 awaiting your check · ✅ done (you approved) · ⏸ decision needed

> **Time note:** full automated coverage (unit, component and end-to-end) plus these checklists adds roughly 2–3 h to the 6 h build estimate. The cut list in the source plan still applies to features, never to tests.

---

## Test layers (set up in T01, used by every task)

| Layer | Tool | Runs | Covers | File pattern |
|---|---|---|---|---|
| **Unit** | Vitest (node) | `npm test` | Pure logic: commands, storage, clustering, exporters, search, URL helpers | `src/**/*.test.ts` |
| **Component** | Vitest + jsdom + @testing-library/react + user-event | `npm test` | React components rendered alone with the real store: props → markup, clicks → commands | `src/**/*.test.tsx` (file starts with `// @vitest-environment jsdom`) |
| **End-to-end (E2E)** | Playwright `_electron` against the built app | `npm run test:e2e` | Whole-app flows: launch, storage on disk, canvas gestures, capture from local fixture pages, menus, export files, AI in mock mode | `e2e/*.spec.ts` |

**E2E test hooks.** These only work when `WA_E2E=1` and must never change normal behaviour.
- `WA_USER_DATA=<temp dir>`: an isolated app-data folder per test run.
- `WA_AI_MOCK=1`: the AI calls return fixed results from `e2e/fixtures/ai/*.json`, and embeddings use fixed fake vectors. No API keys or network are needed.
- `WA_E2E_SAVE_DIR=<dir>`: export and import skip the native file dialogs and use this folder.
- `window.__waDebug`: read-only `getBoard()`, `getSession()`, `getHistorySizes()`.
- `data-testid` attributes on key elements.
- A local fixture web server (`e2e/fixtures/site/`: `article.html`, `linked.html`, `third.html`, `doc.pdf`) is started by the Playwright config, so capture tests never depend on the internet.

**The full check commands**, used in each task's list:
- `npm run typecheck`
- `npm run lint`
- `npm test` (unit + component)
- `npm run test:e2e` (builds first, then runs Playwright)

---

## Overview

| # | Task | Plan tasks | Depends on | Status |
|---|---|---|---|---|
| T01 | Scaffold, dependencies, hardened window, **test harness** | 0.1–0.3 | — | ✅ |
| T02 | Spike 1: webview capabilities ⏸ → proceed with `<webview>` | 0.4 | T01 | ✅ |
| T03 | Spike 2: local embeddings in Electron ⏸ → keep in main | 0.5 | T01 | ✅ |
| T04 | Shared types, schemas, URL/kind helpers | 1.1, 1.2 | T01 | ✅ |
| T05 | Command layer, store, undo/redo | 1.3–1.5 | T04 | 👀 |
| T06 | Main storage, thumbnails, IPC bridge | 2.1–2.4 | T04 | ⬜ |
| T07 | Design system port + dev gallery | 3.1–3.3 | T01 | ⬜ |
| T08 | Home, new workspace, split screen, autosave/resume | 3.4–3.6 | T05, T06, T07 | ⬜ |
| T09 | Canvas core | 4.1–4.4 | T08 | ⬜ |
| T10 | Selection toolbar + edge editor | 4.5 | T09 | ⬜ |
| T11 | Capture pipeline + summaries | 5.1–5.3, 5.7 | T09, T02 | ⬜ |
| T12 | Hotkeys, context menu, highlights, link drop | 5.4–5.6 | T11 | ⬜ |
| T13 | Inspector side panel | 6.1 | T09 | ⬜ |
| T14 | Ctrl+K search | 6.2 | T09 | ⬜ |
| T15 | Focus and list views | 6.3, 6.4 | T09 | ⬜ |
| T16 | Export, import, sample placeholder, hints | 7.1–7.4 | T08, T09 | ⬜ |
| T17 | AI backend: embeddings, clustering, Organize agent | 8.1–8.4 | T03, T06 | ⬜ |
| T18 | Ghost UI + Spike 3 ⏸ | 8.6, 8.5 | T17, T09, T11 | ⬜ |
| T19 | Polish, real sample, full regression, 3× rehearsal | 9.1, 9.2 | all | ⬜ |

```
T01 ─┬─ T02 ───────────────────────────┐
     ├─ T03 ──────────────────── T17 ──┤
     ├─ T04 ─┬─ T05 ─┐                 │
     │       └─ T06 ─┼─ T08 ─ T09 ─┬─ T10
     └─ T07 ─────────┘             ├─ T11 ─ T12
                                   ├─ T13, T14, T15
                                   ├─ T16
                                   └─ T18 (needs T11, T17) ─ T19
```

**Before any manual checklist:** copy `.env.example` to `.env` and fill in your keys when a task needs them (T11 needs `GROQ_API_KEY`; T17 and T18 need `ANTHROPIC_API_KEY`). Run the app with `npm run dev`.

---

## T01 — Scaffold, dependencies, hardened window, test harness

**Scope:**
- the electron-vite react-ts scaffold in the repo root, all dependencies, and the `@shared` alias
- Tailwind
- `.env.example` and `.gitignore`
- a sandboxed window with `webviewTag`, `will-attach-webview` hardening, the popup redirect, and the CSP
- **the test harness:**
  - Vitest configured for both node and jsdom
  - @testing-library/react, user-event and jest-dom
  - Playwright with an Electron launcher helper (`e2e/helpers/launch.ts`: builds once, launches with a temp `WA_USER_DATA`, returns `{ app, page }`)
  - the fixture web server
  - the E2E env hooks (`WA_E2E`, `WA_USER_DATA`)
  - scripts `test`, `test:e2e`, `test:all`

**Automated tests:**
- `src/shared/sanity.test.ts`: Vitest runs in node.
- `src/renderer/src/sanity.test.tsx`: jsdom and testing-library render a component.
- `e2e/app.spec.ts`:
  - the app launches and one window opens
  - the window's web preferences have `sandbox: true`, `contextIsolation: true` and `nodeIntegration: false`, and `webviewTag` is enabled
  - `typeof window.require === 'undefined'` in the renderer
  - `typeof process === 'undefined'` in the renderer
  - no console errors during startup
  - the app-data path equals the temp `WA_USER_DATA`
- `e2e/fixtures.spec.ts`: the fixture server serves `article.html` and `doc.pdf`.

**Automated check:** `npm run typecheck && npm run lint && npm test && npm run test:e2e`

**Manual checklist:**
1. Run `npm install`. → It finishes with no errors (warnings are fine).
2. Run `npm run dev`. → A desktop window opens within about 10 s.
3. Press `Ctrl+Shift+I` in the window. → DevTools opens.
4. Look at the Console tab. → No red errors, and no "Content Security Policy" violations.
5. In the console, type `window.require`. → `undefined`.
6. In the console, type `process`. → A ReferenceError or `undefined`, meaning Node isn't exposed.
7. Close the window. → The terminal running `npm run dev` exits cleanly with no error stack. **Expected and harmless:** if DevTools was opened, the terminal may show `Request Autofill.enable failed` / `Autofill.setAddresses failed` lines with `source: devtools://…`. They come from Chromium's DevTools asking for a feature Electron doesn't include, not from WebAtlas. Without opening DevTools they don't appear.
8. Run `npm test`. → The sanity tests pass.
9. Run `npm run test:e2e`. → The build completes, a window briefly appears, and all E2E tests pass.
10. Run `git status`. → `.env` is not listed (ignored), and `.env.example` is listed as new.
11. Open `package.json`. → The scripts `dev`, `build`, `typecheck`, `lint`, `test`, `test:e2e` and `test:all` are present.

---

## T02 — Spike 1: webview capabilities ⏸ decision

**Scope:** a throwaway dev screen with one webview and buttons:
- **Log events**
- **Capture thumbnail**
- **Read metadata**
- **Read text (Readability)**
- **Read selection**

Each result shows on screen.

**Automated tests:** none, because the spike code is deleted afterwards. The same capabilities get permanent E2E tests in T11 against the fixture pages. What is added here: `e2e/spike-webview.spec.ts`, which loads `article.html` from the fixture server in the harness and asserts that `capturePage` returns a non-empty image and that Readability returns more than 200 characters. It stays as a regression test for the webview APIs.

**Manual checklist** (Claude gives you a results table to fill in). For each site — `en.wikipedia.org/wiki/Climate_change_adaptation`, `arxiv.org/abs/2106.09685`, that paper's PDF link, a `youtube.com/watch?v=…` video, and one news article:
1. Navigate to the site. → The page renders in the webview.
2. Click a link on the page. → The log shows a navigation event with the new URL.
3. Click **Capture thumbnail**. → A small image of the visible page appears.
4. Click **Read metadata**. → The title, and the image URL if the page has one, are shown.
5. Click **Read text**. → A character count above 0 for articles. 0 is acceptable for the PDF.
6. Select some text on the page, then click **Read selection**. → The selected text is shown. For the PDF this may be empty; note it.
7. On YouTube, click another video. → An "in-page navigation" event is logged.
8. Click a link that opens a new window (Claude supplies a test link). → It opens in the same pane, not a new window.

**Decision:** you tell Claude the outcome:
- all OK → continue
- a site fails → drop it from the demo
- the thumbnail or metadata APIs fail everywhere → stop and discuss `WebContentsView`

Claude records the decision in AMENDMENTS and removes the spike screen.

---

## T03 — Spike 2: local embeddings in Electron ⏸ decision

**Scope:** load MiniLM in the main process and embed 3 sentences. Log the similarities and the load time.

**Automated tests:** `src/main/ai/embed.spike.test.ts` (node) loads the pipeline outside Electron and asserts that `sim(seaWallA, seaWallB) > sim(seaWallA, pasta) + 0.2`. It is marked slow and skipped when the `WA_SKIP_MODEL=1` environment variable is set. It stays as the model regression test.

**Manual checklist:**
1. In PowerShell: `$env:WA_SPIKE_EMBED='1'; npm run dev`. → The app opens.
2. Watch the terminal. → Within 60 s on the first run (download) or 10 s after that, it prints three similarity numbers.
3. Check the numbers. → The two sea-wall sentences score clearly higher (for example 0.6+) than sea wall vs pasta (for example < 0.2).
4. Close the app and repeat step 1. → This time there is no download and it is faster.
5. Check that `%APPDATA%\webatlas\models` exists. → The folder contains the model files.
6. Run `npm test`. → The spike test passes, or is reported as skipped only if `WA_SKIP_MODEL` is set.

**Decision:**
- works → embeddings stay in main
- errors about native modules or ABI → Claude moves them to a hidden window (you'll get a re-check)
- both fail → switch to LLM-only clustering

Claude records the outcome in AMENDMENTS.

---

## T04 — Shared types, schemas, URL/kind helpers

**Scope:** `src/shared/types.ts`, `api.ts`, `schema.ts`, `kind.ts`. `Session` includes `browserOpen` (default true) and `splitRatio` (default 42, clamped 20–80); see the flexible-layout amendment.

**Automated tests:**
- `kind.test.ts`:
  - YouTube `watch?v=`, `youtu.be/` and `m.youtube.com` → video; Vimeo numeric → video; a Vimeo profile page → webpage
  - `.pdf`, `.PDF?x=1` and an extensionless URL with `application/pdf` → pdf
  - Wikipedia and a plain URL → webpage
  - `normalizeUrl` strips `#hash`, `utm_*` and a trailing `/`, keeps YouTube `v=`, lowercases the host but not the path
  - `hostOf`
- `schema.test.ts`:
  - a minimal valid workspace passes
  - each required field removed → fails
  - a wrong `version` → fails
  - an unknown `kind` → fails
  - a `WorkspaceFile` with and without `thumbs` passes
  - a non-WebAtlas JSON → fails
- `types` compile test: `api.ts` satisfies the IPC contract (a typed stub object compiles).

**Automated check:** `npm run typecheck && npm run lint && npm test`

**Manual checklist:**
1. Open `src/shared/types.ts`. → The field names match the data model in `webatlas.architecture.md` lines 70–76 (Claude lists any differences in the report).
2. Open `src/shared/api.ts`. → Every method listed in the architecture IPC contract is present, plus the additions named in the plan's Open Questions. Nothing else.
3. Run `npm test -- kind schema`. → Every case listed above appears as a passing test by name.
4. Decide whether you want any field renamed. It's cheapest now; tell Claude before approving.

---

## T05 — Command layer, store, undo/redo

**Scope:** all 22 command types (the plan's 20 plus `removeComment` and `addGroups`, added in T04), the shared geometry helper, the store, action creators. No UI yet.

**Automated tests** (`commands.test.ts`, `boardStore.test.ts`, `actions.test.ts`):
- For **each** command type: apply → apply(inverse) equals the original board (22 tests).
- `removeNodes` removes connected edges and ghosts, and undo restores all of them.
- `removeNodes` on the question card is a no-op.
- `createGroup` packs members into a grid, and undo restores each member's exact old position and parent.
- `removeGroup` converts children to absolute positions, and undo restores them.
- `setParent` into, out of, and between groups.
- `batch` inverse runs in reverse order, and nested batches.
- `connect` with a missing node → no-op. A duplicate edge → no-op.
- `addTags` lowercases and dedupes, and undo removes the tag only from nodes that didn't already have it.
- Store: dispatch pushes history and clears redo; undo/redo with an empty stack is a no-op; the history cap is 200; `load` clears history; `patchSilently` and `setGhosts` add no history entry.
- Determinism: dispatch → undo → redo gives an identical board.
- Actions: `acceptGhost` → the edge exists and the ghost is gone; undo → the ghost is back and the edge is gone. `rejectGhost` / `acceptAllGhosts` / `rejectAllGhosts`. `canApply` drops a ghost whose node was deleted. `dropIntoGroup` converts coordinates correctly.

**Automated check:** `npm run typecheck && npm run lint && npm test`

**Manual checklist** (no UI yet, so this is a review):
1. Run `npm test -- store`. → Every test above passes and is listed by name. Claude includes the output in the report.
2. Open `commands.test.ts` and look at the round-trip block. → There is one test per command type (22).
3. Temporarily break one inverse by editing a line (Claude tells you which), run the tests, confirm a test fails, then undo your edit. → This shows the tests really check the behaviour.

---

## T06 — Main storage, thumbnails, IPC bridge

**Scope:**
- atomic writes
- the workspace store (index, `.bak`, create, load, save, delete, duplicate, import)
- the `wa-thumb://` protocol
- the typed preload
- IPC handlers (AI stubbed)
- the close-flush handshake
- the E2E hooks `WA_E2E_SAVE_DIR` and `__waDebug`

**Automated tests:**
- Unit, `atomicWrite.test.ts`:
  - 20 concurrent writes leave the last content and no `.tmp` files
  - a simulated EPERM on rename is retried and then succeeds
- Unit, `workspaceStore.test.ts` (temp dir):
  - create builds a question node and a default session
  - list is sorted by `updatedAt`
  - save updates the index counts (the question card isn't counted)
  - load after a corrupted `workspace.json` falls back to `.bak`
  - load with both files corrupt throws
  - delete removes the folder and the index entry
  - duplicate copies the thumbs and rewrites the thumbnail paths to the new id
  - import validates, assigns a new id and writes the thumbs
  - an id containing `../` is rejected
- Unit, `thumbs.test.ts`: URL parsing, strips `?v=`, rejects bad ids.
- E2E, `storage.spec.ts`:
  - `window.api` has exactly the expected top-level keys
  - `workspace.create` then `list` → one entry
  - the file exists on disk under `WA_USER_DATA`
  - `thumb.save` then `fetch(wa-thumb://…)` returns 200 with a PNG
  - `wa-thumb://../../x` → an error
  - save, then close the app within 100 ms, relaunch, load → the change is present (close flush)
  - no API key strings appear in any IPC result

**Automated check:** `npm run typecheck && npm run lint && npm test && npm run test:e2e`

**Manual checklist:**
1. `npm run dev`, then open DevTools (`Ctrl+Shift+I`).
2. Run `await window.api.workspace.create({name:'Test one', researchQuestion:'Why?'})`. → It returns an object with an `id` and a `board` containing one question node.
3. Run `await window.api.workspace.list()`. → One entry named "Test one", with `nodeCount` 0.
4. In File Explorer, open `%APPDATA%\webatlas\workspaces`. → It contains `index.json` and a folder named after the id, which holds `workspace.json`.
5. Open `workspace.json` in Notepad. → Readable JSON, with the name "Test one" and the question "Why?".
6. Run `await window.api.workspace.duplicate('<id>')`, then `list()`. → Two entries; the second is named "Test one (copy)".
7. Run `await window.api.workspace.delete('<copy id>')`. → `list()` shows one entry, and the copy's folder is gone from disk.
8. Run `Object.keys(window.api)`. → Only the documented groups: workspace, thumb, ai, export, import, app, on.
9. Run `await window.api.ai.status()`. → `{anthropic: true/false, groq: true/false}`. There is no key text anywhere.
10. Search the whole `workspaces` folder for your API key text (Windows search or `findstr /s`). → No matches.

---

## T07 — Design system port + dev gallery

**Scope:**
- tokens (light and dark), `wa.css`, the Tailwind mapping, local fonts, shadcn primitives restyled
- all DESIGN.md components as TSX
- a dev-only **Gallery** screen, reached from a dev menu item or `?gallery` and removed in T19

**Automated tests:**
- Unit, `tokens.test.ts`: parses `tokens.css` and asserts that every colour token in DESIGN.md §2.1 exists in both the light and dark blocks with the exact hex value, plus the spacing, radius and shadow tokens.
- Component tests, one file per component:
  - `NodeCardView`:
    - web, video and pdf badges show the correct words
    - selected → class `wa-card--selected` and 4 handles
    - video → play overlay
    - pdf with pages → "N pages"
    - 5 tags → 3 chips plus "+2"
    - only the newest highlight is shown
    - no thumbnail → skeleton
    - a favicon error → letter fallback
    - a node with a note → note indicator
    - `color` set → the border style uses the category variable
  - `NoteCardView`: text and tags.
  - `QuestionCardView`: question text and meta.
  - `GroupFrameView`: label; ghost → `(suggested)` and the dashed class.
  - `Button`: every variant class, the `kbd` chip, disabled state.
  - `TagChip`: coloured → a dot.
  - `GhostSuggestion`: reason and "NN% match" shown; Accept/Reject call their handlers.
  - `SelectionToolbarView`: 6 swatches with `aria-pressed`, every button has an `aria-label`, and clicks call the handlers.
  - `CaptureBar`: Manual/Auto toggle calls `onModeChange`, Enter in the address field calls `onNavigate`, and back, forward and reload fire.
  - `ViewSwitcher`: `aria-pressed` follows the value, a click calls `onChange`, and the hidden views aren't rendered.
  - `WorkspaceCard`: name, counts, relative time; the cover image is used when present.
  - `CommandPalette` (visual shell): rows and the footer text.
- E2E, `gallery.spec.ts`:
  - opens the gallery in light and dark mode and saves screenshots to `e2e/artifacts/gallery-light.png` and `-dark.png` for your review
  - asserts that the fonts Fraunces and IBM Plex Sans are loaded (`document.fonts.check`)
  - asserts that the body background is `#f3efe6` in light mode and `#121715` in dark mode

**Automated check:** `npm run typecheck && npm run lint && npm test && npm run test:e2e`

**Manual checklist** (open the gallery with `npm run dev`, then View → Gallery, and keep `DESIGN.md` open beside it):
1. Background. → Warm paper colour, not white.
2. The "WebAtlas" wordmark. → A serif font (Fraunces), not Arial or Times.
3. Body text. → IBM Plex Sans. URLs are monospaced.
4. Web, video and PDF cards. → Each has a different badge icon and word. The video card has a play circle over the thumbnail area. The PDF card shows "112 pages".
5. A card with 5 tags. → 3 chips and "+2".
6. A selected card. → A teal outline and 4 small round handles.
7. The question card. → Teal filled, serif question text. It is the only teal-filled card.
8. The ghost group. → Dashed border, teal tint, the label ends in "(suggested)".
9. The ghost edge next to a normal edge. → The ghost is dashed, the normal one solid, and both have arrowheads.
10. Buttons. → Primary (teal), secondary, ghost, Accept (teal) and Reject (red outline with the word "Reject").
11. Press `Tab` repeatedly. → Every button and swatch shows a visible blue focus ring.
12. Hover the toolbar buttons. → Each shows a tooltip.
13. Switch Windows to dark mode (Settings → Personalisation → Colours → Dark). → The gallery turns dark green-black, all text stays readable, and the question card becomes light teal with dark text.
14. Switch back to light. → It returns immediately without a restart.
15. Compare `e2e/artifacts/gallery-light.png` and `gallery-dark.png`. → They match what you saw.

---

## T08 — Home, new workspace, split screen, autosave/resume

**Scope:**
- the app store and screen router
- Welcome and the workspace grid (open, duplicate, export placeholder, delete with confirmation)
- the new-workspace dialog
- the resizable split with the browser (address bar, back, forward, reload, popups)
- **the browser pane can be opened and closed by the user** (top-bar toggle + Ctrl+B + a collapse control on the pane). The canvas fills the width when it is closed. The webview stays alive while hidden. The open state and split ratio are saved per workspace
- debounced autosave, resume of the browser URL and capture mode
- the close flush

**Automated tests:**
- Unit:
  - `toUrl.test.ts`: `example.com` → https; `http://x.org` kept; `climate adaptation` → a Google search URL; `localhost:3000` → http; whitespace trimmed.
  - `persistence.test.ts` (fake timers): 5 changes within 500 ms → 1 save; `flush()` saves immediately; no save after `closeWorkspace`.
- Component:
  - `NewWorkspaceDialog`: Create is disabled with an empty name; submit calls `create` with the trimmed name and an optional question.
  - `Welcome`: exact copy "Everything stays on your device." and both buttons.
  - `Home`: sorts by `updatedAt`; Delete asks for confirmation first, and Cancel keeps the workspace.
  - `WorkspaceScreen` layout: the toggle button hides and shows the browser panel and flips its `aria-pressed`/label ("Hide browser"/"Show browser"); Ctrl+B does the same; a resize writes a clamped `splitRatio` into the session.
- E2E, `home.spec.ts`:
  - an empty data folder shows Welcome
  - Create workspace → the workspace screen shows with the name in the top bar
  - navigate the webview to fixture `article.html` → the address bar shows the URL
  - Back → the previous page; Forward works
  - a `target=_blank` link in the fixture opens in the same webview
  - close and relaunch → Home lists the workspace; open it → the webview is on `article.html`
  - duplicate → 2 cards; delete with confirmation → 1 card
  - hide the browser → the webview is not visible and the canvas area is (almost) the full window width; show it → the same page is still loaded (not reloaded); Ctrl+B toggles
  - drag the divider → the pane width changes; relaunch → the same width and open/closed state are restored

**Automated check:** `npm run typecheck && npm run lint && npm test && npm run test:e2e`

**Manual checklist:**
1. Delete `%APPDATA%\webatlas\workspaces` (or rename it), then `npm run dev`. → The Welcome screen shows "WebAtlas" in serif, "Your browsing, drawn as a map.", **Create workspace**, **Open sample workspace**, and "Everything stays on your device."
2. Click **Create workspace**, leave the name empty. → The Create button is disabled.
3. Type the name "Flood finance" and the question "How do coastal cities fund adaptation?", then click Create. → The split screen opens: browser on the left, canvas area on the right, and "Flood finance" in the top bar.
4. Click the address bar, type `wikipedia.org`, and press Enter. → Wikipedia loads, and the address bar shows `https://www.wikipedia.org/`.
5. Type `sea level rise` in the address bar and press Enter. → A Google search results page loads.
6. Click a result, then click **Back**. → The results page returns. Click **Forward**. → The result page returns.
7. Click **Reload**. → The page reloads.
8. Find a link that opens in a new tab (for example a Wikipedia "external link" with Ctrl+click, or any `target=_blank`). → It opens in the same left pane, and no new window appears.
9. Drag the divider between the panes left and right. → It resizes smoothly and doesn't get stuck while over the page.
10. Toggle **Auto** in the capture bar. → The toggle turns teal.
11. Close the app window. → It closes within about 1–2 s.
12. `npm run dev` again. → Home shows the "Flood finance" card with its question and "Opened just now" (or a minute count).
13. Open it. → The browser shows the last page you were on, and the capture toggle is still on Auto.
14. Go back to Home (top-left button). Open the card menu → Duplicate. → A "Flood finance (copy)" card appears.
15. Card menu → Delete on the copy. → A confirmation dialog appears; Cancel keeps the card, and Delete removes it.
16. Close the app while typing nothing, then reopen it. → Nothing is lost and there are no error toasts.
17. Click **Hide browser** in the top bar. → The browser pane disappears and the canvas area fills the whole window. The button now reads **Show browser**.
18. Click **Show browser**. → The pane comes back on **the same page, at the same scroll position** (not reloaded).
19. Press **Ctrl+B** twice. → It hides, then shows the browser.
20. Use the collapse control on the browser pane itself. → Same as Hide browser.
21. Drag the divider far left and far right. → The pane resizes smoothly and stops at a sensible minimum on each side. Neither pane can be squeezed to nothing by dragging (closing is done with the toggle).
22. Set an unusual width, hide the browser, close the app, and reopen the workspace. → The browser is still hidden. Show it → the unusual width is back.
23. Resize the whole app window (smaller or maximised). → Both panes scale with it, and nothing is cut off or fixed-width.

---

## T09 — Canvas core

**Scope:**
- React Flow wired to the store
- question, web, note and group card nodes; labelled edges
- a drag commits on drop
- dragging into and out of groups
- double-click to add a note, with editing
- the keyboard shortcuts
- minimap, controls, dotted background, snap to grid
- the viewport saved in the session

**Automated tests:**
- Unit:
  - `boardToFlow.test.ts`: groups come before children; children have `parentId` and relative positions; `measured` and `selected` carry over by id; ghost nodes are prefixed `ghost-`.
  - `placement.test.ts`: a free spot avoids overlaps, and a full area falls back after the maximum number of tries.
  - `keyboard.test.ts`: handlers are ignored when focus is in an input or textarea; Delete, Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y, Ctrl+A and arrows map to the right actions.
- E2E, `canvas.spec.ts` (uses `__waDebug`):
  - double-click the pane → a note node exists; type text and blur → its title is saved
  - drag the note → the position changes in steps of 32 px, with one history entry
  - drag from a handle to another card → an edge with relation `related`
  - select and press Delete → the node and its edges are gone; Ctrl+Z restores both; Ctrl+Shift+Z deletes again
  - Delete on the question card → still present
  - create a group (via an action in debug mode), drag a note into it → `parentGroupId` is set; drag it out → cleared; each is one undo step
  - Ctrl+A selects all; an arrow key moves the selection by 32 px
  - pan and zoom, relaunch → the same viewport and the same nodes
  - the minimap and controls are visible

**Automated check:** `npm run typecheck && npm run lint && npm test && npm run test:e2e`

**Manual checklist** (in a workspace):
1. Look at the canvas. → A dotted background, the teal question card, zoom controls at the bottom-left, and a minimap at the bottom-right.
2. Drag an empty area. → The canvas pans, and the dots move with it.
3. Scroll the mouse wheel, or pinch on a touchpad. → It zooms in and out, centred on the cursor. The dots scale.
4. Click the fit-view control. → The view frames all the cards.
5. Double-click an empty area. → A note card appears with a text box. Type "Green bonds" and click outside. → The note shows "Green bonds".
6. Double-click the note. → It is editable again. Press Escape. → The edit is cancelled.
7. Add a second note. Drag the first note around. → It moves smoothly and snaps to the grid when released.
8. Press Ctrl+Z. → The note jumps back to where it was before the drag. Press Ctrl+Shift+Z. → It moves again. Ctrl+Y does the same.
9. Click a note. → A teal outline and 4 handles appear.
10. Drag from a handle to the other note. → An arrow with the label "related" appears.
11. Resize a note from its corner. → It resizes. Ctrl+Z restores the size.
12. Shift-click both notes. → Both are selected. Shift+drag on empty space draws a selection box.
13. Press an arrow key. → Both move by one grid step. Ctrl+Z reverts it.
14. Ctrl+A. → Everything is selected.
15. Select one note and press Delete. → The note and its arrow disappear. Ctrl+Z → both come back.
16. Select the question card and press Delete. → Nothing happens.
17. Double-click the question card and edit the text. → It is saved. Ctrl+Z restores the old text.
18. While typing inside a note, press Ctrl+Z. → It undoes text in the box only, not a canvas action.
19. Create a group (T10 adds the button; for now Claude gives a DevTools command). Drag a note into the group. → The note becomes part of it. Drag the group. → The note moves with it.
20. Drag the note out of the group. → It becomes independent again. Ctrl+Z → it is back in the group.
21. Pan and zoom to an unusual view. Close the app and reopen the workspace. → The same view, the same notes, edges and group.
22. Switch Windows to dark mode. → The canvas, cards, controls and minimap are all readable.

---

## T10 — Selection toolbar + edge editor

**Scope:** the floating toolbar (6 colours, tag, note, open in browser, zoom to selection, group, delete) and the edge double-click menu (relations, custom label, delete).

**Automated tests:**
- Component `SelectionToolbar.test.tsx` (real store): a colour click dispatches `updateNode`/`updateGroup` for every selected id; Tag → popover → Enter adds the tag; the Group button only appears for 2+ cards; Open is hidden for notes.
- Component `EdgeEditor.test.tsx`: choosing "supports" dispatches `updateEdge`; Custom → text → label set; Delete link → `disconnect`.
- E2E, `toolbar.spec.ts`:
  - select 2 notes → the toolbar is visible above them
  - colour rose → both nodes are rose
  - Group → a group is created containing both
  - rename the group label
  - double-click an edge → "supports" → the label changes
  - undo each step in turn → the board returns to its original state

**Automated check:** `npm run typecheck && npm run lint && npm test && npm run test:e2e`

**Manual checklist:**
1. Select one card. → A toolbar appears just above it: 6 colour dots, then tag, note, open, zoom, then a red delete icon.
2. Hover each button. → Each shows a tooltip: Colour rose … Tag, Note, Open in browser pane, Zoom to selection, Delete.
3. Click the rose dot. → The card border turns rose and the rose dot shows a ring. Ctrl+Z → back to no colour.
4. Click Tag, type "must-cite", and press Enter. → A "must-cite" chip appears on the card. Tag again → the existing tags are suggested.
5. Click Zoom to selection. → The view zooms to the card.
6. Select 3 cards. → The toolbar sits above the whole selection and now has a **Group** button.
7. Click Group. → A coloured group frame wraps the 3 cards, and its label is ready for editing. Type "Funding models" and press Enter.
8. Click the group, then pick teal. → The frame turns teal with a teal tint.
9. Double-click an edge. → A menu lists related, supports, contradicts, answers, source of, Custom…, and Delete link.
10. Choose "supports". → The label reads "supports".
11. Choose Custom…, type "cites", and press Enter. → The label reads "cites".
12. Choose Delete link. → The edge is removed. Ctrl+Z → it is back.
13. Select a card and use the toolbar Delete. → It is removed. Ctrl+Z → restored.
14. Press Ctrl+Z repeatedly until nothing changes. → The board is back to how it was before step 3.
15. With a web card selected (after T11), click Open in browser pane. → That page loads on the left. *(You can recheck this after T11.)*

---

## T11 — Capture pipeline + summaries

**Scope:**
- the page scripts
- provenance
- manual and auto capture: dedupe, kind detection, thumbnail, placement, the opened-from edge in one undo step, fit into view, the "Added to canvas" toast with Undo
- link capture
- Groq summaries

**Automated tests:**
- Unit:
  - `provenance.test.ts`: the pure reducer. A typed URL resets it; a link navigation keeps the parent; revisiting a captured URL makes that node the parent; a capture sets it.
  - `captureHelpers.test.ts`:
    - title fallback order: ogTitle → title → host; PDF filename
    - `isCapturable` rejects `about:blank` and Google search results
    - summary text assembly and truncation
  - `summarize.test.ts` (mocked Groq): returns the first line; returns `''` on an error, a timeout or a missing key.
- E2E, `capture.spec.ts` (fixture server, `WA_AI_MOCK=1`):
  - open `article.html`, click Add to canvas → a web card whose title comes from `og:title`, whose `thumbnailPath` file exists on disk, and whose `text` is longer than 200 characters
  - click a link to `linked.html`, capture → a second card with `capturedFromNodeId`, plus an edge with relation `opened-from` and origin `provenance`, created as one undo step
  - capture `linked.html` again → still 2 cards, and the existing one is selected
  - type a URL for `third.html` in the address bar, capture → no opened-from edge
  - `doc.pdf` → kind `pdf`
  - Auto mode: navigate across 3 fixture pages → 3 cards in total, no duplicates
  - the mock summary appears on the card
  - capture on `about:blank` → a toast and no card

**Automated check:** `npm run typecheck && npm run lint && npm test && npm run test:e2e`

**Manual checklist** (`GROQ_API_KEY` set in `.env`, Manual mode):
1. Open `en.wikipedia.org/wiki/Green_bond` and click **Add to canvas**. → Within 1–2 s a web card appears showing a thumbnail of the page, the Wikipedia favicon, the "WEB PAGE" badge, the title "Green bond" and the URL. A toast says "Added to canvas". The card is in view.
2. Wait 5 s. → A one-sentence summary appears under the title.
3. Click the toast's **Undo** (or Ctrl+Z on the canvas). → The card disappears. Ctrl+Shift+Z → it is back.
4. Click a blue link in the article (for example "Climate bond"), then Add to canvas. → A second card appears next to the first with an arrow labelled "opened from" between them.
5. Press Ctrl+Z once. → Both the second card **and** its arrow disappear together. Redo it.
6. Click Add to canvas again on the same page. → No new card; the existing card is selected and centred.
7. Type `bbc.com/news` in the address bar, open any story, and capture. → The card has **no** opened-from arrow (you typed the address).
8. Open a YouTube video and capture it. → The card has the "VIDEO" badge and a play circle, and the title is the video title.
9. Open `arxiv.org/pdf/2106.09685` and capture it. → The card has the "PDF" badge and a sensible title (the paper or file name).
10. Go to a Google results page and click Add to canvas. → The toast says "Open a result first, then add it", and no card is created.
11. Switch to **Auto** and click through 3 different article links. → Each page appears as a card about 1–2 s after it loads, with opened-from arrows chaining them, and revisiting a page doesn't duplicate it.
12. Switch back to Manual and navigate. → No cards are added automatically.
13. Remove `GROQ_API_KEY` from `.env`, restart, and capture a page. → The card is still created, just without a summary. No error dialog.
14. Close and reopen the workspace. → All cards, thumbnails, summaries and arrows are still there.
15. After T10: select a web card and click Open in browser pane. → That page loads on the left.

---

## T12 — Hotkeys, context menu, highlights, link drop

**Scope:**
- application menu accelerators (Alt+A capture, Alt+H highlight, Ctrl+K palette placeholder, Ctrl+L address bar)
- the page right-click menu (add highlight, add link, add page, copy)
- the highlight flow
- dragging a link onto the canvas

**Automated tests:**
- Unit, `highlight.test.ts`: an empty selection → a toast and no dispatch; truncation to 600 characters; a page not on the board → capture first, then highlight.
- E2E, `hotkeys.spec.ts`:
  - trigger the menu item `capture` through the Electron menu API while the webview is focused → a card is created
  - select text in the webview (via `executeJavaScript`), then menu `highlight` → the card has the highlight, and Ctrl+Z removes it
  - send `browser:context-action {type:'link', url: linked.html}` from main → a link card
  - `{type:'highlight', text}` → a highlight added
  - menu `address` → the address input is focused
  - a synthetic drop of `text/uri-list` on the canvas → a card at the drop position

**Automated check:** `npm run typecheck && npm run lint && npm test && npm run test:e2e`

**Manual checklist:**
1. Open a Wikipedia article and **click inside the page text** (so focus is in the browser). Press **Alt+A**. → The page is captured.
2. Select a sentence in the article and press **Alt+H**. → The toast says "Highlight added", and the card shows the sentence on a yellow background.
3. Select a different sentence and press Alt+H. → The card now shows the newest quote. (The older one appears in the Inspector after T13.)
4. Press Alt+H with nothing selected. → The toast says "Select text on the page first".
5. Open a new article that is not on the canvas, select text, and press Alt+H. → The page is captured **and** the highlight is attached.
6. Right-click selected text. → The menu shows "Add highlight to canvas", "Add page to canvas" and "Copy". The first adds the highlight.
7. Right-click a link. → "Add link to canvas". Click it → a card for the link target appears (with a skeleton thumbnail) and an opened-from arrow from the current page's card.
8. Open an arXiv PDF, select text in it, right-click → Add highlight to canvas. → The highlight attaches to the PDF card.
9. Press **Ctrl+L**. → The address bar is focused with its text selected.
10. Drag a link from the page and drop it on the canvas. → A card appears where you dropped it. *(If this doesn't work on your machine, tell Claude; the plan allows dropping this item.)*
11. Ctrl+Z after each of the above. → Each one undoes cleanly.
12. Click a canvas note, then press Alt+A. → It still captures the current page (the hotkey works from both panes).

---

## T13 — Inspector side panel

**Scope:** the Details tab in the right side panel for a card, a note, a group, a multi-selection, or nothing selected.

**Automated tests:**
- Component `Inspector.test.tsx` (real store):
  - nothing selected → the empty-state text
  - title edit + blur → one `updateNode`, one history entry
  - note textarea typing + blur → one history entry (not one per key)
  - add and remove a tag
  - remove a highlight
  - add a comment (with a timestamp)
  - the opened-from link calls `jumpTo`
  - group: label, category, colour, note
  - multi-select: bulk tag and colour
- E2E, `inspector.spec.ts`: select a captured card → the panel shows its URL and summary; editing the note persists after relaunch.

**Automated check:** `npm run typecheck && npm run lint && npm test && npm run test:e2e`

**Manual checklist:**
1. Deselect everything. → The panel reads "Select a card to see its details".
2. Click a captured web card. → The panel shows the editable title, the URL (monospace), the type badge, when it was captured, "Opened from …" if it has a parent, the summary, **Your note**, Tags, Highlights (all of them, newest first) and Comments.
3. Click the URL. → It opens in the browser pane.
4. Click "Opened from …". → The canvas pans to the parent card and selects it.
5. Edit the title and click away. → The card title updates. Ctrl+Z (on the canvas) → the old title.
6. Type a long note and click away. → The card shows a small note icon, and a single Ctrl+Z removes the whole note.
7. Add the tag "policy" and remove it with ×. → The card chips update each time.
8. Delete a highlight with ×. → The card shows the next-newest one, or none.
9. Add a comment "Check with supervisor". → It appears with a time. It persists after closing and reopening.
10. Click a group. → The label, category (topic/source/importance/custom), colour, note and member count. Change the category and colour → the frame updates.
11. Select 3 cards. → "3 selected" with bulk Tag and Colour. Apply a tag → all 3 get it.
12. Click the toolbar's Note button on a card. → The panel opens with the note field focused.

---

## T14 — Ctrl+K search

**Scope:** the Fuse index, the palette, jump-to-node, tag results, and the match line.

**Automated tests:**
- Unit, `searchIndex.test.ts`:
  - the misspelling "rotterdm" → the Rotterdam card
  - a highlight hit gives a match line starting "Highlight ·" with a snippet
  - a note hit → "Note ·"
  - a tag doc → "Tag · N nodes" with ids
  - a group doc
  - results capped at 8
  - ghosts not indexed
  - the index rebuilds when a node changes
- Component `CommandPalette.test.tsx`: typing filters; Up/Down moves the highlighted row; Enter calls `jumpTo` with the id; Escape closes; an empty query shows nothing (or recent items).
- E2E, `search.spec.ts`: Ctrl+K opens the palette while the canvas is focused; the Electron menu item `palette` opens it while the webview is focused; searching a fixture title and pressing Enter → that node is selected and the viewport centres on it.

**Automated check:** `npm run typecheck && npm run lint && npm test && npm run test:e2e`

**Manual checklist** (a workspace with at least 6 cards, including notes, tags and highlights):
1. Click on the canvas and press **Ctrl+K**. → A centred search box with shadow appears; the footer reads "↑↓ to move · Enter to jump to node · Searches titles, URLs, notes, highlights, tags".
2. Click inside the web page, then press Ctrl+K. → The palette also opens.
3. Type part of a card title with one typo. → That card is listed, with a second line of "Title · host".
4. Type a word that only appears in a highlight. → The result's second line starts "Highlight ·" and shows the quote fragment.
5. Type a word only in a note. → "Note ·".
6. Type a tag name. → A "#tag" row with "Tag · N nodes". Enter → all the tagged cards are selected and framed.
7. Type a group name. → A group row. Enter → the canvas pans to the group.
8. Use ↑/↓. → The highlighted row moves. Enter → the canvas pans and zooms to that card and selects it.
9. Press Escape. → The palette closes.
10. Search while in **List** view (after T15) and press Enter. → It switches to Graph and jumps.
11. Type nonsense. → An empty state ("No matches"), with no errors.

---

## T15 — Focus and list views

**Scope:** focus view (the anchor plus its 1-hop neighbours and group, the rest dimmed, auto-fit) and list view (grouped by group or by tag; row click jumps). The view is saved in the session.

**Automated tests:**
- Unit, `focus.test.ts`: nothing selected → anchored on the question card; a card → its neighbours via edges in both directions plus its group; a group → its members plus their neighbours.
- Component `ListView.test.tsx`:
  - group-by-group sections in order, with "Not in a group" last and notes in "Notes"
  - group-by-tag: a card appears under each of its tags
  - columns: type, title, host, tags ≤3, highlight count, time
  - a row click calls `jumpTo` and switches to graph
- E2E, `views.spec.ts`: switch to Focus with a card selected → the non-neighbour nodes have the `wa-dim` class; switch to List → the table is visible; relaunch → the same view mode is restored.

**Automated check:** `npm run typecheck && npm run lint && npm test && npm run test:e2e`

**Manual checklist:**
1. The top bar view switcher shows Graph, Focus and List with icons, and Graph is teal.
2. Select a card that has 2 connections and click **Focus**. → That card and its 2 neighbours (and its group) stay bright, everything else fades, and the view zooms to them.
3. Click a different card while in Focus. → The focus moves to it.
4. Deselect everything while in Focus. → It centres on the question card and its links.
5. Click **List**. → The canvas is replaced by a table (no dots), with sections per group, "Not in a group", and "Notes".
6. Switch "Group by" to **Tag**. → Sections per tag; a card with 2 tags appears in both.
7. Hover a row. → A subtle background. Click it → back to Graph, and that card is selected and centred.
8. Choose List, close the app and reopen it. → It is still in List view.
9. Check List view in dark mode. → Readable.

---

## T16 — Export, import, sample placeholder, hints

**Scope:**
- the Markdown, JSON (with thumbnails) and JSON Canvas exporters
- the native save and open dialogs
- import as a new workspace
- the hand-written sample workspace
- the first-run hint overlay

**Automated tests:**
- Unit, `export.test.ts`:
  - Markdown has the title, the question, the group headings, card links with their kind, summary, note, highlight quotes, tags, the "Not in a group" and "Notes" sections, and the relationships list
  - ghosts are never included
  - JSON Canvas: group nodes come first; child coordinates are absolute; link and text node types; the colour map (rose→"1" … blue→hex); every edge's `fromNode`/`toNode` exists; ids are unique; integer coordinates
  - `toWorkspaceFile` round-trips through the schema
  - the sample file passes `WorkspaceFileSchema`
- Unit, `exportImport.test.ts` (main): JSON export adds the thumbs as data URLs and skips files over 400 KB; import rejects a non-WebAtlas file.
- Component `HintOverlay.test.tsx`: shown when not yet seen; "Got it" hides it and remembers; storage throwing doesn't crash.
- E2E, `export.spec.ts` (`WA_E2E_SAVE_DIR`):
  - export md, json and canvas → 3 files exist and parse
  - import the json → Home shows a second workspace whose nodes and thumbnails exist
  - Welcome → Open sample → the sample workspace opens with 3 groups

**Automated check:** `npm run typecheck && npm run lint && npm test && npm run test:e2e`

**Manual checklist:**
1. In a workspace with groups, notes, highlights and edges, click **Export → Markdown (.md)**. → A Windows save dialog appears with the workspace name as the file name. Save it. → The toast says "Exported to …md".
2. Open the `.md` in Notepad or VS Code. → The research question, a section per group, each card as a link with its type, and its summary, note, quotes and tags, then "Not in a group", "Notes" and "Relationships" (for example "A → supports → B"). No "(suggested)" items.
3. **Export → JSON**, then **Export → Obsidian Canvas (.canvas)**. → Both are saved.
4. If you have Obsidian, copy the `.canvas` into a vault and open it. → The groups with labels and colours, the web cards as live link previews, and the labelled arrows.
5. Go Home → **Import** and pick the JSON. → A new workspace card appears; opening it shows the same board with thumbnails.
6. Home card menu → Export JSON. → It works the same as the top-bar export.
7. Try importing a random `.json` (for example `package.json`). → The toast says "This file isn't a WebAtlas workspace", and nothing is created.
8. Delete the workspaces folder, start the app, and click **Open sample workspace**. → "Sample: Coastal adaptation" opens with the question card, about 12 cards, 3 groups and typed arrows. Thumbnails are skeletons until T19.
9. Create a fresh workspace. → 3 hint bubbles appear: near "Add to canvas" (Alt+A), on the canvas (double-click for a note), and near Organize. Click **Got it**. → They disappear.
10. Create another workspace. → The hints don't appear again.

---

## T17 — AI backend (no UI)

**Scope:**
- cached embeddings
- clustering and candidate edges
- strict tool schemas and mapping from tool calls to ghosts
- the prompt builder
- the Organize router (Haiku, bounded to 3 turns → Groq → offline)
- a dev-only `__waDebug.organize()` helper

**Automated tests:**
- Unit, `cluster.test.ts`: two tight groups plus an outlier → 2 clusters with the outlier excluded; a threshold of 0.99 → none; the maximum cluster count is respected; existing pairs are excluded from candidates; deterministic ordering; question links.
- Unit, `embed.test.ts` (mocked pipeline): only changed texts are re-embedded (a hash hit skips); the cache is written atomically.
- Unit, `tools.test.ts`:
  - each schema has `strict: true`, `additionalProperties: false`, and every property required
  - an unknown id → an error result
  - confidence 0.3 → dropped
  - a duplicate edge → dropped
  - a group with 1 id → an error
  - the Groq tool conversion shape
  - the ghost titles and commands for each kind
- Unit, `prompt.test.ts`: text truncated to 600 characters per node; only real ids appear; the question is included; no API keys.
- Unit, `organize.test.ts` (injected fake clients):
  - fewer than 3 cards → the "capture a few more pages" message
  - Haiku success → `mode:'haiku'`
  - a Haiku loop that keeps calling tools stops after 3 turns
  - `tool_result`s are sent in one user message, with `is_error` for bad calls
  - Haiku throws → Groq is used → `mode:'groq'`
  - both throw → `mode:'offline'` with named-by-domain clusters and no edges
  - no keys → offline without any network call
- E2E, `organize-backend.spec.ts` (`WA_AI_MOCK=1`): call `api.ai.organize` on a board of 6 fixture cards → it returns ghosts of every kind with reasons, and `mode` equals `haiku` (mock).

**Automated check:** `npm run typecheck && npm run lint && npm test && npm run test:e2e`

**Manual checklist** (`ANTHROPIC_API_KEY` and `GROQ_API_KEY` set; a workspace with at least 6 captured pages on one topic):
1. DevTools → `await __waDebug.organize()`. → Within about 20 s it returns `{mode:'haiku', ghosts:[…]}`.
2. Read the ghosts. → The group labels are 1–4 words; each has a one-sentence rationale naming shared evidence; confidence is between 0.4 and 1; the relations are among supports, answers, contradicts and related.
3. Check the terminal. → A `[organize]` log line with the mode, counts and time. **No page text and no keys** are printed.
4. Run it again without changes. → It is faster (the embeddings are cached). The `embeddings.json` file exists in the workspace folder.
5. Put an invalid `ANTHROPIC_API_KEY` in `.env` and restart. → `mode:'groq'` with the message "Used the backup model."
6. Also blank `GROQ_API_KEY` and restart. → `mode:'offline'`, unnamed or domain-named groups, no edges, and the message "Couldn't reach the AI service…".
7. Disconnect Wi-Fi with valid keys. → Offline mode with no crash, and the model still loads from its cache.
8. On a workspace with only 2 cards. → The message "Capture a few more pages first".
9. Restore your keys.

---

## T18 — Ghost UI + Spike 3 ⏸ decision

**Scope:**
- ghost groups and edges drawn on the canvas, with hover Accept/Reject
- the Organize button with a busy state
- the Suggestions tab (accept all, reject all, hover to highlight, empty state)
- tag ghosts in the panel and as a dashed chip
- then the quality spike

**Automated tests:**
- Unit, `ghostsToFlow.test.ts`: ghost group bounding box and padding; `zIndex -1`, not selectable; stale ghosts are filtered out; ids are prefixed.
- Component `SuggestionsPanel.test.tsx`: lists ghosts with their reason and "NN% match"; Accept/Reject dispatch; Accept all / Reject all; the empty-state text; hovering sets `hoveredGhostId`.
- E2E, `organize-ui.spec.ts` (`WA_AI_MOCK=1`):
  - click Organize → the button shows "Organizing…" and is disabled, then ghosts render with the dashed class
  - the panel lists N cards
  - accept a group ghost → a solid group containing its members
  - Ctrl+Z → the ghost is back
  - reject an edge ghost → gone
  - Accept all → no ghosts left, and each is undoable
  - running Organize again replaces the pending ghosts
  - relaunch → the pending ghosts are still shown

**Automated check:** `npm run typecheck && npm run lint && npm test && npm run test:e2e`

**Manual checklist:**
1. Open a workspace with at least 8 captured pages and click **Organize**. → The button reads "Organizing…" with a spinner, then a toast "N suggestions to review", and the right panel switches to **Suggestions (N)**.
2. Look at the canvas. → Dashed teal-tinted frames around the proposed clusters, labelled "… (suggested)", and dashed arrows with labels ending in "?". Nothing solid has been added.
3. Hover a suggestion card in the panel. → The matching ghost on the canvas becomes more prominent.
4. Each suggestion card shows "Suggested group" or "Suggested link", a title, a one-sentence reason and "NN% match". None are below 40%.
5. Click **Accept** on a group. → The cards move neatly into a solid coloured group with that label, and the view frames it.
6. Press Ctrl+Z. → The cards return to where they were, and the ghost reappears in the canvas and the panel.
7. Hover a dashed arrow's label on the canvas. → ✓ and ✕ appear. Click ✓. → The arrow becomes solid teal with the relation label.
8. Reject a suggestion. → It disappears. Ctrl+Z → it is back.
9. **Accept all**. → Every ghost becomes real. Several Ctrl+Z presses undo them one by one.
10. Run Organize again. → The old pending suggestions are replaced, and accepted ones are not suggested again.
11. Close and reopen with suggestions pending. → They are still there.
12. With no cards (a new workspace), open the Suggestions tab. → "No suggestions yet. Capture a few pages, then press Organize."
13. **Spike 3:** on a topic you've never tried, capture about 10 pages, run Organize, and count the suggestions you would accept. Repeat on a second new topic. Tell Claude the two percentages.

**Decision:**
- ≥60% → ship.
- 40–60% → Claude tightens the prompt and thresholds, and you re-check.
- Below 40% → switch to groups only ("Suggest groups").

Claude records the outcome in AMENDMENTS.

---

## T19 — Polish, real sample, full regression, rehearsal

**Scope:**
- a DESIGN.md rules pass in light and dark mode
- the React Flow chrome (controls, minimap, attribution) restyled
- drag lift shadow and focus rings everywhere
- the dev gallery and debug menu removed from normal runs
- the real sample workspace built in the app and committed by you
- the embeddings model pre-downloaded

**Automated tests:**
- Unit: the sample file passes the schema and is under 3 MB.
- E2E, `a11y.spec.ts`: every button in the top bar, toolbar, capture bar and panel has an accessible name; tabbing reaches every control, and each shows a focus outline.
- E2E, `copy.spec.ts`: the visible UI text contains no "!" and no emoji.
- E2E, `smoke-demo.spec.ts`: the full demo script end to end on the fixture site in AI mock mode (welcome → sample → create → capture ×3 with provenance → highlight → note → edge → group → search → focus/list → organize → accept → export → relaunch → resume).
- The **whole suite**: `npm run test:all`.

**Automated check:** `npm run lint && npm run typecheck && npm run test:all && npm run build`

**Manual checklist:**
1. Run the **full demo script** (source plan, Level 4, 17 steps) from a clean data folder. → Every step behaves as described.
2. Repeat step 1 twice more, **three runs in a row** with no crash, freeze or dead end. Note any hiccup.
3. During the runs, check the design rules:
   - only the question card is teal-filled on the canvas
   - every control shows a focus ring on Tab
   - dragged cards lift with a stronger shadow
   - no React Flow logo
   - the controls and minimap match the theme
4. Repeat one run in dark mode. → Everything is readable.
5. With Wi-Fi off: the app starts, fonts look right (serif headings), the sample opens, and Organize falls back gracefully.
6. Confirm the gallery screen and debug menu are no longer reachable in a normal `npm run dev`.
7. Open the sample workspace. → Real thumbnails on every web card.
8. Review `git status` and `git diff`, then commit the whole project yourself.
