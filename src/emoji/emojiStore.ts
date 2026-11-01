/**
 * The emoji keyboard's data: the tabs from the generated table, search, Telegram's recents and
 * the remembered skin tones. Everything is built on first use, not when the library loads, and
 * shared by every keyboard and reactions panel in the app.
 */
import { getAsyncStorage } from '../optional'
import { EMOJI_DATA } from './emojiData'

/** The built-in emoji tabs, in Telegram's order (`EmojiTabsStrip`). */
export type EmojiCategoryKey =
  | 'smileys'
  | 'animals'
  | 'food'
  | 'activities'
  | 'travel'
  | 'objects'
  | 'symbols'
  | 'flags'

export const EMOJI_CATEGORY_KEYS: EmojiCategoryKey[] = [
  'smileys', 'animals', 'food', 'activities', 'travel', 'objects', 'symbols', 'flags',
]

export interface EmojiCategory {
  key: EmojiCategoryKey
  emojis: string[]
}

interface EmojiIndex {
  categories: EmojiCategory[]
  /** Emojis that take a skin tone (`EmojiColorPickerWindow`). */
  toned: Set<string>
  /** [emoji, search words] for every emoji, for search. */
  words: Array<readonly [string, string]>
}

let index: EmojiIndex | null = null

const getIndex = (): EmojiIndex => {
  if (index)
    return index

  const toned = new Set<string>()
  const words: Array<readonly [string, string]> = []
  const categories = EMOJI_DATA.map(([key, chars, searchWords]) => {
    const wordList = searchWords.split('|')
    const emojis = chars.split(' ').map((entry, i) => {
      const isToned = entry.endsWith('~')
      const emoji = isToned ? entry.slice(0, -1) : entry
      if (isToned)
        toned.add(emoji)
      words.push([emoji, wordList[i] ?? ''])
      return emoji
    })
    return { key: key as EmojiCategoryKey, emojis }
  })
  index = { categories, toned, words }
  return index
}

/** The built-in tabs with their emojis, optionally limited to `keys` (in that order). */
export const getEmojiCategories = (keys?: EmojiCategoryKey[]): EmojiCategory[] => {
  const { categories } = getIndex()
  if (!keys)
    return categories

  return keys
    .map(key => categories.find(category => category.key === key))
    .filter((category): category is EmojiCategory => !!category)
}

/** Every emoji whose name or short names contain all the words of `query`. */
export const searchEmojis = (query: string, limit = 200): string[] => {
  const needles = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (needles.length === 0)
    return []

  const { words } = getIndex()
  const matches: string[] = []
  // Emojis whose words start with the query come first, as Telegram's keyword search ranks them.
  const later: string[] = []
  for (const [emoji, text] of words) {
    if (!needles.every(needle => text.includes(needle)))
      continue

    if (text.startsWith(needles[0]) || text.includes(` ${needles[0]}`))
      matches.push(emoji)
    else
      later.push(emoji)
    if (matches.length >= limit)
      break
  }
  return [...matches, ...later].slice(0, limit)
}

// The five Fitzpatrick modifiers, lightest first.
export const SKIN_TONES = ['\u{1F3FB}', '\u{1F3FC}', '\u{1F3FD}', '\u{1F3FE}', '\u{1F3FF}']

export const takesSkinTone = (emoji: string) => getIndex().toned.has(emoji)

/**
 * The emoji with a skin tone (0-4) applied, or as it is for `null`. The modifier goes after the
 * first code point, replacing a variation selector there; the data script marks only emojis for
 * which that gives Unicode's sequence.
 */
export const withSkinTone = (emoji: string, tone: number | null): string => {
  if (tone == null || !takesSkinTone(emoji))
    return emoji

  const points = Array.from(emoji)
  const rest = points.slice(1)
  if (rest[0] === '️')
    rest.shift()
  return [points[0], SKIN_TONES[tone], ...rest].join('')
}

/** The base emoji of a toned one, for looking up its tab and its remembered tone. */
export const withoutSkinTone = (emoji: string): string => {
  const points = Array.from(emoji)
  const toneIndex = points.findIndex(point => SKIN_TONES.includes(point))
  if (toneIndex < 0)
    return emoji

  const base = [...points.slice(0, toneIndex), ...points.slice(toneIndex + 1)].join('')
  if (takesSkinTone(base))
    return base
  // The data keeps the variation selector the tone replaced.
  const withSelector = [...points.slice(0, toneIndex), '️', ...points.slice(toneIndex + 1)].join('')
  return takesSkinTone(withSelector) ? withSelector : base
}

/* ------------------------------------------------------------------------------------------ */
/* Recents and skin tones                                                                      */
/* ------------------------------------------------------------------------------------------ */

// Telegram's `Emoji.DEFAULT_RECENT`, the recents a fresh install starts with.
export const DEFAULT_RECENT_EMOJIS = [
  '😂', '😘', '❤️', '😍', '😊', '😁', '👍', '☺️', '😔', '😄', '😭', '💋',
  '😒', '😳', '😜', '🙈', '😉', '😃', '😢', '😝', '😱', '😡', '😏', '😞',
  '😅', '😚', '🙊', '😌', '😀', '😋', '😆', '👌', '😐', '😕',
]

// `Emoji.MAX_RECENT_EMOJI_COUNT`.
export const MAX_RECENT_EMOJIS = 48

export const DEFAULT_RECENTS_STORAGE_KEY = '@kesha-antonov/react-native-chat/emoji'

interface StoredEmojiState {
  /** Use count per emoji (`Emoji.emojiUseHistory`). */
  history: Record<string, number>
  /** The tone picked per base emoji (`Emoji.emojiColor`). */
  tones: Record<string, number>
}

type Listener = () => void

/**
 * Telegram's recents: a use count per emoji, at most 48, the least used dropped when a new one
 * comes in. The list is sorted by count only when a keyboard opens (`sortEmoji`), so it does not
 * reshuffle under the finger while you type. Kept in memory, and in async storage when
 * `@react-native-async-storage/async-storage` is installed.
 */
class EmojiRecentsStore {
  private history: Map<string, number> = new Map()
  private order: string[] = []
  private tones: Map<string, number> = new Map()
  private loadedKey: string | null = null
  private loading: Promise<void> | null = null
  private listeners = new Set<Listener>()
  private storageKey = DEFAULT_RECENTS_STORAGE_KEY
  private isPersisted = true
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  constructor () {
    this.seed()
  }

  private seed () {
    this.history = new Map(DEFAULT_RECENT_EMOJIS.map((emoji, i) => [emoji, DEFAULT_RECENT_EMOJIS.length - i]))
    this.order = [...DEFAULT_RECENT_EMOJIS]
    this.tones = new Map()
  }

  private getStorage () {
    if (!this.isPersisted)
      return null
    const module = getAsyncStorage()
    const storage = module?.default ?? module
    return storage?.getItem && storage?.setItem ? storage : null
  }

  /** Where (and whether) to persist. Loads the stored state on the first call for a key. */
  configure ({ storageKey, isPersisted }: { storageKey?: string, isPersisted?: boolean }) {
    const key = storageKey ?? DEFAULT_RECENTS_STORAGE_KEY
    this.isPersisted = isPersisted !== false
    if (key !== this.storageKey) {
      this.storageKey = key
      this.loadedKey = null
      this.loading = null
    }
    return this.load()
  }

  load (): Promise<void> {
    if (this.loadedKey === this.storageKey)
      return Promise.resolve()
    if (this.loading)
      return this.loading

    const storage = this.getStorage()
    if (!storage) {
      this.loadedKey = this.storageKey
      return Promise.resolve()
    }

    const key = this.storageKey
    this.loading = Promise.resolve()
      .then(() => storage.getItem(key))
      .then((raw: string | null) => {
        if (key !== this.storageKey)
          return
        this.loadedKey = key
        if (!raw)
          return
        const parsed = JSON.parse(raw) as Partial<StoredEmojiState>
        if (parsed.history && Object.keys(parsed.history).length > 0) {
          this.history = new Map(Object.entries(parsed.history))
          this.sort()
        }
        if (parsed.tones)
          this.tones = new Map(Object.entries(parsed.tones))
        this.emit()
      })
      .catch(() => {
        this.loadedKey = key
      })
      .finally(() => {
        this.loading = null
      })
    return this.loading
  }

  subscribe (listener: Listener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit () {
    this.listeners.forEach(listener => listener())
  }

  /** The recents in the order last sorted. */
  getRecents (): string[] {
    return this.order
  }

  /** Re-sort by use count; Telegram does this each time the panel opens. */
  sort () {
    this.order = [...this.history.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([emoji]) => emoji)
      .slice(0, MAX_RECENT_EMOJIS)
  }

  /**
   * `Emoji.addRecentEmoji`: count one more use, evicting the least used when full. The shown
   * order changes only on the next `sort`.
   */
  add (emoji: string) {
    const count = this.history.get(emoji) ?? 0
    if (count === 0 && this.history.size >= MAX_RECENT_EMOJIS) {
      const evicted = this.order[this.order.length - 1]
      if (evicted !== undefined)
        this.history.delete(evicted)
    }
    this.history.set(emoji, count + 1)
    this.scheduleSave()
  }

  getTone (emoji: string): number | null {
    return this.tones.get(emoji) ?? null
  }

  setTone (emoji: string, tone: number | null) {
    if (tone == null)
      this.tones.delete(emoji)
    else
      this.tones.set(emoji, tone)
    this.scheduleSave()
    this.emit()
  }

  private scheduleSave () {
    const storage = this.getStorage()
    if (!storage)
      return
    if (this.saveTimer)
      clearTimeout(this.saveTimer)
    // Batched: a run of taps writes once.
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      const state: StoredEmojiState = {
        history: Object.fromEntries(this.history),
        tones: Object.fromEntries(this.tones),
      }
      Promise.resolve(storage.setItem(this.storageKey, JSON.stringify(state))).catch(() => {})
    }, 500)
  }

  /** @internal Tests only. */
  reset () {
    this.seed()
    this.loadedKey = null
    this.loading = null
    this.storageKey = DEFAULT_RECENTS_STORAGE_KEY
    this.isPersisted = true
    if (this.saveTimer)
      clearTimeout(this.saveTimer)
    this.saveTimer = null
  }
}

export const emojiRecents = new EmojiRecentsStore()
