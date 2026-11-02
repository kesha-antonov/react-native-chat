import React from 'react'
import { Platform, Pressable, Text, TextInput, View } from 'react-native'

import { Icon } from '../../components/Icon'
import { ChatLabels } from '../../i18n'
import { ChatTheme } from '../../Theme'
import { Styles } from './styles'

const SearchIcon = ({ styles, color }: { styles: Styles, color: string }) => (
  <View style={styles.searchIcon}>
    <Icon name='search' color={color} size={20} fallback={<Text style={styles.searchFallback}>{'⌕'}</Text>} />
  </View>
)

// The search row as a list item in the keyboard: a tap target that only looks like the field.
export const SearchHint = ({ styles, isRTL, color, label }: { styles: Styles, isRTL: boolean, color: string, label: string }) => (
  <View style={styles.searchRow}>
    <View style={[styles.searchPill, isRTL && styles.rowReverse]}>
      <SearchIcon styles={styles} color={color} />
      <Text style={[styles.searchHint, isRTL && styles.textRTL]} numberOfLines={1}>{label}</Text>
    </View>
  </View>
)

/**
 * The real search field: fixed above the grid in the reactions panel, and in the keyboard once
 * search is entered, where its icon becomes the way back out.
 */
export const SearchField = ({
  inputRef,
  query,
  setQuery,
  setIsSearching,
  leaveSearch,
  isKeyboard,
  isRTL,
  isDark,
  styles,
  theme,
  labels,
}: {
  inputRef: React.RefObject<React.ComponentRef<typeof TextInput> | null>
  query: string
  setQuery: (query: string) => void
  setIsSearching: (isSearching: boolean) => void
  leaveSearch: () => void
  isKeyboard: boolean
  isRTL: boolean
  isDark: boolean
  styles: Styles
  theme: ChatTheme
  labels: ChatLabels
}) => (
  <View style={styles.searchRow}>
    <View style={[styles.searchPill, isRTL && styles.rowReverse]}>
      {isKeyboard
        ? (
          <Pressable onPress={leaveSearch} style={styles.searchIcon} hitSlop={6} accessibilityRole='button' accessibilityLabel={labels.cancel}>
            <Icon name='close' color={theme.emojiKeyboard.searchIcon} size={20} fallback={<Text style={styles.searchFallback}>{'✕'}</Text>} />
          </Pressable>
        )
        : <SearchIcon styles={styles} color={theme.emojiKeyboard.searchIcon} />}
      <TextInput
        ref={inputRef}
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
        autoFocus={isKeyboard && Platform.OS === 'android'}
        keyboardAppearance={isDark ? 'dark' : 'default'}
        onFocus={isKeyboard ? undefined : () => setIsSearching(true)}
        onBlur={isKeyboard ? undefined : () => !query && setIsSearching(false)}
        accessibilityLabel={labels.emojiSearch}
      />
    </View>
  </View>
)
