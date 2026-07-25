import { StyleSheet } from 'react-native'
import { ChatTheme } from '../Theme'

export const createBubbleStyles = (theme: ChatTheme) => {
  const { colors, radii, spacing, typography } = theme

  return StyleSheet.create({
    // Fills the message row so the pressable surface reaches the far edge, with
    // the bubble itself pinned to the sender's side.
    container: {
      flex: 1,
    },
    container_left: {
      alignItems: 'flex-start',
    },
    container_right: {
      alignItems: 'flex-end',
    },

    // Full-width band holding the bubble - this is what the reactions gesture is
    // attached to, so the whole row responds and not just the bubble.
    rowSurface: {
      alignSelf: 'stretch',
    },
    rowSurface_left: {
      alignItems: 'flex-start',
    },
    rowSurface_right: {
      alignItems: 'flex-end',
    },

    wrapper: {
      borderRadius: radii.bubble,
      minHeight: 20,
      maxWidth: '70%',
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
