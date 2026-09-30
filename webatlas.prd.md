# WebAtlas — Visual Research & Browser Tab Manager

**Type:** Hackathon build (Problem Statement 4.0) · **Builder:** solo · **Build budget:** 6 hours
**Status:** Draft PRD (intent only). Engineering decisions are in [webatlas.architecture.md](webatlas.architecture.md).
**Date:** 2026-09-30

---

## 1. Problem Statement

A **student researching under deadline pressure** (a paper, literature review or presentation due in one to three days) opens dozens of tabs, videos and PDFs in a short burst. Within an hour:

- they can't remember **why** a given tab was opened or what they took from it,
- they can't **see** how sources relate to each other or to the question they're answering,
- they can't **find** a useful quote or page again without re-searching.

**What it costs:** time lost re-finding sources right before the deadline, weakly structured submissions, and research that disappears when the browser window closes.

**The hackathon context:** the outcome is decided by two rounds of judges. Round 1 (college faculty) pays close attention to UI. Round 2 pays close attention to functionality, including the brief's "challenging" requirement to automatically infer relationships between arbitrary pages.

**The whole product is complete before Round 1.** There is one build and one demo, not staged deliveries. Both judging groups see the same finished app, so it must be polished *and* fully working from the first showing.

The student is the persona the demo tells a story about. The judges are who the product has to win over.

## 2. Evidence

| Claim | Status |
|---|---|
| Students hit tab overload when researching fast before a submission | **Assumption.** Validate with a 2–3 classmate dry run (see Hypothesis) and by asking them how they currently cope. |
| Today they cope with tab groups, bookmarks, OneTab, Notion or Obsidian, a doc of links, or leaving tabs open forever | **Assumption,** confirmed by the builder's intuition. No data. |
| Round 1 judges weight UI heavily | **Observed.** Stated by the builder from knowledge of the judging panel. |
| Round 2 judges weight functionality | **Observed.** Stated by the builder. How they will test it (hands-on or demo, own topics or seeded) is **TBD — needs validation**. |
| Automatic relationship inference works on arbitrary web content | **Unproven.** This is the riskiest assumption. Validate early (see MVP). |

## 3. Thesis (why build it)

**Why this:** Existing tools make you choose. Either you **browse** (a browser, where tabs are a flat list with no memory of why they exist), or you **organize** (a canvas or notes tool, where you copy and paste links in by hand after the fact). The gap is organizing *while* you browse, so the structure builds itself as a side effect of researching.

**Why it beats how students cope today:**
1. **Capture happens while browsing.** An embedded browser has a one-click "add to canvas" for any resource: a webpage, a video, a PDF, or any link. Nothing to copy and paste.
2. **Provenance.** Every node remembers where it came from ("opened from…") and why, so the path of the research is never lost.
3. **Structure you can edit.** The system *suggests* clusters and relationships as ghosts. The student accepts, rejects or edits them and is always in control.
4. **Question-centred.** The research question sits in the middle of the map, so everything is visibly organized around what the submission has to answer.

**The pitch (the same in every round):** "Watch your browsing turn into a map that organizes itself, and you stay in control." A live split screen shows nodes with thumbnails appearing as pages open. Then ghost clusters and relationships appear on a topic the judge chooses, and the user accepts, rejects or overrides them. Every demo shows the visual experience and the working intelligence together.

**Why now:** local embeddings and cheap language models make semantic grouping feasible inside a desktop app with no server. *(This is a weak "why now" for a hackathon, and that's acceptable.)*

## 4. Hypothesis

> **We believe** that a split browser-and-canvas that captures resources with their provenance while you browse, and suggests clusters and relationships as ghosts you can accept or reject, **will cause** judges (and the student persona) to see a messy research session become an organized, exportable map in real time, **resulting in** strong scores from every judge, with the complete product shown from Round 1 onward.
>
> **We'll know we're RIGHT if**, in a dry run before judging, 2–3 classmates who haven't seen the app go from a blank workspace to a grouped, exported map in **under 5 minutes without help**, **and** accept **at least 60%** of AI suggestions on **topics they chose themselves**.
>
> **We'll know we're WRONG if** testers can't work out how to capture a page without being told, **or** they reject most AI suggestions (**under 40% accepted**) on topics that weren't pre-seeded. That would mean the demo only works on the sample data, which is exactly what any judge testing functionality will try.

## 5. Target User & JTBD

**Primary user (persona):** An undergraduate or postgraduate student one to three days before a research submission, starting research on an assigned topic.

**Secondary:** A researcher who wants a well-organized "research deck" of sources, quotes and relationships to share or document.

**Job to be done:**
> *When I have to research a topic in very little time before a deadline, I want every page, video or resource I open to land on a map with why I opened it and what I took from it, so I can see how my research fits together and turn it into a submission without re-finding sources.*

**Non-users (explicitly not for):**
- Teams that need real-time co-editing.
- Company knowledge bases.
- Casual browsing or general tab management with no research goal.
- Mobile users.

## 6. MVP

**The thinnest end-to-end line that proves the hypothesis (and is the demo script):**

1. **First launch:** a welcome screen with **Start blank** and **Open sample workspace**, and the line "Everything stays on your device."
2. **Create a workspace** with a name and an optional **research question**, which becomes the central anchor node.
3. **The research loop:** the browser is on the left and the canvas on the right.
   - Browse by searching or pasting a URL.
   - An **"Add to canvas" button** (plus a hotkey) captures the current resource: a **webpage, a video, a PDF, or any link**. Each resource type is visually distinct.
   - A **Manual / Auto capture toggle** controls whether every navigation becomes a node.
   - Each node shows its favicon, title, thumbnail, and an **"opened from" edge** back to the page it came from.
   - **Highlight** text on a page and the quote attaches to the node.
   - Add **notes and tags**, draw edges by dragging, and group nodes into **coloured categories**. All canvas editing follows the Obsidian Canvas-style model described below.
4. **Ctrl+K search** across titles, URLs, notes, highlights and tags, which jumps to the matching node.
5. **View modes:** the full graph, plus **one** simplified view (focus *or* list).
6. **Organize:** clusters and suggested relationships (for example source→topic, question→answer) appear as **ghosts** with Accept / Reject. The user can override anything by hand.
7. **Resume:** a workspace home shows cards for each workspace. Reopening one restores the canvas view and the browser's last page.
8. **Export** to Markdown (grouped links, notes, highlights, relationships) and JSON (the full structure). Sharing means handing over the file.

### Canvas interaction model: works like Obsidian Canvas

The canvas tools should **feel like Obsidian Canvas**, which many students already know, so there's nothing new to learn. The behaviour should match closely. The branding and visual identity stay WebAtlas's own.

| Obsidian Canvas behaviour | What it means in WebAtlas |
|---|---|
| **Infinite canvas:** pan by dragging empty space or scrolling, zoom with Ctrl+scroll or pinch, zoom-to-fit and reset controls | The same. Zoom-to-fit is also what the research loop uses to keep new nodes in view. |
| **Card types:** text/note cards, web-page (link) cards, file cards, media cards | **Note card** (free text written on the canvas) · **web-page card** (live preview or thumbnail) · **video card** · **PDF/file card** · the **research-question** card. |
| **Create by double-clicking** empty canvas to add a text card, or by dragging items in | Double-click adds a note card. Items from the browser pane are added with the "Add to canvas" button or by dragging onto the canvas. |
| **Select, move and resize:** click, shift-click, drag a selection box, move several at once, resize a card from its corner | The same. |
| **Connect** by dragging from a handle on a card's edge to another card. Edges have arrows, optional **labels** and colours. | The same. Edge labels carry the relationship ("opened from", "supports", "answers"…). |
| **Groups:** a labelled, coloured region. Cards dragged inside move with it. | Groups are how categories are shown (topic, source, importance). AI-suggested clusters appear as ghost groups. |
| **Colour palette:** a small fixed set of card, edge and group colours from a floating toolbar | The same. The colours carry category meaning. |
| **Floating toolbar on selection** (colour, delete, zoom to selection, edit) | The same, plus **tag**, **note** and **open in browser pane**. |
| **Keyboard basics:** Delete, Ctrl+A, Ctrl+Z / Ctrl+Shift+Z, arrow-key nudge | The same. Undo and redo cover everything, including accepted AI suggestions. |
| **Double-click a card to edit it** in place (text) or open it (link) | Double-clicking a web card opens it in the browser pane on the left. Double-clicking a note edits it. |

**What WebAtlas adds on top of Obsidian Canvas:** capture straight from the embedded browser, "opened from" provenance edges, highlights attached to cards, ghost AI suggestions, the research-question anchor, and Ctrl+K search.

**Everything in steps 1–8 above is the finished product, and all of it is done before Round 1.** There is no "polish later" or "AI later" stage. UI polish and the AI features are both part of the one build.

**Scope for a 6-hour solo build.** The original plan was about 8 hours, so about 2 hours of *extras* stay out of scope. The core product doesn't shrink.

| Tier | Scope |
|---|---|
| **In scope (all ready before Round 1)** | Obsidian Canvas-style editing (the table above) · Split browser and canvas · "Add to canvas" for webpage, video and link · Manual/Auto capture · provenance edges · thumbnails · highlights · notes, tags and coloured groups · research-question anchor node · Ctrl+K · graph view plus one simplified view · ghost clusters and suggested edges with Accept/Reject · sample workspace · workspace home and resume · Markdown and JSON export · a polished, consistent visual design throughout |
| **Out of scope (extras beyond the brief)** | Agent loop and activity log · interactive coach-mark tour (the sample workspace plus a short hint overlay replaces it) · grid view · HTML snapshot export · bookmark and pasted-URL import · per-workspace colour and icon |

**If the build runs over:** take time from the out-of-scope extras, never from the in-scope list. If time still runs short, simplify how something is done (for example a simpler visual treatment) rather than drop a feature. A complete, working product matters more than any single flourish.

**Door check (input for `plan-architecture`):**
- **One-way door:** whether the AI suggestions work on *arbitrary* pages, not just the sample. **Spike this at the start of the AI work, not the end.** If it fails, fall back to a narrower but reliable version (for example clustering by shared tags and domains) rather than demo something broken.
- **One-way door:** routing every canvas action through a single command layer (your idea). Expensive to retrofit, so decide it before building the canvas. The details belong in the spec.
- **Everything else** (view modes, export formats, visual styling) is a two-way door. Build it and adjust.

## 7. Success Metrics

| Metric | Target | How measured |
|---|---|---|
| Time from blank to a grouped, exported map (unassisted tester) | **< 5 min** | Time 2–3 classmates in a dry run |
| Unprompted capture | **Every tester** captures a page without being told how | Watch the dry run and note any "how do I…?" moments |
| AI suggestion acceptance on topics the tester chose | **≥ 60%** (wrong below 40%) | Count accepts and rejects during the dry run |
| Demo reliability | **3 full demo runs in a row** with no crash or dead end | Rehearse the MVP script before judging |
| Resume works | Close and reopen restores **all** nodes, edges, notes and the view | Manual check in the rehearsal |
| Feature-complete before Round 1 | **Every in-scope item** works in the rehearsal build | Walk the MVP checklist end to end before the first judging |
| First impression | A viewer understands the concept **within 30 seconds** without narration | Show a classmate the screen for 30 seconds and ask "what does this do?" |
| Outcome | Advance past Round 1; place in Round 2 | Hackathon result |

## 8. Non-goals

- **Real-time multi-user collaboration.** Sharing means handing over a file.
- **Accounts, login or cloud sync.** Local-first only.
- **Replacing a full browser** (extensions, multiple windows, passwords, downloads).
- **A general tab manager** for non-research browsing.
- **Mobile or web versions.**
- **An autonomous research agent** that browses on the user's behalf. It is out of the MVP, a stretch goal at most.
- **Perfect relationship inference.** The goal is useful suggestions the user can edit, not ground truth.
- **Being a copy of Obsidian.** Only the *canvas interaction model* is matched. There is no Markdown vault, no plugins, no backlinks or graph-of-notes, and no Obsidian branding.
- **A public release.** Packaging, auto-update and distribution beyond the demo machine are out of scope.

## 9. Open Questions

- [ ] **Collaboration gap:** the brief says workspaces can be "shared with others for **collaborative contribution**", but the MVP only exports a file. Is **importing and merging** a teammate's exported workspace enough to satisfy the judges? If not, what is the cheapest credible answer?
- [ ] **How will judges test it?** Hands-on or watching a demo? Their own topics or seeded ones? This decides how robust the AI work has to be. **TBD — needs validation** (ask the organizers).
- [ ] **Export to Obsidian's `.canvas` format?** Obsidian Canvas saves boards in an open file format (JSON Canvas). Exporting to it would let a student open their WebAtlas map directly in Obsidian. That's a strong demo moment and a partial answer to "sharing". Is it worth adding to the export options, given the 6-hour budget?
- [ ] **Live web previews or thumbnails:** Obsidian shows live, interactive web pages inside cards. Should WebAtlas cards show live pages too, or static thumbnails with the live page opening in the browser pane? This is a trade-off between visual impact and performance or reliability.
- [ ] **Judging rubric:** is there a written scoring rubric for either round? **TBD — needs validation.**
- [ ] **Which relationship types matter most** for student research (source→topic, question→answer, supports/contradicts, cites)? Pick 2–3 to demo well rather than many done poorly.
- [ ] **Which simplified view to keep:** focus view or list view? Choose based on which demos better in 30 seconds.
- [ ] **Sites that block embedding:** some sites (logins, video platforms) may not work inside an embedded browser. What should the demo route avoid? Verify during the build.
- [ ] **Does "any resource" include local files** (for example a PDF already on the student's disk), or only web resources?
- [ ] **Offline or no-key fallback:** if AI suggestions need a network or an API key at the venue, what happens on demo day? (Decide in the spec.)

---

### Handed to `plan-architecture` (deliberately not decided here)

These came from the builder's notes. They are recorded so they aren't lost, but they are **engineering decisions for the spec**, not product requirements:

- App shell and runtime (the builder's proposal: Electron with a Node/TypeScript main process as the "backend", no separate server).
- How pages are embedded and captured (navigation events, screenshots or thumbnails, highlight capture).
- Storage format and autosave strategy (proposal: one JSON file per workspace, autosave with a short delay, SQLite only if needed).
- Embedding and clustering approach (proposal: local embeddings via transformers.js; a Python sidecar only if clustering demands it).
- Where the language model is called from, and how API keys are protected.
- The **command layer** (addNode, connect, tag, moveToGroup and so on) behind undo/redo, an event log, and ghosts as commands not yet applied.
- How to build Obsidian Canvas-style interaction quickly: whether an existing canvas or graph library gets most of it for free, or whether it's built by hand. **This is the biggest time risk in the 6-hour budget.**
- An hour-by-hour build plan re-fitted to **6 hours** (the original plan assumed 8), with **every in-scope feature, including AI and UI polish, finished before Round 1**. The original "tools first, AI second" order is fine as a build sequence, but nothing gets deferred past the first judging.
