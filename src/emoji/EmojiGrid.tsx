import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList,
  GestureResponderEvent,
  LayoutChangeEvent,
  ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ListViewToken,
} from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { selectionHaptic } from '../components/haptics'
import { Icon } from '../components/Icon'
import { useColorScheme } from '../hooks/useColorScheme'
import { useIsRTL } from '../hooks/useIsRTL'
import { useLabels } from '../hooks/useLabels'
import { useTheme, useThemedStyles } from '../hooks/useTheme'
import { ChatLabels } from '../i18n'
import { IconName } from '../Icons'
import { ChatTheme } from '../Theme'
import {
  EmojiCategoryKey,
  emojiRecents,
  getEmojiCategories,
  searchEmojis,
  takesSkinTone,
  withSkinTone,
} from './emojiStore'

/*
 * Telegram Android's `EmojiView` grid, values from DrKLO/Telegram 13.1.1 (EV = EmojiView.java,
 * ETS = EmojiTabsStrip.java). Only the rows on screen are rendered, each cell is a plain Text,
 * and nothing animates per cell, so a screenful mounts as cheaply as a screenful of text.
 */

// The tab strip: 36 tall, 30x30 tabs 3 apart, 24 icons, an r8 indicator sliding 350ms on
// EASE_OUT_QUINT (`ETS:176, 477, 710-751`).
const TABS_HEIGHT = 36
const TAB_SIZE = 30
const TAB_GAP = 3
const TAB_ICON = 22
const INDICATOR_MOVE = { duration: 350, easing: Easing.bezier(0.23, 1, 0.32, 1) }
// Grid padding: 5 at the sides, 44 under the last row for the backspace bubble (`EV:1743`).
const GRID_PADDING_H = 5
const GRID_PADDING_BOTTOM = 44
// The search row is 50 with a 36-tall pill, radius 18, 10 / 8 margins (`EV:1578, 810-900`).
const SEARCH_ROW = 50
const SEARCH_PILL = 36
// Section header: 27 tall, 15 bold (`StickerSetNameCell:79-80`).
const HEADER_HEIGHT = 27
// The floating backspace bubble when only emoji are offered: 56x48 (`EV:2797-2805`).
const BACKSPACE_WIDTH = 56
const BACKSPACE_HEIGHT = 48
// Holding backspace repeats it.
const BACKSPACE_REPEAT_DELAY = 350
const BACKSPACE_REPEAT_MS = 60
// Skin-tone popup: six 32 cells 4 apart, 15 + 32 tall, an arrow under the pressed cell
// (`EmojiColorPickerWindow:68-75, 157-164`).
const TONE_CELL = 32
const TONE_SPACING = 4
const TONE_POPUP_WIDTH = 6 * TONE_CELL + 30
const TONE_POPUP_HEIGHT = 15 + TONE_CELL
const TONE_ARROW = 7

const TAB_ICONS: Record<EmojiCategoryKey | 'recent', IconName> = {
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
const TAB_FALLBACK: Record<EmojiCategoryKey | 'recent', string> = {
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

const CATEGORY_LABEL: Record<EmojiCategoryKey, keyof ChatLabels> = {
  smileys: 'emojiSmileys',
  animals: 'emojiAnimals',
  food: 'emojiFood',
  activities: 'emojiActivities',
  travel: 'emojiTravel',
  objects: 'emojiObjects',
  symbols: 'emojiSymbols',
  flags: 'emojiFlags',
}

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

type Item =
  | { type: 'search', key: string, tab: number }
  | { type: 'header', key: string, title: string, tab: number }
  | { type: 'row', key: string, emojis: string[], tab: number }
  | { type: 'empty', key: string, tab: number }

interface Tab {
  key: EmojiCategoryKey | 'recent'
  label: string
}

type Styles = ReturnType<typeof createStyles>

const EmojiRow = memo(({ emojis, cellSize, fontSize, isRTL, onPress, onLongPress, styles }: {
  emojis: string[]
  cellSize: number
  fontSize: number
  isRTL: boolean
  /** Bumped when a remembered tone changes, so the row redraws with it. */
  toneVersion: number
  onPress: (emoji: string) => void
  onLongPress: (emoji: string, event: GestureResponderEvent) => void
  styles: Styles
}) => (
  <View style={[styles.row, isRTL && styles.rowReverse]}>
    {emojis.map(emoji => {
      const shown = withSkinTone(emoji, emojiRecents.getTone(emoji))
      return (
        <Text
          key={emoji}
          onPress={() => onPress(shown)}
          onLongPress={takesSkinTone(emoji) ? event => onLongPress(emoji, event) : undefined}
          style={[styles.cell, { width: cellSize, height: cellSize, lineHeight: cellSize, fontSize }]}
          suppressHighlighting
          allowFontScaling={false}
          accessibilityRole='button'
          accessibilityLabel={shown}
        >
          {shown}
        </Text>
      )
    })}
  </View>
))
EmojiRow.displayName = 'EmojiRow'

/** The tab strip with its sliding indicator; owns the active tab so a scroll re-renders only it. */
const TabStrip = memo(({ tabs, activeRef, onPress, styles, theme, isRTL }: {
  tabs: Tab[]
  activeRef: React.MutableRefObject<(index: number) => void>
  onPress: (index: number) => void
  styles: Styles
  theme: ChatTheme
  isRTL: boolean
}) => {
  const [active, setActive] = useState(0)
  const activeIndexRef = useRef(0)
  const position = useSharedValue(0)
  const select = useCallback((index: number) => {
    if (activeIndexRef.current === index)
      return
    activeIndexRef.current = index
    position.value = withTiming(index, INDICATOR_MOVE)
    setActive(index)
  }, [position])
  useEffect(() => {
    activeRef.current = select
  }, [activeRef, select])

  const step = TAB_SIZE + TAB_GAP
  const direction = isRTL ? -1 : 1
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * step * direction }],
  }))

  return (
    <View style={styles.tabs}>
      <View style={[styles.tabRow, isRTL && styles.rowReverse]}>
        <Animated.View style={[styles.indicator, isRTL ? styles.indicatorRTL : null, indicatorStyle]} />
        {tabs.map((tab, index) => {
          const color = index === active ? theme.emojiKeyboard.iconSelected : theme.emojiKeyboard.icon
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                select(index)
                onPress(index)
              }}
              style={styles.tab}
              hitSlop={4}
              accessibilityRole='tab'
              accessibilityState={{ selected: index === active }}
              accessibilityLabel={tab.label}
            >
              <Icon
                name={TAB_ICONS[tab.key]}
                color={color}
                size={TAB_ICON}
                fallback={<Text style={[styles.tabFallback, index !== active && styles.tabFallbackIdle]}>{TAB_FALLBACK[tab.key]}</Text>}
              />
            </Pressable>
          )
        })}
      </View>
    </View>
  )
})
TabStrip.displayName = 'TabStrip'

interface TonePopupState {
  emoji: string
  x: number
  y: number
}

/** Telegram's skin-tone picker: the emoji plus five tones in a bubble above the pressed cell. */
const TonePopup = ({ popup, width, onPick, onClose, styles }: {
  popup: TonePopupState
  width: number
  onPick: (tone: number | null) => void
  onClose: () => void
  styles: Styles
}) => {
  const current = emojiRecents.getTone(popup.emoji)
  const left = Math.max(5, Math.min(popup.x - TONE_POPUP_WIDTH / 2, width - TONE_POPUP_WIDTH - 5))
  const top = Math.max(0, popup.y - TONE_POPUP_HEIGHT - TONE_ARROW)
  const arrowLeft = Math.max(12, Math.min(popup.x - left - TONE_ARROW, TONE_POPUP_WIDTH - 12 - TONE_ARROW * 2))
  const appear = useSharedValue(0)
  useEffect(() => {
    appear.value = withTiming(1, { duration: 125, easing: Easing.bezier(0.23, 1, 0.32, 1) })
  }, [appear])
  const appearStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ scale: 0.9 + 0.1 * appear.value }],
  }))

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel='close' />
      <Animated.View style={[styles.tonePopup, { left, top }, appearStyle]}>
        {[null, 0, 1, 2, 3, 4].map(tone => (
          <Pressable
            key={String(tone)}
            onPress={() => onPick(tone)}
            style={[styles.toneCell, tone === current && styles.toneCellSelected]}
            accessibilityRole='button'
            accessibilityLabel={withSkinTone(popup.emoji, tone)}
          >
            <Text style={styles.toneEmoji} allowFontScaling={false}>{withSkinTone(popup.emoji, tone)}</Text>
          </Pressable>
        ))}
        <View style={[styles.toneArrow, { left: arrowLeft }]} />
      </Animated.View>
    </View>
  )
}

/** Repeats while held, as Telegram's backspace does. */
const BackspaceButton = ({ onBackspace, styles, color, label, isRTL }: {
  onBackspace: () => void
  isRTL: boolean
  styles: Styles
  color: string
  label: string
}) => {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stop = useCallback(() => {
    if (timer.current)
      clearTimeout(timer.current)
    timer.current = null
  }, [])
  useEffect(() => stop, [stop])

  const start = useCallback(() => {
    onBackspace()
    const repeat = () => {
      onBackspace()
      selectionHaptic()
      timer.current = setTimeout(repeat, BACKSPACE_REPEAT_MS)
    }
    timer.current = setTimeout(repeat, BACKSPACE_REPEAT_DELAY)
  }, [onBackspace])

  return (
    <Pressable
      onPressIn={start}
      onPressOut={stop}
      style={[styles.backspace, isRTL && styles.backspaceRTL]}
      accessibilityRole='button'
      accessibilityLabel={label}
      hitSlop={6}
    >
      <Icon name='backspace' color={color} size={24} fallback={<Text style={[styles.backspaceFallback, { color }]}>{'⌫'}</Text>} />
    </Pressable>
  )
}

/**
 * The built-in emoji grid: Telegram Android's `EmojiView` with its tab strip, section headers,
 * search, recents and skin tones. The composer's emoji keyboard and the expanded reactions
 * panel are both this component.
 */
export const EmojiGrid = ({
  onSelect,
  variant = 'keyboard',
  columns: columnsProp,
  categories: categoryKeys,
  isRecentsEnabled = true,
  isSearchEnabled = true,
  onBackspace,
  onSearchModeChange,
  bottomInset = 0,
}: EmojiGridProps) => {
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)
  const labels = useLabels()
  const isRTL = useIsRTL()
  const isDark = useColorScheme() === 'dark'
  const isKeyboard = variant === 'keyboard'

  const [width, setWidth] = useState(0)
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width)
    // A hidden panel can report 0; keep the last real width so the rows stay laid out.
    if (next > 0)
      setWidth(previous => (previous === next ? previous : next))
  }, [])

  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const searchInputRef = useRef<React.ComponentRef<typeof TextInput>>(null)

  // Recents are sorted when the panel opens, then held still while it is up (`sortEmoji`).
  const [recents, setRecents] = useState<string[]>(() => {
    emojiRecents.sort()
    return emojiRecents.getRecents()
  })
  const [toneVersion, setToneVersion] = useState(0)
  // A remembered tone changed, or the stored recents finished loading.
  useEffect(() => emojiRecents.subscribe(() => {
    setToneVersion(version => version + 1)
    setRecents(emojiRecents.getRecents())
  }), [])

  const categories = useMemo(() => getEmojiCategories(categoryKeys), [categoryKeys])
  const hasRecents = isRecentsEnabled && recents.length > 0

  const tabs = useMemo<Tab[]>(() => [
    ...(hasRecents ? [{ key: 'recent' as const, label: labels.emojiRecent }] : []),
    ...categories.map(category => ({ key: category.key, label: labels[CATEGORY_LABEL[category.key]] })),
  ], [hasRecents, categories, labels])

  const columns = columnsProp ?? Math.max(1, Math.floor(width / theme.emojiKeyboard.cellSize))
  const cellSize = width > 0 ? Math.floor((width - GRID_PADDING_H * 2) / columns) : 0
  const fontSize = Math.min(theme.emojiKeyboard.emojiSize, Math.round(cellSize * 0.66))

  // In the keyboard the search row is the first item, scrolled away under the tabs; in the
  // reactions panel (and while searching) it is a fixed header instead.
  const hasListSearch = isKeyboard && isSearchEnabled && !isSearching

  const { items, offsets, firstItemOfTab } = useMemo(() => {
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
      offset += item.type === 'search' ? SEARCH_ROW : item.type === 'header' ? HEADER_HEIGHT : item.type === 'empty' ? 80 : cellSize
      return start
    })
    return { items: list, offsets: itemOffsets, firstItemOfTab: firstOfTab }
  }, [hasListSearch, isSearching, query, hasRecents, recents, categories, columns, cellSize, labels])

  const listRef = useRef<FlatList<Item>>(null)
  const activeTabRef = useRef<(index: number) => void>(() => {})
  // While a tab tap scrolls the list, the scroll must not drag the indicator back.
  const isJumpingRef = useRef(false)

  const getItemLayout = useCallback((_: ArrayLike<Item> | null | undefined, index: number) => {
    const item = items[index]
    const length = !item ? 0 : item.type === 'search' ? SEARCH_ROW : item.type === 'header' ? HEADER_HEIGHT : item.type === 'empty' ? 80 : cellSize
    return { length, offset: offsets[index] ?? 0, index }
  }, [items, offsets, cellSize])

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ListViewToken[] }) => {
    if (isJumpingRef.current)
      return
    const first = viewableItems.map(token => token.item as Item).find(item => item.type !== 'search')
    if (first)
      activeTabRef.current(first.tab)
  }).current

  const scrollToTab = useCallback((tab: number) => {
    const index = firstItemOfTab[tab]
    if (index === undefined)
      return
    isJumpingRef.current = true
    // Telegram smooth-scrolls to the tab; the rows are fixed height, so the offset is exact.
    listRef.current?.scrollToOffset({ offset: offsets[index] ?? 0, animated: true })
    setTimeout(() => {
      isJumpingRef.current = false
    }, 400)
  }, [firstItemOfTab, offsets])

  const handleSelect = useCallback((emoji: string) => {
    emojiRecents.add(emoji)
    onSelect(emoji)
  }, [onSelect])

  // Long-press on an emoji that takes a skin tone opens the tone popup above it.
  const containerRef = useRef<React.ComponentRef<typeof View>>(null)
  const [tonePopup, setTonePopup] = useState<TonePopupState | null>(null)
  const handleLongPress = useCallback((emoji: string, event: GestureResponderEvent) => {
    const { pageX, pageY, locationY } = event.nativeEvent
    selectionHaptic()
    containerRef.current?.measureInWindow((x, y) => {
      // The popup sits above the cell, whose top is the touch less its offset in the cell.
      const cellTop = pageY - y - (locationY ?? 0)
      setTonePopup({ emoji, x: pageX - x, y: cellTop })
    })
  }, [])
  const pickTone = useCallback((tone: number | null) => {
    const popup = tonePopup
    setTonePopup(null)
    if (!popup)
      return
    emojiRecents.setTone(popup.emoji, tone)
    handleSelect(withSkinTone(popup.emoji, tone))
  }, [tonePopup, handleSelect])

  const enterSearch = useCallback(() => {
    setIsSearching(true)
    onSearchModeChange?.(true)
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }, [onSearchModeChange])

  const leaveSearch = useCallback(() => {
    setIsSearching(false)
    setQuery('')
    searchInputRef.current?.blur()
    onSearchModeChange?.(false)
  }, [onSearchModeChange])

  const renderSearchPill = (isInput: boolean) => (
    <View style={styles.searchRow}>
      <View style={[styles.searchPill, isRTL && styles.rowReverse]}>
        {isInput && isKeyboard
          ? (
            <Pressable onPress={leaveSearch} style={styles.searchIcon} hitSlop={6} accessibilityRole='button' accessibilityLabel={labels.cancel}>
              <Icon name='close' color={theme.emojiKeyboard.searchIcon} size={20} fallback={<Text style={styles.searchFallback}>{'✕'}</Text>} />
            </Pressable>
          )
          : (
            <View style={styles.searchIcon}>
              <Icon name='search' color={theme.emojiKeyboard.searchIcon} size={20} fallback={<Text style={styles.searchFallback}>{'⌕'}</Text>} />
            </View>
          )}
        {isInput
          ? (
            <TextInput
              ref={searchInputRef}
              value={query}
              onChangeText={value => {
                setQuery(value)
                // The reactions panel searches as you type, focus or not.
                if (!isKeyboard)
                  setIsSearching(!!value)
              }}
              placeholder={labels.emojiSearch}
              placeholderTextColor={theme.emojiKeyboard.searchIcon}
              style={[styles.searchInput, isRTL && styles.textRTL]}
              autoCorrect={false}
              autoCapitalize='none'
              returnKeyType='search'
              keyboardAppearance={isDark ? 'dark' : 'default'}
              onFocus={isKeyboard ? undefined : () => setIsSearching(true)}
              onBlur={isKeyboard ? undefined : () => !query && setIsSearching(false)}
              accessibilityLabel={labels.emojiSearch}
            />
          )
          : (
            <Text style={[styles.searchHint, isRTL && styles.textRTL]} numberOfLines={1}>{labels.emojiSearch}</Text>
          )}
      </View>
    </View>
  )

  const renderItem = useCallback(({ item }: ListRenderItemInfo<Item>) => {
    switch (item.type) {
      case 'search':
        return (
          <Pressable onPress={enterSearch} accessibilityRole='search' accessibilityLabel={labels.emojiSearch}>
            {renderSearchPill(false)}
          </Pressable>
        )
      case 'header':
        return <Text style={[styles.header, isRTL && styles.textRTL]} numberOfLines={1}>{item.title}</Text>
      case 'empty':
        return <Text style={styles.empty}>{labels.emojiNoResults}</Text>
      default:
        return (
          <EmojiRow
            emojis={item.emojis}
            cellSize={cellSize}
            fontSize={fontSize}
            isRTL={isRTL}
            toneVersion={toneVersion}
            onPress={handleSelect}
            onLongPress={handleLongPress}
            styles={styles}
          />
        )
    }
    // renderSearchPill reads only values listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enterSearch, labels, styles, isRTL, cellSize, fontSize, toneVersion, handleSelect, handleLongPress])

  const showTabs = !isSearching && tabs.length > 1
  const showFixedSearch = isSearchEnabled && (!isKeyboard || isSearching)

  return (
    <View ref={containerRef} testID='emoji-grid' style={styles.container} onLayout={onLayout}>
      {isKeyboard && showTabs && (
        <TabStrip tabs={tabs} activeRef={activeTabRef} onPress={scrollToTab} styles={styles} theme={theme} isRTL={isRTL} />
      )}
      {showFixedSearch && renderSearchPill(true)}
      {!isKeyboard && showTabs && (
        <TabStrip tabs={tabs} activeRef={activeTabRef} onPress={scrollToTab} styles={styles} theme={theme} isRTL={isRTL} />
      )}
      {cellSize > 0 && (
        <FlatList
          // A new list when search starts or ends, so its initial offset applies again.
          key={hasListSearch ? 'with-search' : 'plain'}
          ref={listRef}
          data={items}
          keyExtractor={item => item.key}
          renderItem={renderItem}
          extraData={toneVersion}
          getItemLayout={getItemLayout}
          contentOffset={hasListSearch ? { x: 0, y: SEARCH_ROW } : undefined}
          contentContainerStyle={[styles.listContent, { paddingBottom: (onBackspace ? GRID_PADDING_BOTTOM : 8) + bottomInset }]}
          // About one panel of rows up front, then small batches: the panel is about 7 rows tall.
          initialNumToRender={9}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={30}
          windowSize={5}
          removeClippedSubviews
          keyboardShouldPersistTaps='always'
          keyboardDismissMode='none'
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          showsVerticalScrollIndicator={false}
        />
      )}
      {onBackspace && !isSearching && (
        <View style={[styles.backspaceWrap, isRTL ? styles.backspaceWrapRTL : null, { bottom: bottomInset }]} pointerEvents='box-none'>
          <BackspaceButton onBackspace={onBackspace} isRTL={isRTL} styles={styles} color={theme.emojiKeyboard.backspace} label={labels.backspace} />
        </View>
      )}
      {tonePopup && (
        <TonePopup popup={tonePopup} width={width} onPick={pickTone} onClose={() => setTonePopup(null)} styles={styles} />
      )}
    </View>
  )
}

const createStyles = (theme: ChatTheme) => {
  const colors = theme.emojiKeyboard
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    row: {
      flexDirection: 'row',
    },
    rowReverse: {
      flexDirection: 'row-reverse',
    },
    cell: {
      textAlign: 'center',
      color: '#000',
    },
    tabs: {
      height: TABS_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabRow: {
      flexDirection: 'row',
      gap: TAB_GAP,
    },
    tab: {
      width: TAB_SIZE,
      height: TAB_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabFallback: {
      fontSize: 18,
    },
    tabFallbackIdle: {
      opacity: 0.45,
    },
    indicator: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: TAB_SIZE,
      height: TAB_SIZE,
      borderRadius: 8,
      backgroundColor: colors.tabIndicator,
    },
    indicatorRTL: {
      left: undefined,
      right: 0,
    },
    listContent: {
      paddingHorizontal: GRID_PADDING_H,
    },
    header: {
      height: HEADER_HEIGHT,
      paddingTop: 7,
      paddingHorizontal: 10,
      fontSize: 15,
      lineHeight: 18,
      fontWeight: '700',
      color: colors.sectionTitle,
    },
    textRTL: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    empty: {
      height: 80,
      paddingTop: 30,
      textAlign: 'center',
      fontSize: 15,
      color: colors.sectionTitle,
    },
    searchRow: {
      height: SEARCH_ROW,
      paddingHorizontal: 10 - GRID_PADDING_H,
      paddingVertical: (SEARCH_ROW - SEARCH_PILL) / 2,
    },
    searchPill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: SEARCH_PILL / 2,
      backgroundColor: colors.searchBackground,
      marginHorizontal: GRID_PADDING_H,
    },
    searchIcon: {
      width: SEARCH_PILL,
      height: SEARCH_PILL,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchFallback: {
      fontSize: 16,
      color: colors.searchIcon,
    },
    searchHint: {
      flex: 1,
      fontSize: 16,
      color: colors.searchIcon,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      paddingVertical: 0,
      paddingRight: 12,
      color: colors.searchText,
    },
    backspaceWrap: {
      position: 'absolute',
      right: 0,
    },
    backspaceWrapRTL: {
      right: undefined,
      left: 0,
    },
    backspace: {
      width: BACKSPACE_WIDTH,
      height: BACKSPACE_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
      borderTopLeftRadius: BACKSPACE_HEIGHT / 2,
      borderBottomLeftRadius: BACKSPACE_HEIGHT / 2,
      backgroundColor: colors.background,
    },
    backspaceRTL: {
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
      borderTopRightRadius: BACKSPACE_HEIGHT / 2,
      borderBottomRightRadius: BACKSPACE_HEIGHT / 2,
    },
    backspaceFallback: {
      fontSize: 22,
    },
    tonePopup: {
      position: 'absolute',
      width: TONE_POPUP_WIDTH,
      height: TONE_POPUP_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: TONE_SPACING,
      borderRadius: 12,
      backgroundColor: colors.popupBackground,
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 6,
    },
    toneCell: {
      width: TONE_CELL - TONE_SPACING / 2,
      height: TONE_CELL,
      borderRadius: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toneCellSelected: {
      backgroundColor: colors.selector,
    },
    toneEmoji: {
      fontSize: 24,
      color: '#000',
    },
    toneArrow: {
      position: 'absolute',
      bottom: -TONE_ARROW,
      width: 0,
      height: 0,
      borderLeftWidth: TONE_ARROW,
      borderRightWidth: TONE_ARROW,
      borderTopWidth: TONE_ARROW,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: colors.popupBackground,
    },
  })
}
