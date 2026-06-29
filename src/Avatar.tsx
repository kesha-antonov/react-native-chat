import React, { ReactNode, useCallback } from 'react'
import {
  ImageStyle,
  StyleSheet,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native'
import { ChatAvatar } from './ChatAvatar'
import { useThemedStyles } from './hooks/useTheme'
import { IMessage, LeftRightStyle, User } from './Models'
import { ChatTheme } from './Theme'
import { isSameUser, isSameDay } from './utils'

interface Styles {
  left: {
    container: ViewStyle
    onTop: ViewStyle
    image: ImageStyle
  }
  right: {
    container: ViewStyle
    onTop: ViewStyle
    image: ImageStyle
  }
}

const createStyles = (theme: ChatTheme): Styles => {
  const size = theme.avatar.size
  const image: ImageStyle = {
    height: size,
    width: size,
    borderRadius: size / 2,
  }

  return {
    left: StyleSheet.create({
      container: { marginRight: 8 },
      onTop: { alignSelf: 'flex-start' },
      image,
    }),
    right: StyleSheet.create({
      container: { marginLeft: 8 },
      onTop: { alignSelf: 'flex-start' },
      image,
    }),
  }
}

export interface AvatarProps<TMessage extends IMessage> {
  currentMessage: TMessage
  previousMessage?: TMessage
  nextMessage?: TMessage
  position: 'left' | 'right'
  isAvatarOnTop?: boolean
  isAvatarVisibleForEveryMessage?: boolean
  imageStyle?: LeftRightStyle<ImageStyle>
  containerStyle?: LeftRightStyle<ViewStyle>
  textStyle?: TextStyle
  renderAvatar?(props: Omit<AvatarProps<TMessage>, 'renderAvatar'>): ReactNode
  onPressAvatar?: (user: User) => void
  onLongPressAvatar?: (user: User) => void
}

export function Avatar<TMessage extends IMessage = IMessage> (
  props: AvatarProps<TMessage>
) {
  const {
    isAvatarOnTop,
    isAvatarVisibleForEveryMessage,
    containerStyle,
    position,
    currentMessage,
    renderAvatar,
    previousMessage,
    nextMessage,
    imageStyle,
    onPressAvatar,
    onLongPressAvatar,
  } = props

  const styles = useThemedStyles(createStyles)

  const messageToCompare = isAvatarOnTop ? previousMessage : nextMessage

  const renderAvatarComponent = useCallback(() => {
    if (renderAvatar)
      return renderAvatar({
        isAvatarOnTop,
        isAvatarVisibleForEveryMessage,
        containerStyle,
        position,
        currentMessage,
        previousMessage,
        nextMessage,
        imageStyle,
        onPressAvatar,
        onLongPressAvatar,
      })

    if (currentMessage)
      return (
        <ChatAvatar
          avatarStyle={[
            styles[position].image,
            imageStyle?.[position],
          ]}
          user={currentMessage.user}
          onPress={() => onPressAvatar?.(currentMessage.user)}
          onLongPress={() => onLongPressAvatar?.(currentMessage.user)}
        />
      )

    return null
  }, [
    renderAvatar,
    isAvatarOnTop,
    isAvatarVisibleForEveryMessage,
    containerStyle,
    position,
    currentMessage,
    previousMessage,
    nextMessage,
    imageStyle,
    onPressAvatar,
    onLongPressAvatar,
    styles,
  ])

  if (renderAvatar === null)
    return null

  if (
    !isAvatarVisibleForEveryMessage &&
    currentMessage &&
    messageToCompare &&
    isSameUser(currentMessage, messageToCompare) &&
    isSameDay(currentMessage, messageToCompare)
  )
    return (
      <View
        style={[
          styles[position].container,
          containerStyle?.[position],
        ]}
      >
        <ChatAvatar
          avatarStyle={[
            styles[position].image,
            imageStyle?.[position],
          ]}
        />
      </View>
    )

  return (
    <View
      style={[
        styles[position].container,
        isAvatarOnTop && styles[position].onTop,
        containerStyle?.[position],
      ]}
    >
      {renderAvatarComponent()}
    </View>
  )
}
