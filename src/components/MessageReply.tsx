import React, { useMemo } from 'react'
import {
  Image,
  ImageStyle,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native'

import { multiplyAlpha } from '../colorUtils'
import { useTheme, useThemedStyles } from '../hooks/useTheme'
import { IMessage, ReplyMessage } from '../Models'
import { ChatTheme, getNameColor } from '../Theme'
import { isSameUser } from '../utils'

export interface MessageReplyProps<TMessage extends IMessage = IMessage> {
  /** The reply message to display */
  replyMessage: ReplyMessage
  /** The current message containing the reply */
  currentMessage: TMessage
  /** Position of the bubble (left or right) */
  position: 'left' | 'right'
  /** Container style for the reply */
  containerStyle?: StyleProp<ViewStyle>
  /** Container style for left position */
  containerStyleLeft?: StyleProp<ViewStyle>
  /** Container style for right position */
  containerStyleRight?: StyleProp<ViewStyle>
  /** Text style for the reply */
  textStyle?: StyleProp<TextStyle>
  /** Text style for left position */
  textStyleLeft?: StyleProp<TextStyle>
  /** Text style for right position */
  textStyleRight?: StyleProp<TextStyle>
  /** Image style for the reply */
  imageStyle?: StyleProp<ImageStyle>
  /** Called with the quote and the message that carries it. */
  onPress?: (replyMessage: ReplyMessage, message: TMessage) => void
}

// `ReplyMessageLine`: the box is its accent at 10% (12% on a dark outgoing bubble).
const BOX_ALPHA = 0.1
const BOX_ALPHA_ON_WHITE_LINE = 0.12

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  // A rounded box with a 3pt accent bar down its left edge, 8 in from the bubble's edges
  // (`ChatMessageCell:22774-22826`, `ReplyMessageLine:540`).
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginHorizontal: 6,
    marginBottom: 1,
    borderLeftWidth: 3,
    borderTopLeftRadius: theme.radii.replyQuote,
    borderBottomLeftRadius: theme.radii.replyQuote,
    borderTopRightRadius: theme.radii.replyQuote * 2,
    borderBottomRightRadius: theme.radii.replyQuote,
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 3,
    paddingBottom: 4,
    overflow: 'hidden',
  },
  // A 35pt square, radius 4, with the text moved over by its width + 3.
  image: {
    width: 35,
    height: 35,
    borderRadius: 4,
    marginRight: 6,
    marginLeft: -2,
  },
  content: {
    flexShrink: 1,
  },
  username: {
    fontSize: theme.typography.replyName.fontSize,
    lineHeight: theme.typography.replyName.lineHeight,
    fontWeight: theme.typography.replyName.fontWeight,
  },
  text: {
    fontSize: theme.typography.replyText.fontSize,
    lineHeight: theme.typography.replyText.lineHeight,
    fontWeight: theme.typography.replyText.fontWeight,
  },
  textLeft: {
    color: theme.colors.incomingText,
  },
  textRight: {
    color: theme.colors.outgoingText,
  },
})

export function MessageReply<TMessage extends IMessage = IMessage> ({
  replyMessage,
  currentMessage,
  position,
  containerStyle,
  containerStyleLeft,
  containerStyleRight,
  textStyle,
  textStyleLeft,
  textStyleRight,
  imageStyle,
  onPress,
}: MessageReplyProps<TMessage>) {
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)

  const isCurrentUser = useMemo(
    () => isSameUser(currentMessage, { user: replyMessage.user } as TMessage),
    [currentMessage, replyMessage.user]
  )

  const displayName = useMemo(() => {
    if (isCurrentUser)
      return 'You'

    return replyMessage.user?.name || 'Unknown'
  }, [isCurrentUser, replyMessage.user?.name])

  // Incoming quotes take the quoted author's own color; outgoing ones the bubble's.
  const accent = position === 'left'
    ? (theme.nameColors.length ? getNameColor(theme, replyMessage.user?._id) : theme.colors.incomingReplyLine)
    : theme.colors.outgoingReplyLine
  const nameColor = position === 'left'
    ? (theme.nameColors.length ? accent : theme.colors.incomingReplyName)
    : theme.colors.outgoingReplyName
  const boxAlpha = position === 'right' && accent.toUpperCase() === '#FFFFFF' ? BOX_ALPHA_ON_WHITE_LINE : BOX_ALPHA

  const handlePress = () => {
    onPress?.(replyMessage, currentMessage)
  }

  const containerStyles = [
    styles.container,
    { borderLeftColor: accent, backgroundColor: multiplyAlpha(accent, boxAlpha) },
    containerStyle,
    position === 'left' ? containerStyleLeft : containerStyleRight,
  ]

  const usernameStyles = [
    styles.username,
    { color: nameColor },
    textStyle,
    position === 'left' ? textStyleLeft : textStyleRight,
  ]

  const hasText = !!replyMessage.text
  const textStyles = [
    styles.text,
    position === 'left' ? styles.textLeft : styles.textRight,
    textStyle,
    position === 'left' ? textStyleLeft : textStyleRight,
  ]

  return (
    <Pressable onPress={handlePress}>
      <View style={containerStyles}>
        {replyMessage.image && (
          <Image
            source={{ uri: replyMessage.image }}
            style={[styles.image, imageStyle]}
          />
        )}
        <View style={styles.content}>
          <Text style={usernameStyles} numberOfLines={1}>
            {displayName}
          </Text>
          {hasText && (
            <Text style={textStyles} numberOfLines={1}>
              {replyMessage.text}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  )
}
