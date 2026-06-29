import { Platform, StyleSheet } from 'react-native'
import { Color } from '../Color'
import { ChatTheme } from '../Theme'

export const createThemedStyles = (theme: ChatTheme) => StyleSheet.create({
  root: {
    backgroundColor: theme.colors.background,
  },
  scrollSurface: {
    backgroundColor: theme.colors.surface,
  },
  scrollChevron: {
    width: 10,
    height: 10,
    marginTop: -3,
    borderColor: theme.colors.accent,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '45deg' }],
  },
  // Carries the accent color for an overridden chevron icon.
  chevronColor: {
    color: theme.colors.accent,
  },
})

export default StyleSheet.create({
  containerAlignTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
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
  scrollToBottom: {
    position: 'absolute',
    right: 10,
    bottom: 30,
    zIndex: 999,
  },
  scrollToBottomContent: {
    height: 40,
    width: 40,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: Color.black,
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
})
