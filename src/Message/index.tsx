import React, { useCallback, useEffect, useMemo } from 'react'
import { View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { Avatar } from '../Avatar'
import { Bubble } from '../Bubble'
import { useIsNoteGrown } from '../components/mediaPlayback'
import { HighlightOverlay, useMessageHighlightToken } from '../components/messageHighlight'
import { useIsRTL } from '../hooks/useIsRTL'
import { useTheme } from '../hooks/useTheme'
import { IMessage } from '../Models'
import { mirrorPosition } from '../rtl'
import { getStyleWithPosition } from '../styles'
import { SystemMessage } from '../SystemMessage'
import { isSameUser, renderComponentOrElement } from '../utils'
import styles from './styles'
import { SwipeToReplyRow } from './SwipeToReply'
import { MessageProps } from './types'

export * from './types'

/** Telegram fades the avatar out as fast as the note grows over it. */
const AVATAR_FADE_MS = 250

/**
 * The avatar beside a round note, faded out while that note is grown to play,
 * as Telegram hides it (`isAvatarVisible && !isPlayingRound`). The space stays,
 * so the row does not move.
 */
const NoteAvatar = ({ messageId, children }: { messageId: string | number, children: React.ReactNode }) => {
  const isGrown = useIsNoteGrown(messageId)
  const opacity = useSharedValue(isGrown ? 0 : 1)
  useEffect(() => {
    opacity.value = withTiming(isGrown ? 0 : 1, { duration: AVATAR_FADE_MS })
  }, [isGrown, opacity])
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return <Animated.View style={style}>{children}</Animated.View>
}

export const Message = <TMessage extends IMessage = IMessage>(props: MessageProps<TMessage>) => {
  const {
    currentMessage,
    renderBubble: renderBubbleProp,
    renderSystemMessage: renderSystemMessageProp,
    onMessageLayout,
    nextMessage,
    position,
    containerStyle,
    user,
    isUserAvatarVisible,
    isAvatarVisible = true,
    swipeToReply,
  } = props

  // Extract swipe props
  const isSwipeToReplyEnabled = swipeToReply?.isEnabled ?? false
  const swipeToReplyDirection = swipeToReply?.direction ?? 'left'
  const onSwipeToReply = swipeToReply?.onSwipe
  const renderSwipeToReplyActionProp = swipeToReply?.renderAction
  const swipeToReplyActionContainerStyle = swipeToReply?.actionContainerStyle

  const theme = useTheme()
  const isRTL = useIsRTL()
  // Only for the row's own layout (which side the avatar/bubble render on) -
  // `containerStyle?.[position]` stays keyed by the real, unmirrored `position`
  // below, since that is "my message vs. theirs", not a physical screen side.
  const visualPosition = mirrorPosition(position, isRTL)

  // Telegram's flash after jumping here from a reply quote.
  const highlightToken = useMessageHighlightToken(currentMessage?._id)

  const renderBubble = useCallback(() => {
    const {
      /* eslint-disable @typescript-eslint/no-unused-vars */
      containerStyle,
      onMessageLayout,
      swipeToReply,
      /* eslint-enable @typescript-eslint/no-unused-vars */
      ...rest
    } = props

    if (renderBubbleProp)
      return renderComponentOrElement(renderBubbleProp, rest)

    return <Bubble {...rest} />
  }, [props, renderBubbleProp])

  const renderSystemMessage = useCallback(() => {
    const {
      /* eslint-disable @typescript-eslint/no-unused-vars */
      containerStyle,
      onMessageLayout,
      swipeToReply,
      /* eslint-enable @typescript-eslint/no-unused-vars */
      ...rest
    } = props

    if (renderSystemMessageProp)
      return renderComponentOrElement(renderSystemMessageProp, rest)

    return <SystemMessage {...rest} />
  }, [props, renderSystemMessageProp])

  const renderAvatar = useCallback(() => {
    if (!isAvatarVisible)
      return null

    if (
      user?._id &&
      currentMessage?.user &&
      user._id === currentMessage.user._id &&
      !isUserAvatarVisible
    )
      return null

    if (currentMessage?.user?.avatar === null)
      return null

    const {
      /* eslint-disable @typescript-eslint/no-unused-vars */
      containerStyle,
      onMessageLayout,
      swipeToReply,
      /* eslint-enable @typescript-eslint/no-unused-vars */
      ...rest
    } = props

    if (currentMessage?.videoNote && currentMessage._id != null)
      return <NoteAvatar messageId={currentMessage._id}><Avatar {...rest} /></NoteAvatar>

    return <Avatar {...rest} />
  }, [
    props,
    user,
    currentMessage,
    isUserAvatarVisible,
    isAvatarVisible,
  ])

  const handleSwipeReply = useCallback(() => {
    if (onSwipeToReply && currentMessage)
      onSwipeToReply(currentMessage)
  }, [onSwipeToReply, currentMessage])

  const sameUser = useMemo(() =>
    isSameUser(currentMessage, nextMessage!)
  , [currentMessage, nextMessage])

  const messageContent = useMemo(() => {
    if (currentMessage?.system)
      return renderSystemMessage()

    return (
      <View
        style={[
          getStyleWithPosition(styles, 'container', visualPosition),
          { marginBottom: sameUser ? theme.spacing.withinGroup : theme.spacing.betweenGroups },
          containerStyle?.[position],
        ]}
      >
        {!!highlightToken && (
          <HighlightOverlay token={highlightToken} color={theme.colors.accent} />
        )}
        {visualPosition === 'left' && renderAvatar()}
        {renderBubble()}
        {visualPosition === 'right' && renderAvatar()}
      </View>
    )
  }, [
    currentMessage?.system,
    renderSystemMessage,
    position,
    visualPosition,
    sameUser,
    theme,
    containerStyle,
    renderAvatar,
    renderBubble,
    highlightToken,
  ])

  if (!currentMessage)
    return null

  // Don't wrap system messages in Swipeable
  if (currentMessage.system || !isSwipeToReplyEnabled)
    return (
      <View onLayout={onMessageLayout}>
        {messageContent}
      </View>
    )

  return (
    <View onLayout={onMessageLayout}>
      <SwipeToReplyRow
        direction={swipeToReplyDirection}
        position={position}
        onReply={handleSwipeReply}
        renderAction={renderSwipeToReplyActionProp}
        actionContainerStyle={swipeToReplyActionContainerStyle}
      >
        {messageContent}
      </SwipeToReplyRow>
    </View>
  )
}
