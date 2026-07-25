import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  View,
  Pressable,
  StyleSheet,
  TextStyle,
  Text } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { useChatContext } from '../ChatContext'
import { ContextMenu } from '../components/ContextMenu'
import { Icon } from '../components/Icon'
import { MessageReply } from '../components/MessageReply'
import { PendingClock, Ticks } from '../components/Ticks'
import { useTheme, useThemedStyles } from '../hooks/useTheme'
import { MessageAudio } from '../MessageAudio'
import { MessageImage } from '../MessageImage'
import { MessageLocation } from '../MessageLocation'
import { MessageText } from '../MessageText'
import { MessageVideo } from '../MessageVideo'
import { IMessage } from '../Models'
import { QuickReplies } from '../QuickReplies'
import { DEFAULT_REACTION_EMOJIS, MessageReactions, ReactionPicker } from '../Reactions'
import { getStyleWithPosition } from '../styles'
import { Time } from '../Time'
import { isSameUser, isSameDay, renderComponentOrElement } from '../utils'
import { createBubbleStyles } from './styles'
import { BubbleProps, RenderMessageTextProps } from './types'

export * from './types'

interface PickerAnchor {
  pageX: number
  pageY: number
  bubbleWidth: number
  bubbleHeight: number
}

const SCALE_PRESSED = 0.85
const SCALE_DURATION_IN = 400
const SCALE_DURATION_OUT = 200
const SCALE_EASING = Easing.inOut(Easing.quad)

export const Bubble = <TMessage extends IMessage = IMessage>(props: BubbleProps<TMessage>): React.ReactElement => {
  const {
    currentMessage,
    nextMessage,
    position,
    containerToNextStyle,
    previousMessage,
    containerToPreviousStyle,
    onQuickReply,
    renderQuickReplySend,
    quickReplyStyle,
    quickReplyTextStyle,
    quickReplyContainerStyle,
    containerStyle,
    wrapperStyle,
    bottomContainerStyle,
    onPressMessage: onPressMessageProp,
    onLongPressMessage: onLongPressMessageProp,
    reactions,
    messageActions,
    isMessageGestureEnabled = true,
  } = props

  const context = useChatContext()
  const theme = useTheme()
  const styles = useThemedStyles(createBubbleStyles)

  // Resolve the long-press context-menu actions for this message.
  const menuItems = useMemo(() => {
    if (!messageActions || !currentMessage)
      return []

    return typeof messageActions === 'function' ? messageActions(currentMessage) : messageActions
  }, [messageActions, currentMessage])
  const hasMenu = menuItems.length > 0

  // Consumers can hand the touches back to natively interactive content
  // (video controls, maps, WebViews) on a per-message basis.
  const isGestureEnabled = useMemo(() => {
    if (typeof isMessageGestureEnabled === 'function')
      return currentMessage ? isMessageGestureEnabled(currentMessage) : true

    return isMessageGestureEnabled
  }, [isMessageGestureEnabled, currentMessage])

  const bubbleContainerRef = useRef<View>(null)

  const [isPickerVisible, setIsPickerVisible] = useState(false)
  const [pickerAnchor, setPickerAnchor] = useState<PickerAnchor>({
    pageX: 0,
    pageY: 0,
    bubbleWidth: 0,
    bubbleHeight: 0,
  })

  // Scale shared value is declared unconditionally so hooks order stays stable
  // whether or not reactions are enabled.
  const messageScale = useSharedValue(1)

  const bubbleScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: messageScale.value }],
  }))

  const onPress = useCallback(() => {
    onPressMessageProp?.(context, currentMessage)
  }, [onPressMessageProp, context, currentMessage])

  const onLongPress = useCallback(() => {
    onLongPressMessageProp?.(context, currentMessage)
  }, [
    currentMessage,
    context,
    onLongPressMessageProp,
  ])

  const measureBubble = useCallback(() => {
    bubbleContainerRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
      setPickerAnchor({ pageX, pageY, bubbleWidth: width, bubbleHeight: height })
    })
  }, [])

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        // Keep native subviews (video controls, maps, native buttons) receiving
        // touches. iOS cancels them by default the moment this recognizer wins.
        .cancelsTouchesInView(false)
        .runOnJS(true)
        .onEnd((_e, success) => {
          if (success)
            onPressMessageProp?.(context, currentMessage)
        }),
    [onPressMessageProp, context, currentMessage]
  )

  const longPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .cancelsTouchesInView(false)
        .onBegin(() => {
          messageScale.value = withTiming(SCALE_PRESSED, {
            duration: SCALE_DURATION_IN,
            easing: SCALE_EASING,
            reduceMotion: ReduceMotion.System,
          })
          runOnJS(measureBubble)()
        })
        .onStart(() => {
          runOnJS(setIsPickerVisible)(true)
        })
        .onFinalize(() => {
          messageScale.value = withTiming(1, {
            duration: SCALE_DURATION_OUT,
            easing: SCALE_EASING,
            reduceMotion: ReduceMotion.System,
          })
        }),
    [messageScale, measureBubble]
  )

  // Exclusive composition: a long-press wins over the tap when held long
  // enough; a quick lift lets the tap through. Both share the onBegin/onFinalize
  // scale animation because onBegin always fires before either gesture wins.
  // The tap is only attached when there is something to call - otherwise it
  // would compete with interactive content inside the bubble for no reason.
  const reactionsGesture = useMemo(
    () => onPressMessageProp
      ? Gesture.Exclusive(longPressGesture, tapGesture)
      : longPressGesture,
    [longPressGesture, tapGesture, onPressMessageProp]
  )

  const styledBubbleToNext = useMemo(() => {
    if (
      currentMessage &&
      nextMessage &&
      position &&
      isSameUser(currentMessage, nextMessage) &&
      isSameDay(currentMessage, nextMessage)
    )
      return [
        getStyleWithPosition(styles, 'containerToNext', position),
        containerToNextStyle?.[position],
      ]

    return null
  }, [
    currentMessage,
    nextMessage,
    position,
    containerToNextStyle,
    styles,
  ])

  const styledBubbleToPrevious = useMemo(() => {
    if (
      currentMessage &&
      previousMessage &&
      position &&
      isSameUser(currentMessage, previousMessage) &&
      isSameDay(currentMessage, previousMessage)
    )
      return [
        getStyleWithPosition(styles, 'containerToPrevious', position),
        containerToPreviousStyle?.[position],
      ]

    return null
  }, [
    currentMessage,
    previousMessage,
    position,
    containerToPreviousStyle,
    styles,
  ])

  const renderQuickReplies = useCallback(() => {
    if (currentMessage?.quickReplies) {
      const {
        /* eslint-disable @typescript-eslint/no-unused-vars */
        containerStyle,
        wrapperStyle,
        /* eslint-enable @typescript-eslint/no-unused-vars */
        ...quickReplyProps
      } = props

      if (props.renderQuickReplies)
        return renderComponentOrElement(props.renderQuickReplies, quickReplyProps)

      return (
        <QuickReplies
          currentMessage={currentMessage}
          onQuickReply={onQuickReply}
          renderQuickReplySend={renderQuickReplySend}
          quickReplyStyle={quickReplyStyle}
          quickReplyTextStyle={quickReplyTextStyle}
          quickReplyContainerStyle={quickReplyContainerStyle}
          nextMessage={nextMessage}
        />
      )
    }

    return null
  }, [
    currentMessage,
    onQuickReply,
    renderQuickReplySend,
    quickReplyStyle,
    quickReplyTextStyle,
    quickReplyContainerStyle,
    nextMessage,
    props,
  ])

  const renderMessageText = useCallback(() => {
    if (currentMessage?.text) {
      const {
        /* eslint-disable @typescript-eslint/no-unused-vars */
        containerStyle,
        wrapperStyle,
        messageTextProps,
        /* eslint-enable @typescript-eslint/no-unused-vars */
        ...messageTextPropsRest
      } = props

      const combinedProps = {
        ...messageTextPropsRest,
        ...messageTextProps,
      } as RenderMessageTextProps<TMessage>

      if (props.renderMessageText)
        return renderComponentOrElement(props.renderMessageText, combinedProps)

      return <MessageText {...combinedProps as any} />
    }

    return null
  }, [props, currentMessage])

  const renderMessageImage = useCallback(() => {
    if (currentMessage?.image) {
      const {
        /* eslint-disable @typescript-eslint/no-unused-vars */
        containerStyle,
        wrapperStyle,
        /* eslint-enable @typescript-eslint/no-unused-vars */
        ...messageImageProps
      } = props

      if (props.renderMessageImage)
        return renderComponentOrElement(props.renderMessageImage, messageImageProps)

      return <MessageImage {...messageImageProps} />
    }

    return null
  }, [props, currentMessage])

  const renderMessageVideo = useCallback(() => {
    if (!currentMessage?.video)
      return null

    const {
      /* eslint-disable @typescript-eslint/no-unused-vars */
      containerStyle,
      wrapperStyle,
      /* eslint-enable @typescript-eslint/no-unused-vars */
      ...messageVideoProps
    } = props

    if (props.renderMessageVideo)
      return renderComponentOrElement(props.renderMessageVideo, messageVideoProps)

    return <MessageVideo {...messageVideoProps} />
  }, [props, currentMessage])

  const renderMessageAudio = useCallback(() => {
    if (!currentMessage?.audio)
      return null

    const {
      /* eslint-disable @typescript-eslint/no-unused-vars */
      containerStyle,
      wrapperStyle,
      /* eslint-enable @typescript-eslint/no-unused-vars */
      ...messageAudioProps
    } = props

    if (props.renderMessageAudio)
      return renderComponentOrElement(props.renderMessageAudio, messageAudioProps)

    return <MessageAudio {...messageAudioProps} />
  }, [props, currentMessage])

  const renderMessageLocation = useCallback(() => {
    if (!currentMessage?.location)
      return null

    const {
      /* eslint-disable @typescript-eslint/no-unused-vars */
      containerStyle,
      wrapperStyle,
      /* eslint-enable @typescript-eslint/no-unused-vars */
      ...messageLocationProps
    } = props

    if (props.renderMessageLocation)
      return renderComponentOrElement(props.renderMessageLocation, messageLocationProps)

    return <MessageLocation {...messageLocationProps} />
  }, [props, currentMessage])

  const renderTicks = useCallback(() => {
    const {
      renderTicks,
      user,
    } = props

    if (renderTicks && currentMessage)
      return renderComponentOrElement(renderTicks, currentMessage)

    if (
      user &&
      currentMessage?.user &&
      currentMessage.user._id !== user._id
    )
      return null

    if (
      currentMessage &&
      (currentMessage.sent || currentMessage.received || currentMessage.pending)
    ) {
      // Allow a color override via the (legacy) tickStyle prop.
      const overrideColor = (StyleSheet.flatten(props.tickStyle) as TextStyle | undefined)?.color as
        | string
        | undefined
      const sentColor = overrideColor ?? (position === 'right' ? theme.colors.ticksSent : theme.colors.incomingMeta)
      const readColor = overrideColor ?? (position === 'right' ? theme.colors.ticksRead : theme.colors.accent)

      return (
        <View style={styles.messageStatusContainer}>
          {currentMessage.pending
            ? <Icon name='clock' color={sentColor} size={11} fallback={<PendingClock color={sentColor} />} />
            : currentMessage.received
              ? <Icon name='checkAll' color={readColor} size={14} fallback={<Ticks double color={readColor} />} />
              : currentMessage.sent
                ? <Icon name='check' color={sentColor} size={14} fallback={<Ticks color={sentColor} />} />
                : null}
        </View>
      )
    }

    return null
  }, [
    props,
    currentMessage,
    position,
    theme,
    styles,
  ])

  const renderTime = useCallback(() => {
    if (currentMessage?.createdAt) {
      const {
        /* eslint-disable @typescript-eslint/no-unused-vars */
        containerStyle,
        wrapperStyle,
        textStyle,
        /* eslint-enable @typescript-eslint/no-unused-vars */
        ...timeProps
      } = props

      if (props.renderTime)
        return renderComponentOrElement(props.renderTime, timeProps)

      return <Time {...timeProps} />
    }

    return null
  }, [props, currentMessage])

  const renderUsername = useCallback(() => {
    const {
      user,
      renderUsername,
    } = props

    if (props.isUsernameVisible && currentMessage) {
      if (user && currentMessage.user._id === user._id)
        return null

      if (renderUsername)
        return renderComponentOrElement(renderUsername, currentMessage.user)

      return (
        <View style={styles.usernameContainer}>
          <Text
            style={[styles.username, props.usernameStyle]}
          >
            {currentMessage.user.name}
          </Text>
        </View>
      )
    }

    return null
  }, [
    currentMessage,
    props,
    styles,
  ])

  const renderCustomView = useCallback(() => {
    if (props.renderCustomView)
      return renderComponentOrElement(props.renderCustomView, props)

    return null
  }, [props])

  const renderMessageReply = useCallback(() => {
    if (!currentMessage?.replyMessage)
      return null

    const { messageReply } = props

    const messageReplyProps = {
      replyMessage: currentMessage.replyMessage,
      currentMessage,
      position,
      onPress: messageReply?.onPress,
      containerStyle: position === 'left'
        ? messageReply?.containerStyleLeft ?? messageReply?.containerStyle
        : messageReply?.containerStyleRight ?? messageReply?.containerStyle,
      textStyle: position === 'left'
        ? messageReply?.textStyleLeft ?? messageReply?.textStyle
        : messageReply?.textStyleRight ?? messageReply?.textStyle,
      imageStyle: messageReply?.imageStyle,
    }

    if (messageReply?.renderMessageReply)
      return renderComponentOrElement(messageReply.renderMessageReply, messageReplyProps)

    return <MessageReply {...messageReplyProps} />
  }, [
    props,
    currentMessage,
    position,
  ])

  const renderBubbleContent = useCallback(() => {
    return (
      <>
        {!props.isCustomViewBottom && renderCustomView()}
        {renderMessageReply()}
        {renderMessageImage()}
        {renderMessageVideo()}
        {renderMessageAudio()}
        {renderMessageLocation()}
        {renderMessageText()}
        {props.isCustomViewBottom && renderCustomView()}
      </>
    )
  }, [
    renderMessageReply,
    renderCustomView,
    renderMessageImage,
    renderMessageVideo,
    renderMessageAudio,
    renderMessageLocation,
    renderMessageText,
    props.isCustomViewBottom,
  ])

  const renderBubbleBody = useCallback(() => (
    <>
      {renderUsername()}
      {renderBubbleContent()}
      <View
        style={[
          styles.bottom,
          bottomContainerStyle?.[position],
        ]}
      >
        <View style={styles.messageTimeAndStatusContainer}>
          {renderTime()}
          {renderTicks()}
        </View>
      </View>
    </>
  ), [
    position,
    bottomContainerStyle,
    renderBubbleContent,
    renderUsername,
    renderTime,
    renderTicks,
    styles,
  ])

  // A pure video note (round video, no text) drops the bubble background so the
  // circle floats like in Telegram.
  const isVideoNote = !!currentMessage?.videoNote && !!currentMessage?.video && !currentMessage?.text

  const wrapperStyleList = useMemo(() => [
    getStyleWithPosition(styles, 'wrapper', position),
    styledBubbleToNext,
    styledBubbleToPrevious,
    wrapperStyle?.[position],
    isVideoNote && styles.noteWrapper,
  ], [position, styledBubbleToNext, styledBubbleToPrevious, wrapperStyle, styles, isVideoNote])

  const containerStyleList = useMemo(() => [
    getStyleWithPosition(styles, 'container', position),
    containerStyle?.[position],
  ], [styles, position, containerStyle])

  const rowSurfaceStyle = useMemo(
    () => getStyleWithPosition(styles, 'rowSurface', position),
    [styles, position]
  )

  const renderReactionsDisplay = useCallback(() => {
    const currentReactions = currentMessage?.reactions
    if (!currentReactions || currentReactions.length === 0)
      return null

    const displayProps = {
      message: currentMessage,
      reactions: currentReactions,
      currentUserId: props.user?._id,
      position,
      onReactionPress: (emoji: string) => reactions?.onReactionPress?.(currentMessage, emoji),
      containerStyle: reactions?.containerStyle,
      reactionStyle: reactions?.reactionStyle,
      reactionActiveStyle: reactions?.reactionActiveStyle,
      reactionTextStyle: reactions?.reactionTextStyle,
      reactionCountStyle: reactions?.reactionCountStyle,
    }

    if (reactions?.renderReactions)
      return renderComponentOrElement(reactions.renderReactions, displayProps)

    return <MessageReactions {...displayProps} />
  }, [currentMessage, position, props.user, reactions])

  const renderReactionPickerModal = useCallback(() => {
    if (!reactions?.isEnabled)
      return null

    const emojis = reactions.emojis ?? DEFAULT_REACTION_EMOJIS

    const pickerProps = {
      visible: isPickerVisible,
      message: currentMessage,
      emojis,
      onSelect: (emoji: string) => reactions?.onReactionPress?.(currentMessage, emoji),
      onDismiss: () => setIsPickerVisible(false),
      position,
      ...pickerAnchor,
      pickerContainerStyle: reactions.pickerContainerStyle,
      pickerEmojiStyle: reactions.pickerEmojiStyle,
    }

    if (reactions.renderReactionPicker)
      return renderComponentOrElement(reactions.renderReactionPicker, pickerProps)

    return <ReactionPicker {...pickerProps} />
  }, [reactions, isPickerVisible, currentMessage, position, pickerAnchor])

  const renderContextMenu = useCallback(() => {
    const reactionsRow = reactions?.isEnabled
      ? {
        emojis: reactions.emojis ?? DEFAULT_REACTION_EMOJIS,
        onSelect: (emoji: string) => reactions?.onReactionPress?.(currentMessage, emoji),
      }
      : undefined

    return (
      <ContextMenu
        visible={isPickerVisible}
        items={menuItems}
        onDismiss={() => setIsPickerVisible(false)}
        position={position}
        {...pickerAnchor}
        reactions={reactionsRow}
      />
    )
  }, [reactions, menuItems, isPickerVisible, position, pickerAnchor, currentMessage])

  // Overlay path: a long-press opens either the Telegram-style context menu
  // (when messageActions are provided, optionally with a reactions row) or the
  // reactions quick-picker. The Animated.View carries only the scale transform.
  if (reactions?.isEnabled || hasMenu) {
    // `rowSurface` spans the whole message row, so a long-press in the empty
    // space beside the bubble opens the picker too - the way Telegram behaves.
    const bubbleRow = (
      <View style={rowSurfaceStyle}>
        <Animated.View style={bubbleScaleStyle}>
          <View style={wrapperStyleList} ref={bubbleContainerRef}>
            {renderBubbleBody()}
          </View>
        </Animated.View>
      </View>
    )

    return (
      <Animated.View style={containerStyleList}>
        {isGestureEnabled
          ? (
            <GestureDetector gesture={reactionsGesture}>
              {bubbleRow}
            </GestureDetector>
          )
          : (
            // Gestures are off for this message, so the surface drops *behind*
            // the bubble: the bubble's own content (native video controls, a
            // map, a WebView) keeps every touch that lands on it, while the rest
            // of the row still opens the picker.
            <>
              <GestureDetector gesture={reactionsGesture}>
                <View style={StyleSheet.absoluteFill} />
              </GestureDetector>
              {bubbleRow}
            </>
          )}
        {renderQuickReplies()}
        {renderReactionsDisplay()}
        {hasMenu ? renderContextMenu() : renderReactionPickerModal()}
      </Animated.View>
    )
  }

  // Default path: unchanged behaviour for existing users, preserving
  // touchableProps, native press feedback, and the onLongPressMessage callback.
  return (
    <View style={containerStyleList}>
      <View style={wrapperStyleList}>
        {isGestureEnabled
          ? (
            <Pressable
              onPress={onPress}
              onLongPress={onLongPress}
              {...props.touchableProps}
            >
              {renderBubbleBody()}
            </Pressable>
          )
          : renderBubbleBody()}
      </View>
      {renderQuickReplies()}
    </View>
  )
}
