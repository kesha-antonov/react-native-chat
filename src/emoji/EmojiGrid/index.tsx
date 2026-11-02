import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList,
  GestureResponderEvent,
  LayoutChangeEvent,
  ListRenderItemInfo,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'

import { selectionHaptic } from '../../components/haptics'
import { useColorScheme } from '../../hooks/useColorScheme'
import { useIsRTL } from '../../hooks/useIsRTL'
import { useLabels } from '../../hooks/useLabels'
import { useTheme, useThemedStyles } from '../../hooks/useTheme'
import { emojiRecents, getEmojiCategories, withSkinTone } from '../emojiStore'
import { BackspaceButton } from './BackspaceButton'
import { CATEGORY_LABEL, GRID_PADDING_BOTTOM, GRID_PADDING_H, SEARCH_ROW } from './constants'
import { EmojiRow } from './EmojiRow'
import { buildItems, itemLength } from './items'
import { SearchField, SearchHint } from './Search'
import { createStyles } from './styles'
import { TabStrip } from './TabStrip'
import { TonePopup } from './TonePopup'
import { EmojiGridProps, Item, Tab, TonePopupState } from './types'
import { useTabScroll } from './useTabScroll'

export type { EmojiGridProps } from './types'

/*
 * The emoji grid. Only the rows on screen are rendered, each cell is a plain Text,
 * and nothing animates per cell, so a screenful mounts as cheaply as a screenful of text.
 */

/**
 * The built-in emoji grid with its tab strip, section headers,
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

  const { items, offsets, firstItemOfTab } = useMemo(
    () => buildItems({ hasListSearch, isSearching, query, hasRecents, recents, categories, columns, cellSize, labels }),
    [hasListSearch, isSearching, query, hasRecents, recents, categories, columns, cellSize, labels]
  )

  const { listRef, activeTabRef, viewabilityConfig, onViewableItemsChanged, scrollToTab, endScrub } = useTabScroll(firstItemOfTab, offsets)

  const getItemLayout = useCallback((_: ArrayLike<Item> | null | undefined, index: number) => {
    const length = itemLength(items[index], cellSize)
    return { length, offset: offsets[index] ?? 0, index }
  }, [items, offsets, cellSize])

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
    // Android does not raise the soft keyboard for a field focused in the frame it mounts in
    // (the cursor shows, the keyboard never comes), so there the field asks for focus itself
    // once it is attached, through `autoFocus`.
    if (Platform.OS !== 'android')
      requestAnimationFrame(() => searchInputRef.current?.focus())
  }, [onSearchModeChange])

  const leaveSearch = useCallback(() => {
    setIsSearching(false)
    setQuery('')
    searchInputRef.current?.blur()
    onSearchModeChange?.(false)
  }, [onSearchModeChange])

  const renderItem = useCallback(({ item }: ListRenderItemInfo<Item>) => {
    switch (item.type) {
      case 'search':
        return (
          <Pressable onPress={enterSearch} accessibilityRole='search' accessibilityLabel={labels.emojiSearch}>
            <SearchHint styles={styles} isRTL={isRTL} color={theme.emojiKeyboard.searchIcon} label={labels.emojiSearch} />
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
  }, [enterSearch, labels, styles, isRTL, theme.emojiKeyboard.searchIcon, cellSize, fontSize, toneVersion, handleSelect, handleLongPress])

  const showTabs = !isSearching && tabs.length > 1
  const showFixedSearch = isSearchEnabled && (!isKeyboard || isSearching)

  return (
    <View ref={containerRef} testID='emoji-grid' style={styles.container} onLayout={onLayout}>
      {isKeyboard && showTabs && (
        <TabStrip tabs={tabs} activeRef={activeTabRef} onPress={scrollToTab} onScrubEnd={endScrub} styles={styles} theme={theme} isRTL={isRTL} />
      )}
      {showFixedSearch && (
        <SearchField
          inputRef={searchInputRef}
          query={query}
          setQuery={setQuery}
          setIsSearching={setIsSearching}
          leaveSearch={leaveSearch}
          isKeyboard={isKeyboard}
          isRTL={isRTL}
          isDark={isDark}
          styles={styles}
          theme={theme}
          labels={labels}
        />
      )}
      {!isKeyboard && showTabs && (
        <TabStrip tabs={tabs} activeRef={activeTabRef} onPress={scrollToTab} onScrubEnd={endScrub} styles={styles} theme={theme} isRTL={isRTL} />
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
