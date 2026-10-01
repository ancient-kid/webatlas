// DESIGN.md Icon: 24px grid, 1.75 stroke, round caps, currentColor. The design's
// placeholder glyphs are swapped for lucide-react icons of the same weight (allowed by
// DESIGN.md §1 Iconography); names follow the design's list plus a few app additions.
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  FileText,
  Focus,
  Globe,
  Group,
  Link2,
  List,
  MoreHorizontal,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  RotateCw,
  Search,
  Share2,
  StickyNote,
  Tag,
  Trash2,
  Undo2,
  Redo2,
  X,
  ZoomIn,
  type LucideIcon
} from 'lucide-react'
import type { CSSProperties, ReactElement } from 'react'
import { cn } from '@renderer/lib/utils'

export const ICONS = {
  // DESIGN.md set
  globe: Globe,
  play: Play,
  file: FileText,
  note: StickyNote,
  compass: Compass,
  search: Search,
  plus: Plus,
  check: Check,
  x: X,
  link: Link2,
  trash: Trash2,
  tag: Tag,
  graph: Share2,
  focus: Focus,
  list: List,
  palette: Palette,
  zoom: ZoomIn,
  arrow: ArrowRight,
  clock: Clock,
  // App additions
  back: ChevronLeft,
  forward: ChevronRight,
  reload: RotateCw,
  more: MoreHorizontal,
  group: Group,
  'panel-close': PanelLeftClose,
  'panel-open': PanelLeftOpen,
  undo: Undo2,
  redo: Redo2
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof ICONS

export interface IconProps {
  name: IconName
  /** Default 16; 14 inside chips and badges, 24 for empty states. */
  size?: number
  className?: string
  style?: CSSProperties
}

export function Icon({ name, size = 16, className, style }: IconProps): ReactElement {
  const Glyph = ICONS[name]
  return (
    <Glyph
      className={cn('wa-icon', className)}
      size={size}
      strokeWidth={1.75}
      fill={name === 'play' ? 'currentColor' : 'none'}
      aria-hidden="true"
      focusable="false"
      style={style}
    />
  )
}
