import { StyleSheet } from 'react-native'

import { ChatTheme } from '../../Theme'
import {
  BACKSPACE_HEIGHT,
  BACKSPACE_WIDTH,
  GRID_PADDING_H,
  HEADER_HEIGHT,
  SEARCH_PILL,
  SEARCH_ROW,
  TAB_GAP,
  TAB_SIZE,
  TABS_HEIGHT,
  TONE_ARROW,
  TONE_CELL,
  TONE_POPUP_HEIGHT,
  TONE_POPUP_WIDTH,
  TONE_SPACING,
} from './constants'

export type Styles = ReturnType<typeof createStyles>

export const createStyles = (theme: ChatTheme) => {
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
