import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Animated as RNAnimated, Easing as RNEasing, Pressable, StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { Avatar } from '../Avatar'
import { Bubble } from '../Bubble'
import { useIsNoteGrown } from '../components/mediaPlayback'
import { HighlightOverlay, useMessageHighlightToken } from '../components/messageHighlight'
import { useMessageSelection } from '../components/messageSelection'
import { SELECTION_CHECKBOX_SIZE, SelectionCheckbox } from '../components/SelectionCheckbox'
import { useIsRTL } from '../hooks/useIsRTL'
import { useTheme } from '../hooks/useTheme'
import { IMessage } from '../Models'
import { mirrorPosition } from '../rtl'
import { getStyleWithPosition } from '../styles'
import { SystemMessage } from '../SystemMessage'
import { isSameGroup, renderComponentOrElement } from '../utils'
import styles from './styles'
import { SwipeToReplyRow } from './SwipeToReply'
import { MessageProps } from './types'

export * from './types'

// Selection mode: incoming rows slide 35dp aside for the
// check, which sits 8dp from the edge, 8dp above the bubble's bottom; ease-out in, ease-in out.
const SELECTION_SHIFT = 35
const SELECTION_CHECK_INSET = 8
const SELECTION_MS = 200
const SELECTION_EASE_OUT = RNEasing.bezier(0, 0, 0.58, 1)
const SELECTION_EASE_IN = RNEasing.bezier(0.42, 0, 1, 1)

/** The avatar fades out as fast as the note grows over it. */
const AVATAR_FADE_MS = 250

/**
 * The avatar beside a round note, faded out while that note is grown to play,
 * since the grown note covers it. The space stays,
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

  // The flash after jumping here from a reply quote.
  const highlightToken = useMessageHighlightToken(currentMessage?._id)

  // Multi-select: a tap anywhere on the row checks it, and its chrome (check, tint, the slide
  // aside) stays up until the exit animation has run.
  const selection = useMessageSelection(currentMessage?.system ? undefined : currentMessage?._id)
  const [isSelectionChromeShown, setIsSelectionChromeShown] = useState(selection.isActive)
  if (selection.isActive && !isSelectionChromeShown)
    setIsSelectionChromeShown(true)
  const [selectionProgress] = useState(() => new RNAnimated.Value(selection.isActive ? 1 : 0))
  useEffect(() => {
    if (!isSelectionChromeShown)
      return

    const isActive = selection.isActive
    const animation = RNAnimated.timing(selectionProgress, {
      toValue: isActive ? 1 : 0,
      duration: SELECTION_MS,
      easing: isActive ? SELECTION_EASE_OUT : SELECTION_EASE_IN,
      useNativeDriver: true,
    })
    animation.start(({ finished }) => {
      if (finished && !isActive)
        setIsSelectionChromeShown(false)
    })
    return () => animation.stop()
  }, [selection.isActive, isSelectionChromeShown, selectionProgress])

  // The check goes on the reading side; rows drawn on that side make room for it.
  const checkSide = isRTL ? 'right' : 'left'
  const isShiftedForCheck = visualPosition === checkSide
  const shiftStyle = useMemo(() => {
    if (!isSelectionChromeShown || !isShiftedForCheck)
      return null
    const direction = checkSide === 'left' ? 1 : -1
    return {
      transform: [{
        translateX: selectionProgress.interpolate({ inputRange: [0, 1], outputRange: [0, SELECTION_SHIFT * direction] }),
      }],
    }
  }, [isSelectionChromeShown, isShiftedForCheck, checkSide, selectionProgress])

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

  // 2pt inside a run of bubbles, 6pt between runs (same sender, within five minutes).
  const isGroupedWithNext = useMemo(() =>
    isSameGroup(currentMessage, nextMessage)
  , [currentMessage, nextMessage])

  const messageContent = useMemo(() => {
    if (currentMessage?.system)
      return renderSystemMessage()

    return (
      <RNAnimated.View
        style={[
          getStyleWithPosition(styles, 'container', visualPosition),
          { marginBottom: isGroupedWithNext ? theme.spacing.withinGroup : theme.spacing.betweenGroups },
          containerStyle?.[position],
          shiftStyle,
        ]}
      >
        {!!highlightToken && (
          <HighlightOverlay token={highlightToken} color={theme.colors.selectionBackground} opacity={1} />
        )}
        {visualPosition === 'left' && renderAvatar()}
        {renderBubble()}
        {visualPosition === 'right' && renderAvatar()}
      </RNAnimated.View>
    )
  }, [
    shiftStyle,
    currentMessage?.system,
    renderSystemMessage,
    position,
    visualPosition,
    isGroupedWithNext,
    theme,
    containerStyle,
    renderAvatar,
    renderBubble,
    highlightToken,
  ])

  if (!currentMessage)
    return null

  const bottomGap = isGroupedWithNext ? theme.spacing.withinGroup : theme.spacing.betweenGroups
  const selectionTint = isSelectionChromeShown && selection.isSelected
    ? <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.selectionBackground }]} pointerEvents='none' />
    : null
  const selectionChrome = isSelectionChromeShown
    ? (
      <>
        <RNAnimated.View
          pointerEvents='none'
          style={[
            selectionStyles.check,
            checkSide === 'left' ? selectionStyles.checkLeft : selectionStyles.checkRight,
            {
              bottom: bottomGap + SELECTION_CHECK_INSET,
              opacity: selectionProgress,
              transform: [{
                translateX: selectionProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [checkSide === 'left' ? -SELECTION_SHIFT : SELECTION_SHIFT, 0],
                }),
              }],
            },
          ]}
        >
          <SelectionCheckbox isChecked={selection.isSelected} />
        </RNAnimated.View>
        {/* Over the whole row, so a tap anywhere checks it and nothing in the bubble reacts. */}
        {selection.isActive && (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={selection.toggle}
            accessibilityRole='checkbox'
            accessibilityState={{ checked: selection.isSelected }}
            testID='message-select-toggle'
          />
        )}
      </>
    )
    : null

  // Don't wrap system messages in Swipeable.
  if (currentMessage.system || !isSwipeToReplyEnabled)
    return (
      <View onLayout={onMessageLayout}>
        {selectionTint}
        {messageContent}
        {selectionChrome}
      </View>
    )

  return (
    <View onLayout={onMessageLayout}>
      {selectionTint}
      <SwipeToReplyRow
        direction={swipeToReplyDirection}
        position={position}
        onReply={handleSwipeReply}
        renderAction={renderSwipeToReplyActionProp}
        actionContainerStyle={swipeToReplyActionContainerStyle}
        // A row being selected does not swipe.
        isEnabled={!selection.isActive}
      >
        {messageContent}
      </SwipeToReplyRow>
      {selectionChrome}
    </View>
  )
}

const selectionStyles = StyleSheet.create({
  check: {
    position: 'absolute',
    width: SELECTION_CHECKBOX_SIZE,
    height: SELECTION_CHECKBOX_SIZE,
  },
  checkLeft: {
    left: SELECTION_CHECK_INSET,
  },
  checkRight: {
    right: SELECTION_CHECK_INSET,
  },
})
