import { StyleSheet } from 'react-native'
import { ChatTheme } from '../Theme'

export const createBubbleStyles = (theme: ChatTheme) => {
  const { colors, radii, spacing, typography } = theme

  return StyleSheet.create({
    wrapper: {
      borderRadius: radii.bubble,
      minHeight: 20,
    },
    wrapper_left: {
      backgroundColor: colors.incomingBubble,
      justifyContent: 'flex-end',
    },
    wrapper_right: {
      backgroundColor: colors.outgoingBubble,
      justifyContent: 'flex-end',
    },
    // A round video note floats with no bubble background/chrome (Telegram-style).
    noteWrapper: {
      backgroundColor: 'transparent',
    },

    bottom: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingHorizontal: spacing.bubblePaddingH,
      paddingBottom: spacing.bubblePaddingV,
    },

    // Soften the inner corners of grouped messages instead of squaring them off.
    containerToNext_left: {
      borderBottomLeftRadius: radii.bubbleGrouped,
    },
    containerToNext_right: {
      borderBottomRightRadius: radii.bubbleGrouped,
    },

    containerToPrevious_left: {
      borderTopLeftRadius: radii.bubbleGrouped,
    },
    containerToPrevious_right: {
      borderTopRightRadius: radii.bubbleGrouped,
    },

    messageTimeAndStatusContainer: {
      flexGrow: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 3,
    },

    messageStatusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    usernameContainer: {
      paddingHorizontal: spacing.bubblePaddingH,
      paddingTop: spacing.bubblePaddingV,
    },
    username: {
      fontSize: typography.senderName.fontSize,
      fontWeight: typography.senderName.fontWeight,
      color: colors.senderName,
    },
  })
}

export type BubbleStyles = ReturnType<typeof createBubbleStyles>
