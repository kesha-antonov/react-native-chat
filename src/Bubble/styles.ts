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

    // With the bubble background gone, the meta row would render white-on-light.
    // Telegram floats it in a translucent pill (`drawTime` with
    // `paint_chatActionBackground` for a round note): 17dp tall, 4dp corners,
    // 4dp either side of the text and the ticks, in the service text color.
    // Anchored to the note's bounding-box corner, which on a circle sits just
    // outside the shape, clear of the duration pill on the other side.
    noteMetaPill: {
      position: 'absolute',
      bottom: 2,
      right: 0,
      height: 17,
      justifyContent: 'flex-end',
      // Overrides `bottom`'s padding, which would otherwise offset the pill.
      paddingHorizontal: 4,
      paddingTop: 0,
      paddingBottom: 0,
    },
    // The service color at 0.6 of its own alpha, as `drawTime` scales it.
    noteMetaBackground: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      borderRadius: 4,
      backgroundColor: colors.dayPillBackground,
      opacity: 0.6,
    },
    // The meta row grows to fill a bubble; on a note it just hugs.
    noteMetaInner: {
      flexGrow: 0,
    },
    noteMetaText: {
      color: colors.dayPillText,
    },

    // A voice note's time shares the duration's line at the bubble's
    // bottom-right instead of taking a row of its own (`ChatMessageCell`
    // draws it at `layoutHeight - 6.5dp`), so it is laid over the player.
    voiceMeta: {
      position: 'absolute',
      right: 0,
      bottom: 0,
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
