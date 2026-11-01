import { StyleSheet } from 'react-native'
import { ChatTheme } from '../Theme'

// Telegram's date pill (`ChatActionCell`): 14 Medium white on the service color, radius 11,
// 8 either side and 3 above and below the line. The cell leaves 7 to the bubbles around it.
// Keep `marginTop` in step with `DAY_MARGIN_TOP` (MessagesContainer/components/dayLayout).
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
