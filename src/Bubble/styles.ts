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

    // The body. Its corners, width cap and shadow are worked out per message (see `Bubble`);
    // the tail is drawn outside it, so it must not clip.
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
    // The gradient is a layer inside the body.
    gradientWrapper: {
      backgroundColor: 'transparent',
    },
    // A round video note floats with no bubble background/chrome (Telegram-style).
    noteWrapper: {
      backgroundColor: 'transparent',
    },

    // The time on the last line of text (or of reaction pills): Telegram's time text ends
    // 6.5dp above the cell's bottom, 3.5 above the body's, 7dp in from its edge - the checks
    // 7.5dp in, with the time 4 to their left (`ChatMessageCell:13826`, `:24535`, `:24860`).
    meta: {
      position: 'absolute',
      bottom: 3.5,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    // At the end of the line: the right, or the left in a right-to-left layout.
    metaIncomingEnd: {
      right: 7,
    },
    metaOutgoingEnd: {
      right: 7.5,
    },
    metaIncomingStart: {
      left: 7,
    },
    metaOutgoingStart: {
      left: 7.5,
    },
    // Matches the time text, so the copy reserving its place has exactly its width.
    metaSpacer: {
      fontSize: typography.time.fontSize,
      fontWeight: typography.time.fontWeight,
    },
    metaSpacerHidden: {
      color: 'transparent',
    },

    // Telegram's time pill over a photo: 17 tall, radius 8, 6 in from the photo's corner,
    // `chat_mediaTimeBackground` with white text (`ChatMessageCell:24068`).
    mediaMeta: {
      position: 'absolute',
      bottom: 8,
      height: 17,
      borderRadius: radii.mediaTimePill,
      paddingHorizontal: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: colors.mediaTimeBackground,
    },
    mediaMetaEnd: {
      right: 8,
    },
    mediaMetaStart: {
      left: 8,
    },
    mediaMetaText: {
      color: colors.mediaTimeText,
    },
    // The photo sits 2 in from the body, so its 15 corners run parallel to the bubble's 17.
    mediaFrame: {
      margin: 2,
    },

    // Text followed by reaction pills, or by a time row of its own, ends closer to it.
    textAboveReactions: {
      marginBottom: 6,
    },
    // `drawLinkPreview`: the block's box starts 6 below the last line of text.
    textAboveLinkPreview: {
      marginBottom: 4,
    },
    textAboveMetaRow: {
      marginBottom: 2,
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

    // Big emoji float on the wallpaper like a sticker: no fill, no padding.
    emojiWrapper: {
      backgroundColor: 'transparent',
    },
    bigEmoji: {
      paddingHorizontal: 2,
      textAlign: 'left',
    },
    // The sticker time pill (`ChatMessageCell`, service paint for stickers): 17 tall, radius
    // 8, 6 in, under the emoji at the end.
    emojiMeta: {
      alignSelf: 'flex-end',
      height: 17,
      borderRadius: radii.mediaTimePill,
      paddingHorizontal: 6,
      marginTop: 2,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: colors.dayPillBackground,
    },

    // The time on a row of its own, for content the time cannot flow into.
    bottom: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingLeft: spacing.bubblePaddingH,
      paddingRight: 7.5,
      paddingBottom: 3.5,
    },

    messageTimeAndStatusContainer: {
      flexGrow: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 4,
    },

    messageStatusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    // Telegram's name block: 14 Medium in the sender's color, 5 + 14 tall, the text starting
    // right under it (`ChatMessageCell:21285`, `getNameHeight`).
    usernameContainer: {
      paddingHorizontal: spacing.bubblePaddingH,
      paddingTop: 6,
      marginBottom: -3,
    },
    username: {
      fontSize: typography.senderName.fontSize,
      lineHeight: typography.senderName.lineHeight,
      fontWeight: typography.senderName.fontWeight,
      color: colors.senderName,
    },
  })
}

export type BubbleStyles = ReturnType<typeof createBubbleStyles>
