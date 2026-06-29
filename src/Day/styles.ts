import { StyleSheet } from 'react-native'
import { ChatTheme } from '../Theme'

export const createDayStyles = (theme: ChatTheme) =>
  StyleSheet.create({
    container: {
      marginTop: 8,
      marginBottom: 12,
    },
    wrapper: {
      backgroundColor: theme.colors.dayPillBackground,
      paddingVertical: 5,
      paddingHorizontal: 12,
      borderRadius: theme.radii.dayPill,
    },
    text: {
      color: theme.colors.dayPillText,
      fontSize: theme.typography.day.fontSize,
      fontWeight: theme.typography.day.fontWeight,
      letterSpacing: 0.2,
    },
  })
