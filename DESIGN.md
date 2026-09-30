# WebAtlas Design System

> Single-file reference for the WebAtlas design system (Visual Research & Browser Tab Manager, Problem Statement 4.0). Generated from the live Design System artifact. Everything a builder or coding agent needs is here: principles, tokens for light and dark themes, type, components with props and usage, icons, the bundle source, and stylesheet.

## Contents

1. Brand book
2. Tokens (colour, type, spacing, radius, shadow)
3. Components
4. Icons and assets
5. Cover
6. Using the system in code
7. Appendix A: `bundle.css`
8. Appendix B: `bundle.js`
9. Appendix C: `index.d.ts`

---

## 1. Brand book

WebAtlas turns a messy research session into a map you control. The product is a split screen: an embedded browser on the left, an Obsidian Canvas-style infinite canvas on the right, with a research question at the centre and everything else organised around it. This system styles that canvas and the chrome around it. The audience is a student one to three days before a submission, and two rounds of judges: the first reads the UI closely, the second tests the intelligence.

### Content fundamentals

- Write to "you" and about "your" research. Sentences are short and active: "Add to canvas", "Accept", "Everything stays on your device."
- Sentence case everywhere. Overline badges (`overline` style) are the only uppercase, and they are set in uppercase by CSS from sentence-case text.
- Name things by what the student did, not by system jargon: "opened from Google Scholar", not "parent node". Relationship labels are verbs: opened from, supports, contradicts, answers, cites.
- Suggestions always explain themselves in one sentence ("Shared topic: Rotterdam, Jakarta") and are marked "(suggested)" until accepted. The system proposes; the student decides.
- No emoji. No exclamation marks. Numbers are plain: "24 nodes · 5 groups".

### Visual foundations

**Colour.** The canvas is warm paper (`canvas`) with `surface` cards on it, like a chart on a desk; the dark theme is a night chart. Teal `brand` is scarce and means "yours and active": the research-question card, primary buttons, selection outlines, accepted items. Six category colours (`cat-rose`, `cat-amber`, `cat-moss`, `cat-teal`, `cat-blue`, `cat-plum`) are the fixed palette for groups, edges and tags, each with a `-soft` fill for backgrounds; text on any `-soft` fill is `ink`. Suggested (AI) structure is always dashed, in `ghost-line` on `ghost-fill`. Quotes captured from pages sit on `highlight`. `danger` appears only on Reject and Delete, always with a word.

**Type.** Fraunces (`display` family) for the research question, workspace titles and the wordmark: it gives the product an atlas, printed feel. IBM Plex Sans (`sans`) for all interface text in `title`, `body`, `label`, `caption`. IBM Plex Mono (`mono`) for URLs and keyboard hints, in `url`. Fraunces, IBM Plex Sans and IBM Plex Mono are hosted on Google Fonts, not bundled.

**Space and shape.** Spacing runs on 4px steps (`space-1` to `space-7`); the canvas snaps to `space-6` (32px). Cards use `radius-md`, groups and panels `radius-lg`, edge labels and segmented controls `radius-pill`. Cards rest on `shadow-card`, lift on `shadow-lift` while dragged, and the command palette uses `shadow-overlay`. Hairlines use `line`; anything a user must find or operate (inputs, handles) uses `line-strong`.

**States.** Selected: 2px `brand` outline plus four connection handles. Focus: 2px solid `focus` ring, 2px offset, visible on every surface. Hover: `surface-sunken`. Ghost: dashed. No motion beyond 150ms ease on hover and a pan or zoom on jump-to-node.

**Layout.** The browser pane is left, the canvas right, split resizable. The canvas is dotted: one `canvas-dot` dot every `space-6` (32px) on `canvas`, via the `Canvas` component. The dots pan with the view and scale with zoom, and are decorative only. Floating toolbars sit 12px above the selection.

### Components

Canvas: `Canvas` (the dotted workspace surface), `NodeCard` (web, video, pdf), `NoteCard`, `QuestionCard`, `GroupFrame`, `Edge`, `TagChip`, `SelectionToolbar`. Intelligence: `GhostSuggestion`. Navigation: `CommandPalette` (Ctrl+K), `ViewSwitcher`. Browser pane: `CaptureBar`. Home: `WorkspaceCard`. Base: `Button`, `Icon`. Each card type is told apart by badge icon and word, never colour alone. Each component's README says what the consumer provides.

### Iconography

Icons are simple 24px stroke glyphs (1.75px, round caps) in the `Icon` component, always `currentColor`. They are a custom placeholder set; swap for an icon library of the same weight if the app adopts one. No emoji, no filled icons except the video play triangle.

### Logo

No logo was supplied. Set the name "WebAtlas" in `display-xl` (Fraunces 600) in `ink`; the cover shows the treatment. Do not invent a mark.

### Rules for building screens

- One `brand` fill per view except buttons: the `QuestionCard`.
- Put `ink` text on `canvas`, `surface`, `surface-sunken` and every `-soft` fill; `ink-muted` and `ink-subtle` only on canvas, surface and surface-sunken.
- Never show a suggestion as solid; never auto-accept one.
- Use category colour only for user-meaningful categories (topic, source, importance), and always with a label.
- Every interactive control gets a `focus` ring and a word or tooltip.


---

## 2. Tokens

CSS custom properties use the token name (`--ink`, `--cat-rose-soft`, `--space-4`). Theme is selected with `data-theme="light"` or `data-theme="dark"` on a root element; light is the default.

### 2.1 Colour

| Token | Light | Dark | Usage |
|---|---|---|---|
| `canvas` | `#f3efe6` | `#121715` | The infinite workspace background behind every node. Text on it: ink, ink-muted, ink-subtle. |
| `canvas-dot` | `#c7bfac` | `#34403a` | Dots of the canvas background, one per 32px (space-6) grid step. Decorative only, so deliberately low contrast; never put text on a dot and never use it for borders. |
| `surface` | `#fffdf8` | `#1b2220` | Fill of node cards, panels, the command palette and the browser-pane header. |
| `surface-sunken` | `#ebe6da` | `#0e1211` | Inset areas: thumbnail wells, search fields, the list-view row hover, the browser pane chrome. |
| `ink` | `#1d2320` | `#eceee9` | Primary text and icons on canvas, surface, surface-sunken, highlight and the category -soft fills. |
| `ink-muted` | `#4f5a55` | `#a9b2ad` | Secondary text (URLs, metadata, edge labels) on canvas, surface and surface-sunken. |
| `ink-subtle` | `#5d6863` | `#939d97` | Tertiary text (timestamps, placeholders, counts) on canvas, surface and surface-sunken. Never below 12px. |
| `line` | `#d8d1c2` | `#2c3531` | Decorative hairline between regions (panel dividers, card outlines). Not for controls; use line-strong there. |
| `line-strong` | `#858b82` | `#6d7871` | Borders that carry meaning: input outlines, unselected handles, segmented-control edges. 3:1 on canvas and surface. |
| `brand` | `#0b5d66` | `#62c6cf` | WebAtlas teal: primary buttons, the selected-node outline, accepted edges. Fills take on-brand text; 3:1 against canvas and surface. |
| `on-brand` | `#ffffff` | `#06282c` | Text and icons placed on a brand fill. |
| `brand-soft` | `#d3e9ea` | `#173a3e` | Tint behind ghost suggestions, selected list rows and active segments. Text on it: ink or brand-ink. |
| `brand-ink` | `#0b5d66` | `#86d7de` | Brand-coloured text and links on surface, canvas and brand-soft. |
| `focus` | `#1b55c7` | `#8db4ff` | Keyboard focus ring (2px solid, 2px offset). 3:1 on canvas, surface and brand. |
| `highlight` | `#f8e38b` | `#5c4e12` | Background of a quote highlighted on a page and shown on its node. Text on it: ink. |
| `danger` | `#b3261e` | `#ff8f86` | Reject and delete actions, destructive text. Always paired with a word or icon, never colour alone. |
| `on-danger` | `#ffffff` | `#3a0906` | Text on a danger fill. |
| `ghost-line` | `#5b7f83` | `#7fb0b5` | Dashed outline and dashed edge of an AI-suggested (ghost) cluster or relationship. 3:1 on canvas. |
| `ghost-fill` | `#d3e9ea` | `#173a3e` | Fill of a ghost group before it is accepted. Identical to brand-soft so ghosts read as provisional teal. |
| `cat-rose` | `#b3314a` | `#f08aa0` | Rose category colour (importance: must-cite). Group border, edge colour, tag dot; 3:1 on canvas and surface. Never the only signal: groups also carry a label. |
| `cat-rose-soft` | `#f6dbe0` | `#46202a` | Tinted fill of a rose group or tag. Text on it: ink (4.5:1). |
| `cat-amber` | `#9c5200` | `#e9a54a` | Amber category colour (importance: to check). Group border, edge colour, tag dot; 3:1 on canvas and surface. Never the only signal: groups also carry a label. |
| `cat-amber-soft` | `#f7e2c4` | `#443014` | Tinted fill of a amber group or tag. Text on it: ink (4.5:1). |
| `cat-moss` | `#4a7420` | `#9bd06a` | Moss category colour (topic: background and definitions). Group border, edge colour, tag dot; 3:1 on canvas and surface. Never the only signal: groups also carry a label. |
| `cat-moss-soft` | `#dfeccb` | `#2a3a19` | Tinted fill of a moss group or tag. Text on it: ink (4.5:1). |
| `cat-teal` | `#0b7a84` | `#5cc6cf` | Teal category colour (topic: core argument). Group border, edge colour, tag dot; 3:1 on canvas and surface. Never the only signal: groups also carry a label. |
| `cat-teal-soft` | `#cfeaec` | `#153a3e` | Tinted fill of a teal group or tag. Text on it: ink (4.5:1). |
| `cat-blue` | `#2c62b8` | `#8fb5f2` | Blue category colour (source: papers and PDFs). Group border, edge colour, tag dot; 3:1 on canvas and surface. Never the only signal: groups also carry a label. |
| `cat-blue-soft` | `#d9e5f7` | `#1d2e4a` | Tinted fill of a blue group or tag. Text on it: ink (4.5:1). |
| `cat-plum` | `#8a3a8f` | `#d79ddb` | Plum category colour (source: video and talks). Group border, edge colour, tag dot; 3:1 on canvas and surface. Never the only signal: groups also carry a label. |
| `cat-plum-soft` | `#eddaef` | `#3a2140` | Tinted fill of a plum group or tag. Text on it: ink (4.5:1). |

Contrast: all text tokens meet 4.5:1 on the grounds named in their usage note in both themes; `line-strong`, `focus`, `ghost-line`, `brand` and the six `cat-*` solids meet 3:1 on `canvas` and `surface`. `canvas-dot` and `line` are decorative and intentionally lower.

### 2.2 Type

Families (hosted on Google Fonts, not bundled):

- `display`: `"Fraunces", "Iowan Old Style", Georgia, serif`
- `sans`: `"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif`
- `mono`: `"IBM Plex Mono", ui-monospace, Consolas, monospace`


**Display** (family `display`)

| Style | Size / line | Weight | Tracking | Usage |
|---|---|---|---|---|
| `display-xl` | 48px / 48px | 600 | -0.02em | Welcome screen headline and the cover only. |
| `display-lg` | 28px / 32px | 600 | -0.01em | Workspace title on the workspace home and export headers. |
| `question` | 20px / 26px | 500 | normal | The research-question anchor card. The only place body-size copy is set in the serif. |

**Interface** (family `sans`)

| Style | Size / line | Weight | Tracking | Usage |
|---|---|---|---|---|
| `title` | 15px / 20px | 600 | normal | Node titles, panel headings, workspace card names. |
| `body` | 14px / 21px | 400 | normal | Notes, descriptions, list rows. |
| `label` | 13px / 16px | 500 | normal | Buttons, tabs, segmented controls, tag chips. |
| `caption` | 12px / 16px | 400 | normal | Metadata, edge labels, counts, timestamps. |
| `overline` | 11px / 14px | 600 | 0.08em | Uppercase type badges (WEB, VIDEO, PDF) and group labels. Set text in uppercase. |

**Code** (family `mono`)

| Style | Size / line | Weight | Tracking | Usage |
|---|---|---|---|---|
| `url` | 12px / 16px | 400 | normal | URLs, the browser address bar, keyboard hints. |

### 2.3 Spacing

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4px | Icon-to-label gap, tag chip padding. |
| `space-2` | 8px | Gap between chips and toolbar buttons; card inner gaps. |
| `space-3` | 12px | Card padding, palette row padding. |
| `space-4` | 16px | Panel padding, gap between cards in list view. |
| `space-5` | 24px | Section gaps, workspace-home grid gutter. |
| `space-6` | 32px | Canvas default snap / grid pitch; group inner padding. |
| `space-7` | 48px | Page margins on the welcome and workspace home screens. |

### 2.4 Radius

| Token | Value | Usage |
|---|---|---|
| `radius-sm` | 6px | Tag chips, inputs, toolbar buttons. |
| `radius-md` | 10px | Node cards, buttons, panels. |
| `radius-lg` | 16px | Groups, the command palette, workspace cards. |
| `radius-pill` | 999px | Edge labels, segmented controls, capture toggle. |

### 2.5 Shadow

| Token | Light | Dark | Usage |
|---|---|---|---|
| `shadow-card` | `0 1px 2px #1d232014, 0 2px 8px #1d23200f` | `0 1px 2px #00000066, 0 2px 8px #00000044` | Resting node card on the canvas. |
| `shadow-lift` | `0 6px 18px #1d232024, 0 2px 4px #1d232014` | `0 6px 18px #00000088, 0 2px 4px #00000066` | Card being dragged, floating selection toolbar. |
| `shadow-overlay` | `0 18px 48px #1d232033, 0 4px 12px #1d232014` | `0 18px 48px #000000aa, 0 4px 12px #00000066` | Command palette (Ctrl+K) and modals. |

---

## 3. Components

All components are exposed on `window.WebAtlas` (React 18, no JSX needed). Wrap nothing; they carry their own `wa` classes. Groups: Canvas, Intelligence, Navigation, Browser pane, Workspace home, Actions, Foundations.


### 3.1 Canvas

The dotted workspace surface every node sits on. Props: `dotted` (default true; false gives a plain canvas), `zoom` (multiplies the 32px dot pitch), `offset` (`[x, y]` pan offset so the dots move with the view), `width`, `height`, and children (absolutely positioned nodes).

Dots are `canvas-dot` on `canvas`, one per `space-6`, and are decorative: cards always sit on `surface` above them, so text never lands on a dot. Cards snap to the same 32px pitch. In list view, drop the dots (`dotted={false}`).

Group: Canvas. Example:

```js
const W = window.WebAtlas, h = React.createElement;
function App() { return h(W.Canvas,{height:312},
pos(320,100,h(W.QuestionCard,{question:"How do coastal cities fund climate adaptation?"})),
pos(32,32,h(W.NoteCard,{text:"Green bonds",width:160})),
pos(640,64,h(W.NoteCard,{text:"Check OECD figure",tags:[{label:"to check",color:"amber"}],width:200}))) }
```

### 3.2 NodeCard

The canvas card for a captured resource. Props: `type` (`web`, `video`, `pdf`), `title`, `url`, `thumbnail` (image URL; omit for the skeleton placeholder), `highlight` (quote captured from the page), `tags` (strings or `{label, color}`), `openedFrom` (title of the parent node, shown as provenance), `pages` (PDF only), `selected`, `width` (default 260).

Type is carried by the badge icon, its word and the favicon outline colour (teal web, plum video, blue PDF), never by colour alone. The consumer provides the thumbnail; the card never fetches it. Selected cards show the brand outline and four connection handles; dragging from a handle draws an edge. A highlight is shown once, the newest; older highlights live in the side panel.

Do: keep titles to two lines. Don't: put a note on a web card body; notes are their own `NoteCard` so they can be moved and connected separately.

Group: Canvas. Example:

```js
const W = window.WebAtlas, h = React.createElement;
function App() { return h("div",{className:"row"},
h(W.NodeCard,{type:"web",title:"Sea-level rise and urban finance",url:"https://nature.com/articles/s41558",highlight:"Insurance pools shift cost to the state.",tags:[{label:"must-cite",color:"rose"},"policy"],openedFrom:"Google Scholar",selected:true}),
h(W.NodeCard,{type:"video",title:"Rotterdam: living with water",url:"https://youtube.com/watch?v=x1",tags:[{label:"talk",color:"plum"}],openedFrom:"Sea-level rise and urban finance"}),
h(W.NodeCard,{type:"pdf",title:"IPCC AR6 WG2, Chapter 6: Cities",url:"https://ipcc.ch/report/ar6/wg2/chapter06.pdf",pages:112,tags:[{label:"background",color:"moss"}]})) }
```

### 3.3 NoteCard

A text card created by double-clicking empty canvas. Props: `text`, `tags`, `selected`, `width` (default 220). Editing happens in place by double-clicking; the consumer swaps the paragraph for a textarea set in `body`.

Notes look like web cards minus the thumbnail so the two read as the same family. Keep notes under about 60 words; longer thinking belongs in the side panel.

Group: Canvas. Example:

```js
const W = window.WebAtlas, h = React.createElement;
function App() { return h("div",{className:"row"},h(W.NoteCard,{text:"Key claim: municipal bonds cover less than a third of adaptation cost. Check the OECD figure against the World Bank one.",tags:[{label:"to check",color:"amber"}]}),h(W.NoteCard,{text:"Ask supervisor about scope.",selected:true})) }
```

### 3.4 QuestionCard

The anchor node at the centre of every workspace. Props: `question` (set in the serif `question` style) and `meta` (optional one-line summary). It is the only brand-filled card on the canvas, which is why it reads first; do not fill any other card with `brand`.

There is exactly one per workspace. It cannot be deleted, only edited.

Group: Canvas. Example:

```js
const W = window.WebAtlas, h = React.createElement;
function App() { return h(W.QuestionCard,{question:"How do coastal cities fund climate adaptation?",meta:"Due in 2 days \u00b7 24 sources \u00b7 5 groups"}) }
```

### 3.5 GroupFrame

A labelled, coloured region. Cards dragged inside move with it. Props: `label`, `color` (one of the six category colours), `ghost` (AI-suggested, not yet accepted), `width`, `height`, children.

A solid group uses the category colour for its 2px border and the matching `-soft` fill; its label pill sits on the border in `ink` on `surface`. A ghost group always uses `ghost-line` dashes, `ghost-fill`, and the word "(suggested)" in its label, so provisional structure is never mistaken for the user's own. Accepting a ghost turns it into a solid group and asks for a colour.

Group: Canvas. Example:

```js
const W = window.WebAtlas, h = React.createElement;
function App() { return h("div",{className:"row"},
h(W.GroupFrame,{label:"Funding models",color:"teal",width:300,height:150},h(W.NoteCard,{text:"Green bonds",width:180})),
h(W.GroupFrame,{label:"Case studies",ghost:true,width:300,height:150},h("span",{style:{font:"400 13px/18px var(--font-sans)",color:"var(--ink-muted)"}},"3 pages share: Rotterdam, Jakarta"))) }
```

### 3.6 Edge

A curved arrow between two points with an optional label pill. Props: `from` and `to` as `[x, y]`, `label` (the relationship: opened from, supports, contradicts, answers, cites), `color` (a category colour; default neutral), `ghost`, `id` (unique per edge, used for the arrowhead marker).

Labels are sentence-case verbs in `caption`. A ghost edge is dashed in `ghost-line` and its label pill is dashed too; it becomes solid on Accept. Arrowheads always point from source to target.

Group: Canvas. Example:

```js
const W = window.WebAtlas, h = React.createElement;
function App() { return h("div",{style:{position:"relative",height:190}},
h("div",{style:{position:"absolute",left:0,top:0}},h(W.Edge,{id:"a",from:[20,30],to:[300,30],label:"opened from"})),
h("div",{style:{position:"absolute",left:0,top:70}},h(W.Edge,{id:"b",from:[20,30],to:[300,90],label:"supports",color:"teal"})),
h("div",{style:{position:"absolute",left:340,top:0}},h(W.Edge,{id:"c",from:[20,30],to:[300,110],label:"answers?",ghost:true}))) }
```

### 3.7 TagChip

A 22px tag chip. Props: `label`, and optional `color` (`rose`, `amber`, `moss`, `teal`, `blue`, `plum`) which adds a category dot. Text is always `ink` on `surface-sunken`; the dot is the only place colour appears.

Tags with a colour mean a category (importance, topic or source); colourless tags are free text. Show at most three on a card and let the rest collapse into "+N".

Group: Canvas. Example:

```js
const W = window.WebAtlas, h = React.createElement;
function App() { return h("div",{className:"row"},h(W.TagChip,{label:"methods"}),h(W.TagChip,{label:"must-cite",color:"rose"}),h(W.TagChip,{label:"background",color:"moss"}),h(W.TagChip,{label:"talk",color:"plum"})) }
```

### 3.8 SelectionToolbar

The floating toolbar shown above a selection. Props: `color` (the active category colour). Fixed order: six colour swatches, then tag, note, open in browser pane, zoom to selection, then delete (in `danger`).

Swatches show a ring when active and expose `aria-pressed`; every button has a tooltip and `aria-label`. Place it 12px above the selection's top edge, centred.

Group: Canvas. Example:

```js
const W = window.WebAtlas, h = React.createElement;
function App() { return h(W.SelectionToolbar,{color:"teal"}) }
```

### 3.9 GhostSuggestion

The review card for one AI suggestion: a proposed group or relationship. Props: `kind` (`cluster` or `edge`), `title`, `reason` (one sentence saying why, always shown), `confidence` (0 to 1), `onAccept`, `onReject`.

Always show the reason: the student must be able to judge it in two seconds. Accept and Reject sit together with words and icons; acceptance is undoable like any command. Never auto-apply a suggestion. Below 40% confidence do not render a card at all.

Group: Intelligence. Example:

```js
const W = window.WebAtlas, h = React.createElement;
function App() { return h("div",{className:"row"},
h(W.GhostSuggestion,{kind:"cluster",title:"Group 3 pages as \u201cCase studies\u201d",reason:"Shared topic: named cities (Rotterdam, Jakarta) and similar headings.",confidence:0.82}),
h(W.GhostSuggestion,{kind:"edge",title:"IPCC chapter \u2192 supports \u2192 Research question",reason:"Chapter answers the funding sub-question directly.",confidence:0.64})) }
```

### 3.10 CommandPalette

The Ctrl+K palette. Props: `query`, `results` (`{type, title, match}` where `type` is web, video, pdf, note, tag or group, and `match` says what matched), `active` (highlighted row index). Enter jumps to the node and pans the canvas to it.

Show what matched (title, URL, note, highlight, tag) on the second line so the student trusts the result. Cap at eight rows. Uses `shadow-overlay` and `radius-lg`; the backdrop is the consumer's.

Group: Navigation. Example:

```js
const W = window.WebAtlas, h = React.createElement;
function App() { return h(W.CommandPalette,{query:"rotterdam",active:0,results:[{type:"video",title:"Rotterdam: living with water",match:"Title \u00b7 youtube.com"},{type:"note",title:"Note: Rotterdam water squares",match:"Note \u00b7 in group Case studies"},{type:"tag",title:"#rotterdam",match:"Tag \u00b7 3 nodes"},{type:"web",title:"Sea-level rise and urban finance",match:"Highlight \u00b7 \u201c\u2026pilot in Rotterdam reduced\u2026\u201d"}]}) }
```

### 3.11 ViewSwitcher

A pill segmented control for view modes. Props: `value` (`graph`, `focus`, `list`). Ship the two the PRD keeps; hide the third if only one simplified view is built. The active segment is brand-filled with an `aria-pressed` state; icons always sit beside their word.

Group: Navigation. Example:

```js
const W = window.WebAtlas, h = React.createElement;
function App() { return h("div",{className:"row"},h(W.ViewSwitcher,{value:"graph"}),h(W.ViewSwitcher,{value:"list"})) }
```

### 3.12 CaptureBar

The chrome at the top of the embedded browser: address, a Manual/Auto capture toggle and the primary "Add to canvas" button with its hotkey. Props: `url`, `mode` (`manual` or `auto`), `onAdd`.

In Auto mode every navigation becomes a node, so show a visible state: the toggle is brand-filled. Keep the address in `url` mono. This is the only primary button in the browser pane.

Group: Browser pane. Example:

```js
const W = window.WebAtlas, h = React.createElement;
function App() { return h("div",{className:"row"},h(W.CaptureBar,{url:"nature.com/articles/s41558-023-01234",mode:"manual"}),h(W.CaptureBar,{url:"youtube.com/watch?v=x1",mode:"auto"})) }
```

### 3.13 WorkspaceCard

A workspace on the home screen. Props: `name`, `question`, `nodes`, `groups`, `opened`. The miniature map is decorative (`aria-hidden`); the consumer may replace it with a real canvas thumbnail. Clicking reopens the workspace with its canvas view and the browser's last page restored.

Names use the serif at 20px; nothing else on the card is serif. Sort by last opened.

Group: Workspace home. Example:

```js
const W = window.WebAtlas, h = React.createElement;
function App() { return h("div",{className:"row"},h(W.WorkspaceCard,{name:"Climate adaptation review",question:"How do coastal cities fund climate adaptation?",nodes:24,groups:5,opened:"Opened 2h ago"}),h(W.WorkspaceCard,{name:"Intro to federated learning",question:"What limits client drift?",nodes:11,groups:3,opened:"Opened yesterday"})) }
```

### 3.14 Button

A 32px button (26px with `size="sm"`). Props: `variant` (`secondary` default; `primary`, `ghost`, `accept`, `reject`), `icon` (an Icon name), `kbd` (shortcut hint shown in a mono chip), `size`, `onClick`, `disabled`, and children as the label.

Use one `primary` per surface: "Add to canvas" in the browser pane, "Create workspace" on the welcome screen. Use `accept` and `reject` only as a pair on a ghost suggestion; reject keeps its word and icon so it never relies on colour. The consumer provides the label; keep it to a verb plus object.

Group: Actions. Example:

```js
const W = window.WebAtlas, h = React.createElement;
function App() { return h("div",{className:"row"},
h(W.Button,{variant:"primary",icon:"plus",kbd:"Alt+A"},"Add to canvas"),h(W.Button,null,"Export"),h(W.Button,{variant:"ghost",icon:"search"},"Search"),
h(W.Button,{variant:"accept",size:"sm",icon:"check"},"Accept"),h(W.Button,{variant:"reject",size:"sm",icon:"x"},"Reject")) }
```

### 3.15 Icon

Inline stroke icons drawn for WebAtlas: 24px grid, 1.75px stroke, round caps and joins, `currentColor`. Use `name` from the list in the preview (globe, play, file, note, compass, search, plus, check, x, link, trash, tag, graph, focus, list, palette, zoom, arrow, clock) and `size` (default 16; 14 inside chips and badges, 24 for empty states).

Icons never stand alone as the only signal: pair with a word or a tooltip. They are a placeholder set; if a host app adopts an icon library, keep the same stroke weight.

Group: Foundations. Example:

```js
const W = window.WebAtlas, h = React.createElement;
function App() { var n=["globe","play","file","note","compass","search","plus","check","x","link","trash","tag","graph","focus","list","palette","zoom","arrow","clock"];
return h("div",{className:"row",style:{color:"var(--ink)"}},n.map(function(k){return h("div",{key:k,style:{width:72,textAlign:"center",font:"400 12px/16px var(--font-sans)",color:"var(--ink-muted)"}},h(W.Icon,{name:k,size:24,style:{color:"var(--ink)"}}),h("div",null,k))})) }
```

---

## 4. Icons and assets

No external image, font or logo files were supplied, so the system ships none. Assets are:

- **Icons**: 19 inline SVG strokes in the `Icon` component (24px grid, 1.75 stroke, round caps, `currentColor`): globe, play, file, note, compass, search, plus, check, x, link, trash, tag, graph, focus, list, palette, zoom, arrow, clock. Drawn in-house; replace with a library of the same weight if the app adopts one.
- **Fonts**: Fraunces (600), IBM Plex Sans (400/500/600), IBM Plex Mono (400) via Google Fonts; `bundle.css` imports them.
- **Logo**: none supplied. The wordmark is the name "WebAtlas" in `display-xl` (Fraunces 600, `ink`, tracking -0.02em). Do not invent a mark.
- **Thumbnails**: supplied at runtime by the app (`NodeCard.thumbnail`); a skeleton placeholder shows when absent.
- **Dotted canvas background**: CSS radial-gradient using `canvas-dot`, 32px pitch (see Canvas).

---

## 5. Cover

The system cover is a 960x300 SVG: the WebAtlas wordmark (Fraunces 96px) on the left; right of x=480 a flush block layout of `brand` (256x200 slab), `cat-amber`, `cat-rose`, `cat-plum` and a `brand-soft` band, all with `radius-lg` corners, with four ground-coloured contour arcs (the map motif) cut out of the teal slab. Tagline: "Your browsing, drawn as a map."

```html
<!-- @dsCard height=300 -->
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=IBM+Plex+Sans:wght@400&display=swap" rel="stylesheet">
<style>
html,body{margin:0;background:var(--canvas)}
svg{display:block}
.ground{fill:var(--canvas)}
.brand{fill:var(--brand)}.amber{fill:var(--cat-amber)}.rose{fill:var(--cat-rose)}.plum{fill:var(--cat-plum)}.soft{fill:var(--brand-soft)}
.blk{rx:var(--radius-lg)}
.cut{fill:none;stroke:var(--canvas);stroke-width:2}
.name{fill:var(--ink);font-family:var(--font-display);font-weight:600;font-size:96px;letter-spacing:-0.02em}
.tag{fill:var(--ink-muted);font-family:var(--font-sans);font-size:14px}
</style>
<svg width="960" height="300" viewBox="0 0 960 300" role="img" aria-label="WebAtlas">
<!-- Derivation:
 blocks: brand 256x200 slab (space-7*5.33), cat-amber 176x96, cat-rose 84x88, cat-plum 84x88, brand-soft band 448x52; the teal slab leads because it is the anchor colour.
 arrangement: one tall slab left with three satellites stacked right and a flush band underneath, bleeding nowhere, all right of x=480.
 pattern: literal map motif - contour arcs, because WebAtlas draws browsing as a map; four ground-coloured arcs at 40px pitch (space-6 + space-2) cut out of the teal slab.
 scales: radius-lg corners on every block; gaps 16px (space-4); arcs 2px. -->
<rect class="ground" width="960" height="300"/>
<defs><clipPath id="a"><rect x="496" y="16" width="256" height="200" rx="16"/></clipPath></defs>
<rect class="brand blk" x="496" y="16" width="256" height="200"/>
<g clip-path="url(#a)"><circle class="cut" cx="752" cy="216" r="40"/><circle class="cut" cx="752" cy="216" r="80"/><circle class="cut" cx="752" cy="216" r="120"/><circle class="cut" cx="752" cy="216" r="160"/></g>
<rect class="amber blk" x="768" y="16" width="176" height="96"/>
<rect class="rose blk" x="768" y="128" width="84" height="88"/>
<rect class="plum blk" x="860" y="128" width="84" height="88"/>
<rect class="soft blk" x="496" y="232" width="448" height="52"/>
<text class="name" x="48" y="222">WebAtlas</text>
<text class="tag" x="52" y="252">Your browsing, drawn as a map.</text>
</svg>
```

---

## 6. Using the system in code

1. Load React 18 and ReactDOM 18 (UMD).
2. Load `tokens.css` compiled from the tables above (`:root` for light, `[data-theme="dark"]` for dark) defining every token as `--name`, plus `--font-display`, `--font-sans`, `--font-mono`.
3. Load Appendix A (`bundle.css`) then Appendix B (`bundle.js`) as a classic script; components appear on `window.WebAtlas`.
4. Build screens from the rules in the brand book: one brand fill per view (the question card), ink on canvas/surface/-soft fills, suggestions always dashed and never auto-accepted, category colour always labelled, visible `focus` ring on every control.

Minimal token-to-CSS helper:

```js
const themes = tokens.color.themes.map(t => t.id);
const css = themes.map((id, i) => `${i ? `[data-theme="${id}"]` : ':root'}{` + tokens.color.tokens.map(k => `--${k.name}:${typeof k.value==='string'?k.value:(k.value[id]||k.value[themes[0]])};`).join('') + '}').join('');
```

---

## Appendix A: `bundle.css`

```css
@import url("https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400&display=swap");
.wa{font-family:var(--font-sans);color:var(--ink);box-sizing:border-box}
.wa *,.wa *::before,.wa *::after{box-sizing:border-box}
.wa :focus-visible,.wa:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.wa-icon{display:inline-block;flex:none;vertical-align:middle}
.wa-btn{display:inline-flex;align-items:center;gap:var(--space-2);height:32px;padding:0 var(--space-3);border-radius:var(--radius-md);border:1px solid var(--line-strong);background:var(--surface);color:var(--ink);font:500 13px/16px var(--font-sans);cursor:pointer}
.wa-btn:hover{background:var(--surface-sunken)}
.wa-btn--primary{background:var(--brand);border-color:var(--brand);color:var(--on-brand)}
.wa-btn--primary:hover{background:var(--brand);filter:brightness(.93)}
.wa-btn--ghost{border-color:transparent;background:transparent}
.wa-btn--accept{background:var(--brand);border-color:var(--brand);color:var(--on-brand)}
.wa-btn--reject{background:var(--surface);border-color:var(--danger);color:var(--danger)}
.wa-btn--sm{height:26px;padding:0 var(--space-2);font-size:12px}
.wa-kbd{font:400 11px/14px var(--font-mono);padding:1px 5px;border-radius:4px;border:1px solid currentColor;opacity:.85}
.wa-tag{display:inline-flex;align-items:center;gap:var(--space-1);height:22px;padding:0 var(--space-2);border-radius:var(--radius-sm);background:var(--surface-sunken);color:var(--ink);font:500 12px/16px var(--font-sans);border:1px solid var(--line)}
.wa-tag__dot{width:8px;height:8px;border-radius:50%;background:var(--ink-muted)}
.wa-card{position:relative;width:260px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);box-shadow:var(--shadow-card);overflow:hidden}
.wa-card--selected{border-color:var(--brand);box-shadow:0 0 0 2px var(--brand),var(--shadow-lift)}
.wa-card__thumb{height:110px;background:var(--surface-sunken);border-bottom:1px solid var(--line);position:relative;display:flex;align-items:center;justify-content:center;color:var(--ink-muted);overflow:hidden}
.wa-card__thumb img{width:100%;height:100%;object-fit:cover}
.wa-skel{position:absolute;inset:14px 18px;display:flex;flex-direction:column;gap:8px}
.wa-skel i{display:block;height:8px;border-radius:4px;background:var(--line)}
.wa-skel i:first-child{height:34px;border-radius:var(--radius-sm);background:var(--line)}
.wa-card__body{padding:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2)}
.wa-badge{display:inline-flex;align-items:center;gap:var(--space-1);font:600 11px/14px var(--font-sans);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-muted)}
.wa-badge svg{color:var(--badge,var(--ink-muted))}
.wa-card__title{font:600 15px/20px var(--font-sans);margin:0;color:var(--ink)}
.wa-url{display:flex;align-items:center;gap:var(--space-1);font:400 12px/16px var(--font-mono);color:var(--ink-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wa-fav{width:16px;height:16px;border-radius:4px;background:var(--surface);border:1px solid var(--badge,var(--ink-muted));color:var(--ink);font:600 9px/14px var(--font-sans);text-align:center;flex:none}
.wa-quote{margin:0;padding:var(--space-1) var(--space-2);background:var(--highlight);color:var(--ink);border-radius:4px;font:400 13px/18px var(--font-sans)}
.wa-note-text{font:400 14px/21px var(--font-sans);color:var(--ink);margin:0}
.wa-tags{display:flex;flex-wrap:wrap;gap:var(--space-1)}
.wa-prov{display:flex;align-items:center;gap:var(--space-1);font:400 12px/16px var(--font-sans);color:var(--ink-subtle)}
.wa-handle{position:absolute;width:10px;height:10px;border-radius:50%;background:var(--surface);border:2px solid var(--line-strong)}
.wa-card--selected .wa-handle{border-color:var(--brand)}
.wa-note{width:220px;padding:var(--space-3);background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);box-shadow:var(--shadow-card)}
.wa-note--selected{border-color:var(--brand);box-shadow:0 0 0 2px var(--brand),var(--shadow-lift)}
.wa-q{width:320px;padding:var(--space-4);background:var(--brand);color:var(--on-brand);border-radius:var(--radius-lg);box-shadow:var(--shadow-lift);display:flex;flex-direction:column;gap:var(--space-2)}
.wa-q .wa-badge{color:var(--on-brand)}
.wa-q__text{font:500 20px/26px var(--font-display);margin:0}
.wa-q__meta{font:400 12px/16px var(--font-sans);margin:0}
.wa-group{position:relative;border:2px solid var(--gc);border-radius:var(--radius-lg);background:var(--gs);padding:var(--space-6) var(--space-4) var(--space-4)}
.wa-group__label{position:absolute;top:-13px;left:var(--space-4);display:inline-flex;align-items:center;gap:var(--space-1);height:24px;padding:0 var(--space-3);border-radius:var(--radius-pill);background:var(--surface);border:2px solid var(--gc);color:var(--ink);font:600 11px/14px var(--font-sans);letter-spacing:.08em;text-transform:uppercase}
.wa-group--ghost{border-style:dashed;border-color:var(--ghost-line);background:var(--ghost-fill)}
.wa-group--ghost .wa-group__label{background:var(--surface);color:var(--brand-ink);border:1px dashed var(--ghost-line)}
.wa-edge{position:relative}
.wa-edge svg{display:block;overflow:visible}
.wa-edge__label{position:absolute;transform:translate(-50%,-50%);display:inline-flex;align-items:center;height:22px;padding:0 var(--space-2);border-radius:var(--radius-pill);background:var(--surface);border:1px solid var(--ec);color:var(--ink);font:400 12px/16px var(--font-sans);white-space:nowrap}
.wa-edge__label--ghost{border-style:dashed}
.wa-ghost{width:300px;background:var(--surface);border:1px dashed var(--ghost-line);border-radius:var(--radius-md);padding:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2)}
.wa-ghost__head{display:flex;justify-content:space-between;align-items:center}
.wa-ghost__title{font:600 14px/20px var(--font-sans);margin:0}
.wa-ghost__why{font:400 13px/18px var(--font-sans);color:var(--ink-muted);margin:0}
.wa-conf{font:400 12px/16px var(--font-mono);color:var(--ink-muted)}
.wa-ghost__actions{display:flex;gap:var(--space-2)}
.wa-toolbar{display:inline-flex;align-items:center;gap:var(--space-1);padding:var(--space-1);background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);box-shadow:var(--shadow-lift)}
.wa-tb{width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;border-radius:var(--radius-sm);border:0;background:transparent;color:var(--ink);cursor:pointer}
.wa-tb:hover{background:var(--surface-sunken)}
.wa-tb--danger{color:var(--danger)}
.wa-sw{width:18px;height:18px;border-radius:50%;background:var(--gc);border:2px solid var(--surface);box-shadow:0 0 0 1px var(--line-strong);padding:0;cursor:pointer}
.wa-sw--on{box-shadow:0 0 0 2px var(--ink)}
.wa-sep{width:1px;height:20px;background:var(--line-strong);margin:0 var(--space-1)}
.wa-pal{width:560px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);box-shadow:var(--shadow-overlay);overflow:hidden}
.wa-pal__in{display:flex;align-items:center;gap:var(--space-2);padding:var(--space-3) var(--space-4);border-bottom:1px solid var(--line);color:var(--ink-muted)}
.wa-pal__in span.q{flex:1;font:400 15px/20px var(--font-sans);color:var(--ink)}
.wa-pal__row{display:flex;align-items:center;gap:var(--space-3);padding:var(--space-2) var(--space-4)}
.wa-pal__row--on{background:var(--brand-soft)}
.wa-pal__main{flex:1;min-width:0}
.wa-pal__t{font:500 14px/20px var(--font-sans);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wa-pal__m{font:400 12px/16px var(--font-sans);color:var(--ink-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wa-pal__foot{display:flex;gap:var(--space-4);padding:var(--space-2) var(--space-4);border-top:1px solid var(--line);font:400 12px/16px var(--font-sans);color:var(--ink-subtle)}
.wa-cap{display:flex;align-items:center;gap:var(--space-2);width:640px;padding:var(--space-2);background:var(--surface-sunken);border:1px solid var(--line);border-radius:var(--radius-md)}
.wa-cap__url{flex:1;min-width:0;height:32px;display:flex;align-items:center;padding:0 var(--space-3);background:var(--surface);border:1px solid var(--line-strong);border-radius:var(--radius-pill);font:400 12px/16px var(--font-mono);color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wa-seg{display:inline-flex;padding:2px;border:1px solid var(--line-strong);border-radius:var(--radius-pill);background:var(--surface)}
.wa-seg button{display:inline-flex;align-items:center;gap:var(--space-1);height:26px;padding:0 var(--space-3);border:0;border-radius:var(--radius-pill);background:transparent;color:var(--ink);font:500 12px/16px var(--font-sans);cursor:pointer}
.wa-seg button[aria-pressed="true"]{background:var(--brand);color:var(--on-brand)}
.wa-ws{width:280px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);box-shadow:var(--shadow-card);overflow:hidden}
.wa-ws__map{height:96px;background:var(--surface-sunken);border-bottom:1px solid var(--line);position:relative}
.wa-ws__body{padding:var(--space-4);display:flex;flex-direction:column;gap:var(--space-2)}
.wa-ws__name{font:600 20px/24px var(--font-display);margin:0}
.wa-ws__q{font:400 13px/18px var(--font-sans);color:var(--ink-muted);margin:0}
.wa-ws__meta{display:flex;justify-content:space-between;font:400 12px/16px var(--font-sans);color:var(--ink-subtle)}
.wa-canvas{position:relative;overflow:hidden;background-color:var(--canvas);background-image:radial-gradient(circle,var(--canvas-dot) 1.25px,transparent 1.75px);background-size:var(--space-6) var(--space-6);background-position:0 0}
.wa-canvas--plain{background-image:none}
```

## Appendix B: `bundle.js`

```js
/* @ds-bundle: {"format":4,"namespace":"WebAtlas","components":[{"name":"Icon"},{"name":"Canvas"},{"name":"Button"},{"name":"TagChip"},{"name":"NodeCard"},{"name":"NoteCard"},{"name":"QuestionCard"},{"name":"GroupFrame"},{"name":"Edge"},{"name":"GhostSuggestion"},{"name":"SelectionToolbar"},{"name":"CommandPalette"},{"name":"CaptureBar"},{"name":"ViewSwitcher"},{"name":"WorkspaceCard"}]} */
(function () {
  var React = window.React, h = React.createElement;
  var CATS = ["rose", "amber", "moss", "teal", "blue", "plum"];
  function cat(c) { return { "--gc": "var(--cat-" + c + ")", "--gs": "var(--cat-" + c + "-soft)" }; }

  var PATHS = {
    globe: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.5 3.7 5.5 3.7 9S14.500 18.500 12 21c-2.500-2.500-3.700-5.500-3.700-9S9.500 5.500 12 3z",
    play: "M6 4l13 8-13 8V4z",
    file: "M6 3h8l5 5v13H6V3zM14 3v5h5M9 13h7M9 17h7",
    note: "M5 4h14v12l-5 5H5V4zM14 21v-5h5M8 9h8M8 13h4",
    compass: "M12 3a9 9 0 100 18 9 9 0 000-18zM15.500 8.500l-2 5-5 2 2-5 5-2z",
    search: "M11 4a7 7 0 100 14 7 7 0 000-14zM16 16l5 5",
    plus: "M12 5v14M5 12h14",
    check: "M5 12.500l4.500 4.500L19 7.500",
    x: "M6 6l12 12M18 6L6 18",
    link: "M10 14a4 4 0 005.700 0l3-3a4 4 0 00-5.700-5.700l-1 1M14 10a4 4 0 00-5.700 0l-3 3a4 4 0 005.700 5.700l1-1",
    trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
    tag: "M3 12V4h8l10 10-8 8L3 12zM7.500 8.500h.01",
    graph: "M6 6a2 2 0 100 .01M18 8a2 2 0 100 .01M12 18a2 2 0 100 .01M7.500 7.500l3.500 9M16.500 9.500L13 16.500M8 6.500l8 1",
    focus: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5M12 10a2 2 0 100 4 2 2 0 000-4z",
    list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
    palette: "M12 3a9 9 0 100 18c1.500 0 2-1 1.500-2.200-.6-1.300.3-2.800 1.800-2.800H18a3 3 0 003-3c0-5-4-10-9-10zM8 11h.01M12 8h.01M16 10h.01",
    zoom: "M11 4a7 7 0 100 14 7 7 0 000-14zM16 16l5 5M8.500 11h5M11 8.500v5",
    arrow: "M5 12h14M13 6l6 6-6 6",
    clock: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2"
  };
  function Icon(p) {
    var s = p.size || 16;
    return h("svg", { className: "wa-icon", width: s, height: s, viewBox: "0 0 24 24", fill: p.name === "play" ? "currentColor" : "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, style: p.style }, h("path", { d: PATHS[p.name] || PATHS.globe }));
  }

  function Canvas(p) {
    var z = p.zoom || 1, o = p.offset || [0, 0], pitch = 32 * z;
    var st = { width: p.width || "100%", height: p.height || 320 };
    if (p.dotted !== false) { st.backgroundSize = pitch + "px " + pitch + "px"; st.backgroundPosition = o[0] + "px " + o[1] + "px"; }
    return h("div", { className: "wa wa-canvas" + (p.dotted === false ? " wa-canvas--plain" : ""), style: st, role: "application", "aria-label": "Canvas" }, p.children);
  }

  function Button(p) {
    var v = p.variant || "secondary";
    return h("button", { type: "button", className: "wa wa-btn wa-btn--" + v + (p.size === "sm" ? " wa-btn--sm" : ""), onClick: p.onClick, disabled: p.disabled },
      p.icon ? h(Icon, { name: p.icon, size: 14 }) : null, p.children,
      p.kbd ? h("span", { className: "wa-kbd" }, p.kbd) : null);
  }

  function TagChip(p) {
    return h("span", { className: "wa wa-tag", style: p.color ? cat(p.color) : null },
      p.color ? h("span", { className: "wa-tag__dot", style: { background: "var(--gc)" } }) : null, p.label);
  }

  var TYPES = {
    web: { icon: "globe", label: "Web page", color: "var(--cat-teal)" },
    video: { icon: "play", label: "Video", color: "var(--cat-plum)" },
    pdf: { icon: "file", label: "PDF", color: "var(--cat-blue)" }
  };
  function Handles() {
    var pos = [{ top: "50%", left: -5 }, { top: "50%", right: -5 }, { top: -5, left: "50%" }, { bottom: -5, left: "50%" }];
    return pos.map(function (s, i) { s.marginTop = s.top === "50%" ? -5 : 0; s.marginLeft = s.left === "50%" ? -5 : 0; return h("span", { key: i, className: "wa-handle", style: s }); });
  }
  function NodeCard(p) {
    var t = TYPES[p.type || "web"];
    var host = (p.url || "").replace(/^https?:\/\//, "");
    return h("article", { className: "wa wa-card" + (p.selected ? " wa-card--selected" : ""), style: Object.assign({ "--badge": t.color }, p.width ? { width: p.width } : null), "aria-label": p.title },
      h("div", { className: "wa-card__thumb" },
        p.thumbnail ? h("img", { src: p.thumbnail, alt: "" }) : h("div", { className: "wa-skel", "aria-hidden": true }, h("i"), h("i", { style: { width: "80%" } }), h("i", { style: { width: "55%" } })),
        p.type === "video" ? h("span", { style: { position: "absolute", width: 40, height: 40, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--line-strong)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink)" } }, h(Icon, { name: "play", size: 16 })) : null,
        p.type === "pdf" && p.pages ? h("span", { className: "wa-tag", style: { position: "absolute", right: 8, bottom: 8 } }, p.pages + " pages") : null),
      h("div", { className: "wa-card__body" },
        h("span", { className: "wa-badge" }, h(Icon, { name: t.icon, size: 14 }), t.label),
        h("h3", { className: "wa-card__title" }, p.title),
        h("div", { className: "wa-url" }, h("span", { className: "wa-fav" }, (host[0] || "w").toUpperCase()), host),
        p.highlight ? h("blockquote", { className: "wa-quote" }, p.highlight) : null,
        p.tags && p.tags.length ? h("div", { className: "wa-tags" }, p.tags.map(function (g) { return h(TagChip, { key: g.label || g, label: g.label || g, color: g.color }); })) : null,
        p.openedFrom ? h("div", { className: "wa-prov" }, h(Icon, { name: "arrow", size: 12 }), "opened from " + p.openedFrom) : null),
      p.selected ? h(Handles) : null);
  }

  function NoteCard(p) {
    return h("article", { className: "wa wa-note" + (p.selected ? " wa-note--selected" : ""), style: p.width ? { width: p.width } : null },
      h("span", { className: "wa-badge", style: { marginBottom: 8, display: "flex" } }, h(Icon, { name: "note", size: 14 }), "Note"),
      h("p", { className: "wa-note-text" }, p.text),
      p.tags && p.tags.length ? h("div", { className: "wa-tags", style: { marginTop: 8 } }, p.tags.map(function (g) { return h(TagChip, { key: g.label || g, label: g.label || g, color: g.color }); })) : null);
  }

  function QuestionCard(p) {
    return h("article", { className: "wa wa-q" },
      h("span", { className: "wa-badge" }, h(Icon, { name: "compass", size: 14 }), "Research question"),
      h("p", { className: "wa-q__text" }, p.question),
      p.meta ? h("p", { className: "wa-q__meta" }, p.meta) : null);
  }

  function GroupFrame(p) {
    var style = Object.assign(p.ghost ? {} : cat(p.color || "teal"), { width: p.width || 320, minHeight: p.height || 160 });
    return h("section", { className: "wa wa-group" + (p.ghost ? " wa-group--ghost" : ""), style: style, "aria-label": p.label },
      h("span", { className: "wa-group__label" }, p.ghost ? h(Icon, { name: "focus", size: 12 }) : null, p.label, p.ghost ? " (suggested)" : ""), p.children);
  }

  function Edge(p) {
    var x1 = p.from[0], y1 = p.from[1], x2 = p.to[0], y2 = p.to[1];
    var dx = Math.max(40, Math.abs(x2 - x1) / 2);
    var d = "M" + x1 + " " + y1 + " C" + (x1 + dx) + " " + y1 + " " + (x2 - dx) + " " + y2 + " " + x2 + " " + y2;
    var col = p.color ? "var(--cat-" + p.color + ")" : "var(--line-strong)";
    if (p.ghost) col = "var(--ghost-line)";
    var id = "wa-ah-" + (p.id || "e");
    var w = Math.max(x1, x2) + 20, hh = Math.max(y1, y2) + 20;
    return h("div", { className: "wa wa-edge", style: { width: w, height: hh, "--ec": col } },
      h("svg", { width: w, height: hh, "aria-hidden": true },
        h("defs", null, h("marker", { id: id, markerWidth: 8, markerHeight: 8, refX: 7, refY: 4, orient: "auto" }, h("path", { d: "M0 0L8 4L0 8z", fill: col }))),
        h("path", { d: d, fill: "none", stroke: col, strokeWidth: 2, strokeDasharray: p.ghost ? "6 5" : null, markerEnd: "url(#" + id + ")" })),
      p.label ? h("span", { className: "wa-edge__label" + (p.ghost ? " wa-edge__label--ghost" : ""), style: { left: (x1 + x2) / 2, top: (y1 + y2) / 2 } }, p.label) : null);
  }

  function GhostSuggestion(p) {
    return h("div", { className: "wa wa-ghost", role: "group", "aria-label": "Suggestion: " + p.title },
      h("div", { className: "wa-ghost__head" }, h("span", { className: "wa-badge" }, h(Icon, { name: p.kind === "edge" ? "link" : "focus", size: 14 }), p.kind === "edge" ? "Suggested link" : "Suggested group"),
        p.confidence != null ? h("span", { className: "wa-conf" }, Math.round(p.confidence * 100) + "% match") : null),
      h("p", { className: "wa-ghost__title" }, p.title),
      p.reason ? h("p", { className: "wa-ghost__why" }, p.reason) : null,
      h("div", { className: "wa-ghost__actions" },
        h(Button, { variant: "accept", size: "sm", icon: "check", onClick: p.onAccept }, "Accept"),
        h(Button, { variant: "reject", size: "sm", icon: "x", onClick: p.onReject }, "Reject")));
  }

  function SelectionToolbar(p) {
    var active = p.color;
    return h("div", { className: "wa wa-toolbar", role: "toolbar", "aria-label": "Selection" },
      CATS.map(function (c) { return h("button", { key: c, type: "button", className: "wa-sw" + (active === c ? " wa-sw--on" : ""), style: cat(c), "aria-label": "Colour " + c, "aria-pressed": active === c }); }),
      h("span", { className: "wa-sep" }),
      [["tag", "Tag"], ["note", "Note"], ["globe", "Open in browser pane"], ["zoom", "Zoom to selection"]].map(function (x) { return h("button", { key: x[0], type: "button", className: "wa-tb", title: x[1], "aria-label": x[1] }, h(Icon, { name: x[0], size: 16 })); }),
      h("span", { className: "wa-sep" }),
      h("button", { type: "button", className: "wa-tb wa-tb--danger", title: "Delete", "aria-label": "Delete" }, h(Icon, { name: "trash", size: 16 })));
  }

  function CommandPalette(p) {
    var icons = { web: "globe", video: "play", pdf: "file", note: "note", tag: "tag", group: "focus" };
    return h("div", { className: "wa wa-pal", role: "dialog", "aria-label": "Search workspace" },
      h("div", { className: "wa-pal__in" }, h(Icon, { name: "search", size: 18 }), h("span", { className: "q" }, p.query || ""), h("span", { className: "wa-kbd" }, "Esc")),
      (p.results || []).map(function (r, i) {
        return h("div", { key: i, className: "wa-pal__row" + (i === (p.active || 0) ? " wa-pal__row--on" : "") },
          h(Icon, { name: icons[r.type] || "globe", size: 16 }),
          h("div", { className: "wa-pal__main" }, h("div", { className: "wa-pal__t" }, r.title), h("div", { className: "wa-pal__m" }, r.match)));
      }),
      h("div", { className: "wa-pal__foot" }, h("span", null, "↑↓ to move"), h("span", null, "Enter to jump to node"), h("span", null, "Searches titles, URLs, notes, highlights, tags")));
  }

  function CaptureBar(p) {
    var auto = p.mode === "auto";
    return h("div", { className: "wa wa-cap" },
      h("div", { className: "wa-cap__url" }, p.url),
      h("div", { className: "wa-seg", role: "group", "aria-label": "Capture mode" },
        h("button", { type: "button", "aria-pressed": !auto }, "Manual"), h("button", { type: "button", "aria-pressed": auto }, "Auto")),
      h(Button, { variant: "primary", icon: "plus", kbd: "Alt+A", onClick: p.onAdd }, "Add to canvas"));
  }

  function ViewSwitcher(p) {
    var v = p.value || "graph";
    return h("div", { className: "wa wa-seg", role: "group", "aria-label": "View mode" },
      [["graph", "graph", "Graph"], ["focus", "focus", "Focus"], ["list", "list", "List"]].map(function (x) {
        return h("button", { key: x[0], type: "button", "aria-pressed": v === x[0] }, h(Icon, { name: x[1], size: 14 }), x[2]);
      }));
  }

  function WorkspaceCard(p) {
    var dots = [[30, 60, "teal"], [80, 30, "rose"], [120, 66, "teal"], [170, 36, "blue"], [215, 62, "plum"], [250, 28, "moss"]];
    return h("article", { className: "wa wa-ws" },
      h("div", { className: "wa-ws__map", "aria-hidden": true },
        h("svg", { width: "100%", height: 96, viewBox: "0 0 280 96" },
          h("path", { d: "M30 60L80 30L120 66L170 36L215 62L250 28", fill: "none", stroke: "var(--line-strong)", strokeWidth: 1.5 }),
          dots.map(function (d, i) { return h("circle", { key: i, cx: d[0], cy: d[1], r: 7, fill: "var(--cat-" + d[2] + ")" }); }))),
      h("div", { className: "wa-ws__body" },
        h("h3", { className: "wa-ws__name" }, p.name),
        p.question ? h("p", { className: "wa-ws__q" }, p.question) : null,
        h("div", { className: "wa-ws__meta" }, h("span", null, p.nodes + " nodes · " + p.groups + " groups"), h("span", null, p.opened))));
  }

  window.WebAtlas = { Icon: Icon, Canvas: Canvas, Button: Button, TagChip: TagChip, NodeCard: NodeCard, NoteCard: NoteCard, QuestionCard: QuestionCard, GroupFrame: GroupFrame, Edge: Edge, GhostSuggestion: GhostSuggestion, SelectionToolbar: SelectionToolbar, CommandPalette: CommandPalette, CaptureBar: CaptureBar, ViewSwitcher: ViewSwitcher, WorkspaceCard: WorkspaceCard };
})();
```

## Appendix C: `index.d.ts`

```ts
type Cat = "rose" | "amber" | "moss" | "teal" | "blue" | "plum";
type Tag = string | { label: string; color?: Cat };
export interface IconProps { name: string; size?: number }
export interface ButtonProps { variant?: "secondary" | "primary" | "ghost" | "accept" | "reject"; size?: "md" | "sm"; icon?: string; kbd?: string; onClick?: () => void; disabled?: boolean; children?: any }
export interface TagChipProps { label: string; color?: Cat }
export interface NodeCardProps { type?: "web" | "video" | "pdf"; title: string; url: string; thumbnail?: string; highlight?: string; tags?: Tag[]; openedFrom?: string; pages?: number; selected?: boolean; width?: number }
export interface NoteCardProps { text: string; tags?: Tag[]; selected?: boolean; width?: number }
export interface QuestionCardProps { question: string; meta?: string }
export interface GroupFrameProps { label: string; color?: Cat; ghost?: boolean; width?: number; height?: number; children?: any }
export interface EdgeProps { id?: string; from: [number, number]; to: [number, number]; label?: string; color?: Cat; ghost?: boolean }
export interface GhostSuggestionProps { kind: "cluster" | "edge"; title: string; reason?: string; confidence?: number; onAccept?: () => void; onReject?: () => void }
export interface SelectionToolbarProps { color?: Cat }
export interface CommandPaletteProps { query?: string; active?: number; results: { type: "web" | "video" | "pdf" | "note" | "tag" | "group"; title: string; match: string }[] }
export interface CaptureBarProps { url: string; mode?: "manual" | "auto"; onAdd?: () => void }
export interface ViewSwitcherProps { value?: "graph" | "focus" | "list" }
export interface WorkspaceCardProps { name: string; question?: string; nodes: number; groups: number; opened: string }
export interface CanvasProps { dotted?: boolean; zoom?: number; offset?: [number, number]; width?: number | string; height?: number | string; children?: any }
```
