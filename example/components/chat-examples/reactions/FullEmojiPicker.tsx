import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList,
  LayoutChangeEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ListViewToken,
  ViewStyle,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
// Deep imports, not the `lucide-react-native` barrel: the barrel re-exports every icon in the
// set and Metro has no tree-shaking, so importing from it ships all ~1600 of them (~1.2 MB).
import AppleIcon from 'lucide-react-native/icons/apple'
import CatIcon from 'lucide-react-native/icons/cat'
import ClockIcon from 'lucide-react-native/icons/clock'
import SmileIcon from 'lucide-react-native/icons/face-grinning'
import FlagIcon from 'lucide-react-native/icons/flag'
import HashIcon from 'lucide-react-native/icons/hash'
import LightbulbIcon from 'lucide-react-native/icons/lightbulb'
import PlaneIcon from 'lucide-react-native/icons/plane'
import UserIcon from 'lucide-react-native/icons/user'
import VolleyballIcon from 'lucide-react-native/icons/volleyball'
import { EMOJI_DATA } from './emojiData'

export interface EmojiPickerSearchBarProps {
  placeholderTextColor?: string
  [key: string]: unknown
}

export interface EmojiPickerThemeMode {
  searchbar?: {
    container?: StyleProp<ViewStyle>
    textInput?: StyleProp<TextStyle>
  }
  toolbar?: {
    container?: StyleProp<ViewStyle>
  }
}

export interface FullEmojiPickerTheme {
  light?: EmojiPickerThemeMode
  dark?: EmojiPickerThemeMode
}

export interface FullEmojiPickerProps {
  onSelect: (emoji: string) => void
  mode?: 'light' | 'dark'
  lang?: string
  columnCount?: number
  theme?: FullEmojiPickerTheme
  searchBarProps?: EmojiPickerSearchBarProps
}

type IconComponent = React.ComponentType<{ color?: string, size?: number }>

interface Emoji {
  char: string
  search: string
}

interface Category {
  key: string
  icon: IconComponent
}

const CATEGORIES: Category[] = [
  { key: 'Smileys & Emotion', icon: SmileIcon },
  { key: 'People & Body', icon: UserIcon },
  { key: 'Animals & Nature', icon: CatIcon },
  { key: 'Food & Drink', icon: AppleIcon },
  { key: 'Travel & Places', icon: PlaneIcon },
  { key: 'Activities', icon: VolleyballIcon },
  { key: 'Objects', icon: LightbulbIcon },
  { key: 'Symbols', icon: HashIcon },
  { key: 'Flags', icon: FlagIcon },
]
const RECENTS_KEY = 'Recent'

const LABELS: Record<string, { placeholder: string, recent: string, results: string }> = {
  en: { placeholder: 'Search emojis...', recent: 'Recent', results: 'Search results' },
  uk: { placeholder: 'Пошук емодзі...', recent: 'Останні', results: 'Результати' },
}

// Kept under the key react-native-emoji-chooser used, so recents survive the switch.
const STORAGE_KEY = 'emoji-picker-recent'
const MAX_RECENTS = 20
const HEADER_HEIGHT = 34
const TOOLBAR_HEIGHT = 40

const toChar = (unified: string) =>
  String.fromCodePoint(...unified.split('-').map(hex => parseInt(hex, 16)))

// Built once, on first open, not per render or per open.
let emojisByCategory: Map<string, Emoji[]> | null = null
const getEmojisByCategory = () => {
  if (!emojisByCategory)
    emojisByCategory = new Map(EMOJI_DATA.map(([category, emojis]) =>
      [category, emojis.map(([char, search]) => ({ char, search }))]
    ))

  return emojisByCategory
}

type Item =
  | { type: 'header', key: string, title: string, categoryIndex: number }
  | { type: 'row', key: string, emojis: string[], categoryIndex: number }

const EmojiRow = memo(({ emojis, cellSize, fontSize, onPress }: {
  emojis: string[]
  cellSize: number
  fontSize: number
  onPress: (emoji: string) => void
}) => (
  <View style={styles.row}>
    {emojis.map(emoji => (
      // A plain Text press: no per-cell animated touchable, so a screenful of
      // emojis mounts as cheaply as a screenful of text.
      <Text
        key={emoji}
        onPress={() => onPress(emoji)}
        style={[styles.cell, { width: cellSize, height: cellSize, lineHeight: cellSize, fontSize }]}
        suppressHighlighting
        accessibilityRole='button'
      >
        {emoji}
      </Text>
    ))}
  </View>
))
EmojiRow.displayName = 'EmojiRow'

/**
 * The full emoji browser drawn inside the reactions bar once its expand button
 * has grown it into a panel - Telegram's in-place expansion.
 *
 * It renders only the rows on screen. The emoji-chooser package it replaces
 * drew a whole category as one list item, so opening the panel mounted ~600
 * animated touchables at once and stalled the JS thread through the expand.
 */
export const FullEmojiPicker = ({
  onSelect,
  mode = 'light',
  lang = 'en',
  columnCount = 7,
  theme = {},
  searchBarProps,
}: FullEmojiPickerProps) => {
  const isDark = mode === 'dark'
  const themeMode = (isDark ? theme.dark : theme.light) ?? {}
  const labels = LABELS[lang] ?? LABELS.en
  const { placeholderTextColor, ...textInputProps } = searchBarProps ?? {}

  const [width, setWidth] = useState(0)
  const [query, setQuery] = useState('')
  const [recents, setRecents] = useState<string[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<FlatList<Item>>(null)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        const stored: unknown[] = raw ? JSON.parse(raw) : []
        // The old package stored emoji objects; this stores the characters.
        setRecents(stored.map(item =>
          typeof item === 'string' ? item : toChar((item as { unified: string }).unified)
        ))
      })
      .catch(() => {})
  }, [])

  const handleSelect = useCallback((emoji: string) => {
    const next = [emoji, ...recents.filter(item => item !== emoji)].slice(0, MAX_RECENTS)
    setRecents(next)
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {})
    onSelect(emoji)
  }, [recents, onSelect])

  const cellSize = width > 0 ? Math.floor(width / columnCount) : 0

  const { items, offsets, headerIndexByCategory } = useMemo(() => {
    const list: Item[] = []
    const headerIndex: number[] = []
    const pushSection = (title: string, emojis: string[], categoryIndex: number) => {
      if (emojis.length === 0)
        return
      headerIndex[categoryIndex] = list.length
      list.push({ type: 'header', key: `h-${title}`, title, categoryIndex })
      for (let i = 0; i < emojis.length; i += columnCount)
        list.push({ type: 'row', key: `${title}-${i}`, emojis: emojis.slice(i, i + columnCount), categoryIndex })
    }

    const byCategory = getEmojisByCategory()
    const needle = query.trim().toLowerCase()
    if (needle) {
      const matches: string[] = []
      byCategory.forEach(emojis => emojis.forEach(emoji => {
        if (emoji.search.includes(needle))
          matches.push(emoji.char)
      }))
      pushSection(labels.results, matches, 0)
    } else {
      // Index 0 is the recents tab; categories follow from 1.
      pushSection(labels.recent, recents, 0)
      CATEGORIES.forEach((category, index) =>
        pushSection(category.key, byCategory.get(category.key)!.map(emoji => emoji.char), index + 1)
      )
    }

    let offset = 0
    const itemOffsets = list.map(item => {
      const start = offset
      offset += item.type === 'header' ? HEADER_HEIGHT : cellSize
      return start
    })
    return { items: list, offsets: itemOffsets, headerIndexByCategory: headerIndex }
  }, [query, recents, columnCount, cellSize, labels])

  const getItemLayout = useCallback((_: ArrayLike<Item> | null | undefined, index: number) => ({
    length: items[index]?.type === 'header' ? HEADER_HEIGHT : cellSize,
    offset: offsets[index] ?? 0,
    index,
  }), [items, offsets, cellSize])

  const renderItem = useCallback(({ item }: { item: Item }) => {
    if (item.type === 'header')
      return <Text style={[styles.header, isDark && styles.headerDark]} numberOfLines={1}>{item.title}</Text>

    return <EmojiRow emojis={item.emojis} cellSize={cellSize} fontSize={Math.round(cellSize * 0.62)} onPress={handleSelect} />
  }, [isDark, cellSize, handleSelect])

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 10 }).current
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ListViewToken[] }) => {
    const first = viewableItems[0]?.item as Item | undefined
    if (first)
      setActiveIndex(first.categoryIndex)
  }).current

  const scrollToCategory = useCallback((categoryIndex: number) => {
    const index = headerIndexByCategory[categoryIndex]
    if (index === undefined)
      return
    setActiveIndex(categoryIndex)
    listRef.current?.scrollToIndex({ index, animated: false })
  }, [headerIndexByCategory])

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width - styles.list.paddingHorizontal * 2)
  }, [])

  const iconColor = isDark ? '#9ca3af' : '#6b7280'
  const activeColor = '#3390EC'
  const tabs = [{ key: RECENTS_KEY, icon: ClockIcon as IconComponent }, ...CATEGORIES]

  return (
    <View style={[styles.panel, isDark && styles.panelDark]} onLayout={onLayout}>
      <View style={themeMode.searchbar?.container}>
        <TextInput
          style={[styles.search, isDark && styles.searchDark, themeMode.searchbar?.textInput]}
          placeholder={labels.placeholder}
          placeholderTextColor={(placeholderTextColor as string | undefined) ?? iconColor}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          clearButtonMode='always'
          returnKeyType='done'
          {...textInputProps}
        />
      </View>
      {cellSize > 0 && (
        <FlatList
          ref={listRef}
          style={styles.list}
          data={items}
          keyExtractor={item => item.key}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          // About one panel of rows up front, and a short window after it: the
          // panel is at most 300pt tall, so a screen is ~7 rows.
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews
          keyboardShouldPersistTaps='handled'
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          showsVerticalScrollIndicator={false}
        />
      )}
      {!query && (
        <View style={[styles.toolbar, isDark && styles.toolbarDark, themeMode.toolbar?.container]}>
          {tabs.map((tab, index) => {
            const Icon = tab.icon
            const isDisabled = headerIndexByCategory[index] === undefined
            return (
              <Pressable
                key={tab.key}
                onPress={() => scrollToCategory(index)}
                disabled={isDisabled}
                style={[styles.tab, isDisabled && styles.tabDisabled]}
                accessibilityRole='button'
                accessibilityLabel={tab.key}
              >
                <Icon size={20} color={activeIndex === index ? activeColor : iconColor} />
              </Pressable>
            )
          })}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    paddingTop: 8,
    backgroundColor: '#ffffff',
  },
  panelDark: {
    backgroundColor: '#1f2937',
  },
  search: {
    height: 36,
    marginHorizontal: 8,
    marginBottom: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#E5E8E9',
    color: '#111827',
  },
  searchDark: {
    backgroundColor: '#374151',
    color: '#f9fafb',
  },
  list: {
    flex: 1,
    paddingHorizontal: 8,
  },
  header: {
    height: HEADER_HEIGHT,
    paddingTop: 10,
    paddingLeft: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  headerDark: {
    color: '#9ca3af',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    textAlign: 'center',
  },
  toolbar: {
    height: TOOLBAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.12)',
    backgroundColor: '#ffffff',
  },
  toolbarDark: {
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: '#1f2937',
  },
  tab: {
    padding: 6,
  },
  tabDisabled: {
    opacity: 0.3,
  },
})
