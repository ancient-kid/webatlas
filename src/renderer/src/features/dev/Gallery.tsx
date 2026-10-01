// Dev-only component gallery for reviewing the design-system port against DESIGN.md
// (open with ?gallery, or View → Component gallery in development). Removed in T19.
import { useState, type ReactElement, type ReactNode } from 'react'
import type { CaptureMode, ViewMode } from '@shared/types'
import { Button } from '@renderer/components/wa/Button'
import { CanvasSurface } from '@renderer/components/wa/CanvasSurface'
import { CaptureBar } from '@renderer/components/wa/CaptureBar'
import { CommandPaletteView } from '@renderer/components/wa/CommandPaletteView'
import { EdgeView } from '@renderer/components/wa/EdgeView'
import { GhostSuggestion } from '@renderer/components/wa/GhostSuggestion'
import { GroupFrameView } from '@renderer/components/wa/GroupFrameView'
import { Icon, ICONS, type IconName } from '@renderer/components/wa/Icon'
import { NodeCardView } from '@renderer/components/wa/NodeCardView'
import { NoteCardView } from '@renderer/components/wa/NoteCardView'
import { QuestionCardView } from '@renderer/components/wa/QuestionCardView'
import { SelectionToolbarView } from '@renderer/components/wa/SelectionToolbarView'
import { TagChip } from '@renderer/components/wa/TagChip'
import { ViewSwitcher } from '@renderer/components/wa/ViewSwitcher'
import { WorkspaceCard } from '@renderer/components/wa/WorkspaceCard'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger
} from '@renderer/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { toast } from 'sonner'
import { Tip } from '@renderer/components/ui/tooltip'
import { CATS, type Cat } from '@shared/types'

/** A drawn stand-in for a page screenshot (offline, no external images). */
function fakePage(accent: string, dark = false): string {
  const bg = dark ? '#1b1b1b' : '#ffffff'
  const ink = dark ? '#555' : '#d6d6d6'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="220"><rect width="520" height="220" fill="${bg}"/><rect width="520" height="34" fill="${accent}"/><rect x="24" y="56" width="300" height="18" rx="4" fill="${ink}"/><rect x="24" y="88" width="460" height="10" rx="3" fill="${ink}"/><rect x="24" y="108" width="430" height="10" rx="3" fill="${ink}"/><rect x="24" y="128" width="380" height="10" rx="3" fill="${ink}"/><rect x="24" y="160" width="200" height="40" rx="6" fill="${accent}" opacity=".35"/></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const COLOUR_TOKENS = [
  'canvas',
  'surface',
  'surface-sunken',
  'ink',
  'ink-muted',
  'ink-subtle',
  'line',
  'line-strong',
  'brand',
  'on-brand',
  'brand-soft',
  'brand-ink',
  'focus',
  'highlight',
  'danger',
  'ghost-line',
  'ghost-fill',
  ...CATS.flatMap((c) => [`cat-${c}`, `cat-${c}-soft`])
]

const HOUR = 3_600_000

function Section(p: {
  id: string
  title: string
  note?: string
  children: ReactNode
}): ReactElement {
  return (
    <section
      aria-labelledby={`g-${p.id}`}
      className="flex flex-col gap-4 border-t border-line pt-6"
    >
      <div>
        <h2 id={`g-${p.id}`} className="wa-display-lg">
          {p.title}
        </h2>
        {p.note ? <p className="wa-caption m-0 mt-1 text-ink-muted">{p.note}</p> : null}
      </div>
      {p.children}
    </section>
  )
}

const Row = ({ children }: { children: ReactNode }): ReactElement => (
  <div className="flex flex-wrap items-start gap-6">{children}</div>
)

export function Gallery(): ReactElement {
  const [mode, setMode] = useState<CaptureMode>('manual')
  const [view, setView] = useState<ViewMode>('graph')
  const [colour, setColour] = useState<Cat | null>('teal')
  const [hovered, setHovered] = useState(false)
  const [now] = useState(() => Date.now())

  return (
    <main data-testid="gallery" className="min-h-full bg-canvas px-12 py-12 text-ink">
      <header className="mb-10 flex flex-col gap-2">
        <h1 className="wa-display-xl">WebAtlas</h1>
        <p className="m-0 text-ink-muted">
          Component gallery (development only). Your browsing, drawn as a map. Switch Windows
          between light and dark mode to check both themes.
        </p>
      </header>

      <div className="flex flex-col gap-10">
        <Section id="colour" title="Colour" note="DESIGN.md §2.1, current theme.">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
            {COLOUR_TOKENS.map((t) => (
              <div key={t} className="flex items-center gap-2">
                <span
                  className="inline-block h-8 w-8 flex-none rounded-md border border-line"
                  style={{ background: `var(--${t})` }}
                />
                <code className="wa-url-text text-ink-muted">{t}</code>
              </div>
            ))}
          </div>
        </Section>

        <Section
          id="type"
          title="Type"
          note="Fraunces for display and the question, IBM Plex Sans for interface, IBM Plex Mono for URLs."
        >
          <div className="flex flex-col gap-3">
            <p className="wa-display-xl">Display xl</p>
            <p className="wa-display-lg">Display lg: Climate adaptation review</p>
            <p className="wa-q__text" style={{ color: 'var(--ink)' }}>
              Question: How do coastal cities fund climate adaptation?
            </p>
            <p className="wa-title">Title: Sea-level rise and urban finance</p>
            <p className="m-0">Body: Municipal bonds cover less than a third of adaptation cost.</p>
            <span className="wa-label">Label: Add to canvas</span>
            <span className="wa-caption text-ink-muted">Caption: 24 nodes · 5 groups</span>
            <span className="wa-overline text-ink-muted">Overline: Web page</span>
            <span className="wa-url-text text-ink-muted">nature.com/articles/s41558-023-01234</span>
          </div>
        </Section>

        <Section
          id="icons"
          title="Icons"
          note="lucide-react at 1.75 stroke, mapped to the DESIGN.md names."
        >
          <div className="flex flex-wrap gap-4">
            {(Object.keys(ICONS) as IconName[]).map((n) => (
              <div
                key={n}
                className="wa-caption flex w-[72px] flex-col items-center gap-1 text-ink-muted"
              >
                <Icon name={n} size={24} style={{ color: 'var(--ink)' }} />
                {n}
              </div>
            ))}
          </div>
        </Section>

        <Section id="buttons" title="Buttons">
          <Row>
            <Button variant="primary" icon="plus" kbd="Alt+A">
              Add to canvas
            </Button>
            <Button>Export</Button>
            <Button variant="ghost" icon="search">
              Search
            </Button>
            <Button variant="accept" size="sm" icon="check">
              Accept
            </Button>
            <Button variant="reject" size="sm" icon="x">
              Reject
            </Button>
            <Button disabled>Disabled</Button>
            <Tip label="Tooltips appear on hover and keyboard focus">
              <Button variant="ghost" icon="clock">
                Hover me
              </Button>
            </Tip>
          </Row>
        </Section>

        <Section id="tags" title="Tags">
          <Row>
            <TagChip label="methods" />
            <TagChip label="must-cite" color="rose" />
            <TagChip label="to check" color="amber" />
            <TagChip label="background" color="moss" />
            <TagChip label="core" color="teal" />
            <TagChip label="paper" color="blue" />
            <TagChip label="talk" color="plum" />
          </Row>
        </Section>

        <Section
          id="cards"
          title="Cards"
          note="Web, video, PDF; selected; five tags collapse to three plus +2; newest highlight only; note flag; skeleton; broken favicon falls back to a letter."
        >
          <Row>
            <NodeCardView
              kind="webpage"
              title="Sea-level rise and urban finance"
              url="https://nature.com/articles/s41558"
              thumbnail={fakePage('#0b5d66')}
              summary="Insurance pools and municipal bonds shift adaptation costs onto city budgets."
              highlights={[
                { quote: 'An older quote that should not show.', createdAt: 1 },
                { quote: 'Insurance pools shift cost to the state.', createdAt: 2 }
              ]}
              tags={[
                { label: 'must-cite', color: 'rose' },
                'policy',
                'finance',
                'rotterdam',
                'bonds'
              ]}
              openedFrom="Google Scholar"
              hasNote
              selected
            />
            <NodeCardView
              kind="video"
              title="Rotterdam: living with water"
              url="https://youtube.com/watch?v=x1"
              thumbnail={fakePage('#8a3a8f', true)}
              tags={[{ label: 'talk', color: 'plum' }]}
              openedFrom="Sea-level rise and urban finance"
            />
            <NodeCardView
              kind="pdf"
              title="IPCC AR6 WG2, Chapter 6: Cities"
              url="https://ipcc.ch/report/ar6/wg2/chapter06.pdf"
              pages={112}
              tags={[{ label: 'background', color: 'moss' }]}
              color="blue"
            />
            <NodeCardView
              kind="webpage"
              title="A page whose thumbnail has not arrived yet"
              url="https://example.org/slow"
              faviconUrl="data:,broken"
            />
          </Row>
          <Row>
            <NoteCardView
              text="Key claim: municipal bonds cover less than a third of adaptation cost. Check the OECD figure against the World Bank one."
              tags={[{ label: 'to check', color: 'amber' }]}
            />
            <NoteCardView text="Ask supervisor about scope." selected />
            <NoteCardView text="" />
            <QuestionCardView
              question="How do coastal cities fund climate adaptation?"
              meta="Due in 2 days · 24 sources · 5 groups"
            />
          </Row>
        </Section>

        <Section
          id="groups"
          title="Groups and edges"
          note="A solid group, a ghost group, a plain edge, a coloured edge and a ghost edge."
        >
          <Row>
            <GroupFrameView label="Funding models" color="teal" width={300} height={150}>
              <NoteCardView text="Green bonds" width={180} />
            </GroupFrameView>
            <GroupFrameView label="Case studies" ghost width={300} height={150}>
              <span className="wa-caption text-ink-muted">3 pages share: Rotterdam, Jakarta</span>
            </GroupFrameView>
            <div className="relative h-[190px] w-[680px]">
              <div className="absolute left-0 top-0">
                <EdgeView id="g-a" from={[20, 30]} to={[300, 30]} label="opened from" />
              </div>
              <div className="absolute left-0 top-[70px]">
                <EdgeView id="g-b" from={[20, 30]} to={[300, 90]} label="supports" color="teal" />
              </div>
              <div className="absolute left-[340px] top-0">
                <EdgeView id="g-c" from={[20, 30]} to={[300, 110]} label="answers?" ghost />
              </div>
            </div>
          </Row>
        </Section>

        <Section id="intelligence" title="Suggestions">
          <Row>
            <GhostSuggestion
              kind="cluster"
              title="Group 3 pages as “Case studies”"
              reason="Shared topic: named cities (Rotterdam, Jakarta) and similar headings."
              confidence={0.82}
              hovered={hovered}
              onHoverChange={setHovered}
              onAccept={() => toast('Accepted (gallery only)')}
              onReject={() => toast('Rejected (gallery only)')}
            />
            <GhostSuggestion
              kind="edge"
              title="IPCC chapter → supports → Research question"
              reason="Chapter answers the funding sub-question directly."
              confidence={0.64}
            />
            <GhostSuggestion
              kind="tag"
              title="Tag 2 pages “insurance”"
              reason="Both discuss catastrophe insurance pools."
              confidence={0.55}
            />
          </Row>
        </Section>

        <Section id="navigation" title="Toolbar, palette and view switcher">
          <Row>
            <SelectionToolbarView
              color={colour}
              onColor={setColour}
              onTag={() => toast('Tag')}
              onNote={() => toast('Note')}
              onOpen={() => toast('Open in browser pane')}
              onZoom={() => toast('Zoom to selection')}
              onGroup={() => toast('Group')}
              onDelete={() => toast('Delete')}
            />
            <ViewSwitcher value={view} onChange={setView} />
            <ViewSwitcher value="graph" views={['graph', 'list']} />
          </Row>
          <CommandPaletteView
            query="rotterdam"
            active={0}
            results={[
              {
                type: 'video',
                title: 'Rotterdam: living with water',
                match: 'Title · youtube.com'
              },
              {
                type: 'note',
                title: 'Note: Rotterdam water squares',
                match: 'Note · in group Case studies'
              },
              { type: 'tag', title: '#rotterdam', match: 'Tag · 3 nodes' },
              {
                type: 'web',
                title: 'Sea-level rise and urban finance',
                match: 'Highlight · “…pilot in Rotterdam reduced…”'
              }
            ]}
          />
        </Section>

        <Section
          id="browser"
          title="Capture bar"
          note="Type an address and press Enter; toggle Manual and Auto."
        >
          <div className="flex max-w-[760px] flex-col gap-3">
            <CaptureBar
              url="https://nature.com/articles/s41558-023-01234"
              mode={mode}
              onModeChange={setMode}
              onNavigate={(u) => toast(`Navigate to ${u}`)}
              onAdd={() => toast('Added to canvas')}
              canGoBack
            />
            <CaptureBar url="https://youtube.com/watch?v=x1" mode="auto" canGoForward />
          </div>
        </Section>

        <Section id="home" title="Workspace cards">
          <Row>
            <WorkspaceCard
              name="Climate adaptation review"
              question="How do coastal cities fund climate adaptation?"
              nodes={24}
              groups={5}
              updatedAt={now - 2 * HOUR}
              now={now}
              menu={
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="wa-tb" aria-label="Workspace menu">
                      <Icon name="more" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem>Duplicate</DropdownMenuItem>
                    <DropdownMenuItem>Export JSON</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="danger">Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              }
            />
            <WorkspaceCard
              name="Intro to federated learning"
              question="What limits client drift?"
              nodes={11}
              groups={3}
              updatedAt={now - 30 * HOUR}
              now={now}
              coverThumb={fakePage('#2c62b8')}
            />
          </Row>
        </Section>

        <Section id="canvas" title="Canvas" note="Dotted surface: one dot per 32px.">
          <CanvasSurface height={312}>
            <div className="absolute left-[320px] top-[100px]">
              <QuestionCardView question="How do coastal cities fund climate adaptation?" />
            </div>
            <div className="absolute left-8 top-8">
              <NoteCardView text="Green bonds" width={160} />
            </div>
            <div className="absolute left-[700px] top-16">
              <NoteCardView
                text="Check OECD figure"
                tags={[{ label: 'to check', color: 'amber' }]}
                width={200}
              />
            </div>
          </CanvasSurface>
        </Section>

        <Section
          id="overlays"
          title="Overlays"
          note="Dialog, popover, menu and toast, restyled with the tokens."
        >
          <Row>
            <Dialog>
              <DialogTrigger asChild>
                <Button>Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>Delete workspace</DialogTitle>
                <DialogDescription>
                  This removes “Flood finance” and its thumbnails from this device.
                </DialogDescription>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button>Cancel</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button variant="reject" icon="trash">
                      Delete
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Popover>
              <PopoverTrigger asChild>
                <Button icon="tag">Open popover</Button>
              </PopoverTrigger>
              <PopoverContent>
                <label className="wa-field">
                  Tag
                  <input className="wa-input" placeholder="must-cite" />
                </label>
              </PopoverContent>
            </Popover>
            <Button onClick={() => toast('Added to canvas')}>Show a toast</Button>
          </Row>
        </Section>
      </div>
    </main>
  )
}
