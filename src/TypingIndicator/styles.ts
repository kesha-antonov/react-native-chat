import { StyleSheet } from 'react-native'
import { ChatTheme } from '../Theme'

export const createTypingIndicatorStyles = (theme: ChatTheme) => StyleSheet.create({
  container: {
    marginLeft: 8,
    width: 45,
    borderRadius: theme.radii.bubble,
    backgroundColor: theme.colors.incomingBubble,
  },
  dots: {
    flexDirection: 'row',
  },
  dot: {
    marginLeft: 2,
    marginRight: 2,
    borderRadius: 4,
    width: 8,
    height: 8,
    backgroundColor: theme.colors.incomingMeta,
  },
})
