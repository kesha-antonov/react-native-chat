import { StyleSheet } from 'react-native'
import { ChatTheme } from '../Theme'

export const createThemedStyles = (theme: ChatTheme) => StyleSheet.create({
  // The chat's wallpaper (or `colors.background`) is painted behind the list by `Chat`.
  root: {
    backgroundColor: 'transparent',
  },
  scrollChevron: {
    width: 10,
    height: 10,
    marginTop: -3,
    borderColor: theme.colors.scrollToBottomIcon,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '45deg' }],
  },
  scrollToBottomBadge: {
    backgroundColor: theme.colors.scrollToBottomBadge,
  },
  // `CounterView`: 13 bold white.
  scrollToBottomBadgeText: {
    color: theme.colors.scrollToBottomBadgeText,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  // Carries the icon color for an overridden chevron icon.
  chevronColor: {
    color: theme.colors.scrollToBottomIcon,
  },
})

export default StyleSheet.create({
  contentContainerStyle: {
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
  messagesContainer: {
    paddingBottom: 10,
  },
  emptyChatContainer: {
    transform: [{ scaleY: -1 }],
  },
  // Telegram's pagedown: a 44pt glass circle about 7 from the screen edge and 10 above the
  // composer island (`ChatActivityBlurredRoundButton`, `updatePagedownButtonsPosition`).
  scrollToBottom: {
    position: 'absolute',
    right: 7,
    bottom: 6,
    zIndex: 999,
  },
  // The counter is a 23pt pill centred on the circle's top edge (`CounterView`).
  scrollToBottomBadge: {
    position: 'absolute',
    top: -11.5,
    alignSelf: 'center',
    minWidth: 23,
    height: 23,
    borderRadius: 11.5,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollToBottomContent: {
    height: 44,
    width: 44,
    borderRadius: 22,
    transformOrigin: 'bottom',
  },
  scrollToBottomSurface: {
    borderRadius: 22,
  },
})
