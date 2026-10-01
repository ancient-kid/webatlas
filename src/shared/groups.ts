import type { Cat, GroupCategory } from './types'

/** Group colour used when none is chosen (also the colour of an accepted AI group). */
export const DEFAULT_GROUP_COLOR: Record<GroupCategory, Cat> = {
  topic: 'teal',
  source: 'blue',
  importance: 'rose',
  custom: 'moss'
}
