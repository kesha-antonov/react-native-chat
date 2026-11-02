import { ChatLabels } from '../../i18n'
import { getEmojiCategories, searchEmojis } from '../emojiStore'
import { CATEGORY_LABEL, HEADER_HEIGHT, SEARCH_ROW } from './constants'
import { Item } from './types'

/** Every item is a fixed height, so offsets are exact and `getItemLayout` needs no measuring. */
export const itemLength = (item: Item | undefined, cellSize: number) =>
  !item ? 0 : item.type === 'search' ? SEARCH_ROW : item.type === 'header' ? HEADER_HEIGHT : item.type === 'empty' ? 80 : cellSize

/**
 * The list's items - the search row, section headers and emoji rows - with each item's offset
 * and the first item of each tab.
 */
export const buildItems = ({
  hasListSearch,
  isSearching,
  query,
  hasRecents,
  recents,
  categories,
  columns,
  cellSize,
  labels,
}: {
  hasListSearch: boolean
  isSearching: boolean
  query: string
  hasRecents: boolean
  recents: string[]
  categories: ReturnType<typeof getEmojiCategories>
  columns: number
  cellSize: number
  labels: ChatLabels
}) => {
  const list: Item[] = []
  const firstOfTab: number[] = []
  const pushRows = (emojis: string[], tab: number, keyPrefix: string) => {
    for (let i = 0; i < emojis.length; i += columns)
      list.push({ type: 'row', key: `${keyPrefix}-${i}`, emojis: emojis.slice(i, i + columns), tab })
  }

  if (hasListSearch)
    list.push({ type: 'search', key: 'search', tab: 0 })

  if (isSearching) {
    const found = searchEmojis(query)
    if (query.trim() && found.length === 0)
      list.push({ type: 'empty', key: 'empty', tab: 0 })
    pushRows(found, 0, `found-${query}`)
  } else {
    let tab = 0
    if (hasRecents) {
      firstOfTab[tab] = list.length
      pushRows(recents, tab, 'recent')
      tab += 1
    }
    for (const category of categories) {
      firstOfTab[tab] = list.length
      list.push({ type: 'header', key: `h-${category.key}`, title: labels[CATEGORY_LABEL[category.key]], tab })
      pushRows(category.emojis, tab, category.key)
      tab += 1
    }
  }

  let offset = 0
  const itemOffsets = list.map(item => {
    const start = offset
    offset += itemLength(item, cellSize)
    return start
  })
  return { items: list, offsets: itemOffsets, firstItemOfTab: firstOfTab }
}
