import { Easing } from 'react-native-reanimated'

import { ChatLabels } from '../../i18n'
import { IconName } from '../../Icons'
import { EmojiCategoryKey } from '../emojiStore'

// The tab strip: 36 tall, 30x30 tabs 3 apart, 24 icons, an r8 indicator sliding 350ms on
// EASE_OUT_QUINT.
export const TABS_HEIGHT = 36
export const TAB_SIZE = 30
export const TAB_GAP = 3
export const TAB_ICON = 22
export const INDICATOR_MOVE = { duration: 350, easing: Easing.bezier(0.23, 1, 0.32, 1) }
// Grid padding: 5 at the sides, 44 under the last row for the backspace bubble.
export const GRID_PADDING_H = 5
export const GRID_PADDING_BOTTOM = 44
// The search row is 50 with a 36-tall pill, radius 18, 10 / 8 margins.
export const SEARCH_ROW = 50
export const SEARCH_PILL = 36
// Section header: 27 tall, 15 bold.
export const HEADER_HEIGHT = 27
// The floating backspace bubble when only emoji are offered: 56x48.
export const BACKSPACE_WIDTH = 56
export const BACKSPACE_HEIGHT = 48
// Holding backspace repeats it.
export const BACKSPACE_REPEAT_DELAY = 350
export const BACKSPACE_REPEAT_MS = 60
// Skin-tone popup: six 32 cells 4 apart, 15 + 32 tall, an arrow under the pressed cell.
export const TONE_CELL = 32
export const TONE_SPACING = 4
export const TONE_POPUP_WIDTH = 6 * TONE_CELL + 30
export const TONE_POPUP_HEIGHT = 15 + TONE_CELL
export const TONE_ARROW = 7

export const TAB_ICONS: Record<EmojiCategoryKey | 'recent', IconName> = {
  recent: 'clock',
  smileys: 'emoji',
  animals: 'emojiAnimals',
  food: 'emojiFood',
  activities: 'emojiActivities',
  travel: 'emojiTravel',
  objects: 'emojiObjects',
  symbols: 'emojiSymbols',
  flags: 'emojiFlags',
}
// Without react-native-svg the tabs show a representative emoji instead.
export const TAB_FALLBACK: Record<EmojiCategoryKey | 'recent', string> = {
  recent: '🕘',
  smileys: '😀',
  animals: '🐱',
  food: '🍎',
  activities: '⚽',
  travel: '🚗',
  objects: '💡',
  symbols: '❤️',
  flags: '🏳️',
}

export const CATEGORY_LABEL: Record<EmojiCategoryKey, keyof ChatLabels> = {
  smileys: 'emojiSmileys',
  animals: 'emojiAnimals',
  food: 'emojiFood',
  activities: 'emojiActivities',
  travel: 'emojiTravel',
  objects: 'emojiObjects',
  symbols: 'emojiSymbols',
  flags: 'emojiFlags',
}
