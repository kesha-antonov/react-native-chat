import { StyleSheet } from 'react-native'
import { ChatTheme } from '../Theme'

// The date pill: 14 Medium white on the service color, radius 11,
// 8 either side and 3 above and below the line. The cell leaves 7 to the bubbles around it.
// A pinned date's row sits 9 below the list's top, so its pill pins at 10 (STICKY_DAY_CONFIG).
export const createDayStyles = (theme: ChatTheme) =>
  StyleSheet.create({
    container: {
      marginTop: 1,
      marginBottom: 7,
    },
    wrapper: {
      backgroundColor: theme.colors.dayPillBackground,
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: theme.radii.dayPill,
    },
    text: {
      color: theme.colors.dayPillText,
      fontSize: theme.typography.day.fontSize,
      lineHeight: theme.typography.day.lineHeight,
      fontWeight: theme.typography.day.fontWeight,
    },
  })
