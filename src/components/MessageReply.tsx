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

import { useThemedStyles } from '../hooks/useTheme'
import { IMessage, ReplyMessage } from '../Models'
import { ChatTheme } from '../Theme'
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
  /** Callback when reply is pressed */
  onPress?: (replyMessage: ReplyMessage) => void
}

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  container: {
    borderRadius: 8,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  containerLeft: {
    backgroundColor: theme.colors.reactionBackground,
    borderLeftColor: theme.colors.accent,
    borderLeftWidth: 3,
  },
  containerRight: {
    backgroundColor: theme.colors.outgoingOverlay,
    borderLeftColor: theme.colors.outgoingMeta,
    borderLeftWidth: 3,
  },
  image: {
    borderRadius: 4,
    height: 40,
    marginTop: 4,
    width: 40,
  },
  text: {
    fontSize: 13,
  },
  textLeft: {
    color: theme.colors.incomingText,
  },
  textRight: {
    color: theme.colors.outgoingText,
  },
  username: {
    fontWeight: '600',
    marginBottom: 2,
  },
  usernameLeft: {
    color: theme.colors.accent,
  },
  usernameRight: {
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

  const handlePress = () => {
    onPress?.(replyMessage)
  }

  const containerStyles = [
    styles.container,
    position === 'left' ? styles.containerLeft : styles.containerRight,
    containerStyle,
    position === 'left' ? containerStyleLeft : containerStyleRight,
  ]

  const usernameStyles = [
    styles.username,
    position === 'left' ? styles.usernameLeft : styles.usernameRight,
    textStyle,
    position === 'left' ? textStyleLeft : textStyleRight,
  ]

  const textStyles = [
    styles.text,
    position === 'left' ? styles.textLeft : styles.textRight,
    textStyle,
    position === 'left' ? textStyleLeft : textStyleRight,
  ]

  return (
    <Pressable onPress={handlePress}>
      <View style={containerStyles}>
        <Text style={usernameStyles} numberOfLines={1}>
          {displayName}
        </Text>
        {replyMessage.text && (
          <Text style={textStyles} numberOfLines={2}>
            {replyMessage.text}
          </Text>
        )}
        {replyMessage.image && (
          <Image
            source={{ uri: replyMessage.image }}
            style={[styles.image, imageStyle]}
          />
        )}
      </View>
    </Pressable>
  )
}
