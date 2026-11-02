import { EmojiCategoryKey } from '../emojiStore'

export interface EmojiGridProps {
  /** Called with the emoji (skin tone applied) the user taps. */
  onSelect: (emoji: string) => void
  /**
   * `'keyboard'`: the composer's panel - tabs on top, search scrolled away above the grid, a
   * floating backspace. `'reactions'`: the expanded reactions panel - search and tabs on top.
   */
  variant?: 'keyboard' | 'reactions'
  /** Fixed column count; by default `max(1, width / theme.emojiKeyboard.cellSize)`. */
  columns?: number
  /** Which built-in tabs to offer, in order. Default: all of them. */
  categories?: EmojiCategoryKey[]
  /** Show the recents tab. Default true. */
  isRecentsEnabled?: boolean
  /** Show search. Default true. */
  isSearchEnabled?: boolean
  /** The keyboard's backspace; without it there is no backspace key. */
  onBackspace?: () => void
  /** Search took focus (the system keyboard is coming up) or gave it back. */
  onSearchModeChange?: (isSearching: boolean) => void
  /** Space to keep clear under the grid (the home indicator). */
  bottomInset?: number
}

export type Item =
  | { type: 'search', key: string, tab: number }
  | { type: 'header', key: string, title: string, tab: number }
  | { type: 'row', key: string, emojis: string[], tab: number }
  | { type: 'empty', key: string, tab: number }

export interface Tab {
  key: EmojiCategoryKey | 'recent'
  label: string
}

export interface TonePopupState {
  emoji: string
  x: number
  y: number
}
