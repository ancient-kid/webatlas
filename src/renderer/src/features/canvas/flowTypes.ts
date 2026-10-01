import { LabeledEdge } from './edges/LabeledEdge'
import { CardNode, FrameNode, NoteNode, QuestionNode } from './nodes/CanvasNodes'

/** React Flow node and edge components by type (see boardToFlow for the type names). */
export const NODE_TYPES = {
  question: QuestionNode,
  card: CardNode,
  note: NoteNode,
  frame: FrameNode
}

export const EDGE_TYPES = { labeled: LabeledEdge }
