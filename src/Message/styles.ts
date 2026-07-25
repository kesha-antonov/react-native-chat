import { StyleSheet } from 'react-native'

export default StyleSheet.create({
  // The row spans the full width so a long-press anywhere beside the bubble
  // still opens the reactions / context menu (Telegram-style). The 70% cap
  // lives on the bubble itself (see `wrapper` in Bubble/styles).
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginHorizontal: 8,
  },
  container_left: {
    justifyContent: 'flex-start',
  },
  container_right: {
    justifyContent: 'flex-end',
  },
})
