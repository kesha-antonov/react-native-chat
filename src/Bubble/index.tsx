import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ImageStyle,
  Keyboard,
  LayoutChangeEvent,
  View,
  Pressable,
  StyleProp,
  StyleSheet,
  TextStyle,
  Text,
  ViewStyle,
  useWindowDimensions } from 'react-native'
import { GestureDetector, useExclusiveGestures, useLongPressGesture, useTapGesture } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

import { useChatContext } from '../ChatContext'
import { BubbleTail, GradientBubbleBackground } from '../components/BubbleBackground'
import { ContextMenu } from '../components/ContextMenu'
import { impactHaptic } from '../components/haptics'
import { MediaPlaybackContext, useNoteTimeShift } from '../components/mediaPlayback'
import { BubbleHighlightTint, useMessageHighlightToken } from '../components/messageHighlight'
import { PRESS_DELAY_MS, PRESS_HOLD_MS, PRESS_RELEASE_MS, PRESS_SHRINK_MS } from '../components/messagePress'
import { MessageReply } from '../components/MessageReply'
import { MessageStatus, MessageStatusKind } from '../components/MessageStatus'
import { NOTE_GROW_MS, noteGrowEasing } from '../components/roundNoteChrome'
import { TIME_FORMAT } from '../Constant'
import { useIsRTL } from '../hooks/useIsRTL'
import { useLabels } from '../hooks/useLabels'
import { useTheme, useThemedStyles } from '../hooks/useTheme'
import { MessageAudio } from '../MessageAudio'
import { MessageImage } from '../MessageImage'
import { MessageLocation } from '../MessageLocation'
import { MessageText } from '../MessageText'
import { MessageVideo } from '../MessageVideo'
import { IMessage, LeftRightStyle } from '../Models'
import { QuickReplies } from '../QuickReplies'
import { DEFAULT_REACTION_EMOJIS, MessageReactions, ReactionPicker } from '../Reactions'
import { mirrorPosition } from '../rtl'
import { getStyleWithPosition } from '../styles'
import { getNameColor } from '../Theme'
import { formatMessageTime, Time } from '../Time'
import { isSameGroup, renderComponentOrElement } from '../utils'
import { createBubbleStyles } from './styles'
import { BubbleProps, RenderMessageTextProps } from './types'

export * from './types'

const hiddenStyle: ViewStyle = { opacity: 0 }

interface PickerAnchor {
  pageX: number
  pageY: number
  bubbleWidth: number
  bubbleHeight: number
}

// CA's easeOut.
const PRESS_RELEASE_EASING = Easing.bezier(0, 0, 0.58, 1)

// A lifted copy must not undo the original's margins: the overlay places it by
// the measured bubble box, which excludes them.
const LIFTED_RESET: ViewStyle = {
  margin: 0,
  marginTop: 0,
  marginBottom: 0,
  marginLeft: 0,
  marginRight: 0,
  marginStart: 0,
  marginEnd: 0,
  marginHorizontal: 0,
  marginVertical: 0,
}

/**
 * The copy of a bubble that the long-press overlay draws above its backdrop.
 * While it is mounted the original is hidden, so the message seems to lift out
 * of the list and land back in it - and a custom picker that never renders the
 * copy leaves the original alone. It sits outside the media playback context:
 * a second player must not register in the playlist under the same message id
 * and unregister the real one when the overlay closes.
 */
const LiftedBubble = ({
  onLiftChange,
  onRemeasure,
  style,
  children,
}: {
  onLiftChange: (isLifted: boolean) => void
  onRemeasure: () => void
  style: StyleProp<ViewStyle>
  children: React.ReactNode
}) => {
  // Presenting the overlay's Modal dismisses the keyboard (and iOS brings it
  // back when the Modal goes), so the list moves under the copy. Follow the
  // original, so the copy flies back to where it really is.
  useEffect(() => {
    const subscriptions = [
      Keyboard.addListener('keyboardDidHide', onRemeasure),
      Keyboard.addListener('keyboardDidShow', onRemeasure),
    ]
    return () => subscriptions.forEach(subscription => subscription.remove())
  }, [onRemeasure])

  useEffect(() => {
    // The Modal holding this copy reaches the screen a frame or two after it
    // mounts; hiding the original right away would blink the message out.
    // Waiting is invisible, since the copy opens exactly over the original.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => onLiftChange(true))
    })
    return () => {
      cancelAnimationFrame(frame)
      onLiftChange(false)
    }
  }, [onLiftChange])

  return (
    <MediaPlaybackContext.Provider value={null}>
      <View style={style}>
        {children}
      </View>
    </MediaPlaybackContext.Provider>
  )
}

export type PressableBubbleRowProps<TMessage extends IMessage> = {
  isGestureEnabled: boolean
  /** The overlay is showing a lifted copy, so the original is hidden. */
  isLifted?: boolean
  onPressMessage?: (context: unknown, message: TMessage) => void
  onLongPressStart: () => void
  measureBubble: () => void
  context: unknown
  currentMessage: TMessage
  rowSurfaceStyle: StyleProp<ViewStyle>
  wrapperStyleList: StyleProp<ViewStyle>
  bubbleContainerRef: React.RefObject<React.ComponentRef<typeof View> | null>
  children: React.ReactNode
}

/**
 * The message row as it behaves when a long-press can open something - the reactions picker or the
 * context menu. It owns the press-scale shared value, the animated style over it and the gesture
 * composition, so none of that exists on a row that has neither feature enabled.
 *
 * Those hooks used to sit in `Bubble` itself, where they had to run unconditionally to keep hook
 * order stable, even though the `Animated.View` reading them only renders on this path. That put a
 * shared value and a UI-thread worklet on every message in the conversation for a scale animation
 * most of them could never play.
 */
const PressableBubbleRow = <TMessage extends IMessage>({
  isGestureEnabled,
  isLifted = false,
  onPressMessage,
  onLongPressStart,
  measureBubble,
  context,
  currentMessage,
  rowSurfaceStyle,
  wrapperStyleList,
  bubbleContainerRef,
  children,
}: PressableBubbleRowProps<TMessage>) => {
  const messageScale = useSharedValue(1)
  const bubbleWidth = useSharedValue(0)
  const onBubbleLayout = useCallback((event: LayoutChangeEvent) => {
    bubbleWidth.value = event.nativeEvent.layout.width
  }, [bubbleWidth])

  const bubbleScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: messageScale.value }],
  }))

  const tapGesture = useTapGesture({
    // Only attached when there is something to call - otherwise it would
    // compete with interactive content inside the bubble for no reason.
    enabled: !!onPressMessage,
    // Keep native subviews (video controls, maps, native buttons) receiving
    // touches. iOS cancels them by default the moment this recognizer wins.
    cancelsTouchesInView: false,
    runOnJS: true,
    onDeactivate: event => {
      if (!event.canceled)
        onPressMessage?.(context, currentMessage)
    },
  })

  const longPressGesture = useLongPressGesture({
    testID: 'message-long-press',
    minDuration: PRESS_HOLD_MS,
    cancelsTouchesInView: false,
    onBegin: () => {
      const width = bubbleWidth.value
      const pressed = width > 0 ? Math.max(0.7, (width - 15) / width) : 1
      messageScale.value = withDelay(
        PRESS_DELAY_MS,
        withTiming(pressed, { duration: PRESS_SHRINK_MS, easing: Easing.linear, reduceMotion: ReduceMotion.System }),
        ReduceMotion.System
      )
      runOnJS(measureBubble)()
    },
    onActivate: () => {
      runOnJS(onLongPressStart)()
    },
    onFinalize: () => {
      messageScale.value = withTiming(1, {
        duration: PRESS_RELEASE_MS,
        easing: PRESS_RELEASE_EASING,
        reduceMotion: ReduceMotion.System,
      })
    },
  })

  // Exclusive composition: a long-press wins over the tap when held long
  // enough; a quick lift lets the tap through. Both share the onBegin/onFinalize
  // scale animation because onBegin always fires before either gesture wins.
  const gesture = useExclusiveGestures(longPressGesture, tapGesture)

  // `rowSurface` spans the whole message row, so a long-press in the empty
  // space beside the bubble opens the picker too - the way Telegram behaves.
  const bubbleRow = (
    <View style={rowSurfaceStyle}>
      <Animated.View style={[bubbleScaleStyle, isLifted && hiddenStyle]}>
        <View style={wrapperStyleList} ref={bubbleContainerRef} onLayout={onBubbleLayout}>
          {children}
        </View>
      </Animated.View>
    </View>
  )

  if (isGestureEnabled)
    return (
      <GestureDetector gesture={gesture}>
        {bubbleRow}
      </GestureDetector>
    )

  // Gestures are off for this message, so the surface drops *behind*
  // the bubble: the bubble's own content (native video controls, a
  // map, a WebView) keeps every touch that lands on it, while the rest
  // of the row still opens the picker.
  return (
    <>
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill} />
      </GestureDetector>
      {bubbleRow}
    </>
  )
}


// Telegram's time is `timeWidth + 6dp` wide on the last line, and `+ 20.5dp` with the checks
// (`ChatMessageCell:7411`). The reserved copy of the time is padded with no-break spaces to
// that width: two for the gap, nine with the checks.
const NBSP = ' '
const GAP_SPACES = NBSP.repeat(2)
const STATUS_SPACES = NBSP.repeat(9)
// A break opportunity before the reserved time, so it wraps alone instead of taking the last word.
const ZERO_WIDTH_SPACE = '​'

// First strong character decides a paragraph's direction (Hebrew, Arabic and friends are RTL).
const RTL_CHAR = /[֐-ࣿיִ-﷿ﹰ-﻿]/
const LTR_CHAR = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ԰-֏ऀ-෿฀-࿿ᄀ-ᇿ぀-ヿ㐀-鿿가-힯]/
const isTextRTL = (text: string) => {
  for (const char of text) {
    if (RTL_CHAR.test(char))
      return true
    if (LTR_CHAR.test(char))
      return false
  }
  return false
}

type MetaMode = 'inline' | 'reactions' | 'overlay' | 'row' | 'voice' | 'note'

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
  const labels = useLabels()
  const styles = useThemedStyles(createBubbleStyles)
  const isRTL = useIsRTL()
  const windowSize = useWindowDimensions()
  // Only for physical layout (alignment, corner radii) - `wrapper`'s background
  // color and every `xStyle?.[position]` consumer override below stay keyed by
  // the real, unmirrored `position` ("my bubble vs. theirs"), not screen side.
  const visualPosition = mirrorPosition(position, isRTL)

  // Resolve the long-press context-menu actions for this message.
  const menuItems = useMemo(() => {
    if (!messageActions || !currentMessage)
      return []

    return typeof messageActions === 'function' ? messageActions(currentMessage) : messageActions
  }, [messageActions, currentMessage])
  const hasMenu = menuItems.length > 0

  // A pure video note (round video, no text) drops the bubble background so the
  // circle floats like in Telegram. Its meta row then has no bubble to sit on,
  // so it moves into a translucent pill over the circle instead.
  const isVideoNote = !!currentMessage?.videoNote && !!currentMessage?.video && !currentMessage?.text

  // A round note that grows to play moves its right edge; the sent time rides
  // along at the circle's bottom-right, on the grow's own timing.
  const noteTimeShift = useNoteTimeShift(isVideoNote ? currentMessage?._id : undefined)
  const noteTimeShiftSV = useSharedValue(noteTimeShift)
  useEffect(() => {
    noteTimeShiftSV.value = withTiming(noteTimeShift, { duration: NOTE_GROW_MS, easing: noteGrowEasing })
  }, [noteTimeShift, noteTimeShiftSV])
  const noteTimeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: noteTimeShiftSV.value }],
  }))

  // A bare voice note keeps its time on the duration's line, at the bubble's
  // bottom-right, as Telegram draws it, rather than on a row of its own under
  // the player. Only the built-in player leaves room for it there.
  const isVoiceNote = !!currentMessage?.audio && !currentMessage?.text && !isVideoNote &&
    !currentMessage?.image && !currentMessage?.video && !currentMessage?.location &&
    !props.renderMessageAudio

  // Telegram's runs: the same sender within five minutes. A run shares one tail, one name.
  const isGroupedWithPrevious = isSameGroup(currentMessage, previousMessage)
  const isGroupedWithNext = isSameGroup(currentMessage, nextMessage)

  // Photos, videos and maps without a caption are media bubbles: Telegram draws them with all
  // four corners rounded and no tail (`TYPE_MEDIA`).
  const isMediaBubble = !currentMessage?.text &&
    (!!currentMessage?.image || !!currentMessage?.video || !!currentMessage?.location)
  const hasTail = theme.bubble.hasTail && !isGroupedWithNext && !isVideoNote && !isMediaBubble

  // Consumers can hand the touches back to natively interactive content
  // (video controls, maps, WebViews) on a per-message basis.
  const isGestureEnabled = useMemo(() => {
    if (typeof isMessageGestureEnabled === 'function')
      return currentMessage ? isMessageGestureEnabled(currentMessage) : true

    return isMessageGestureEnabled
  }, [isMessageGestureEnabled, currentMessage])

  const bubbleContainerRef = useRef<React.ComponentRef<typeof View>>(null)

  const [isPickerVisible, setIsPickerVisible] = useState(false)
  const [pickerAnchor, setPickerAnchor] = useState<PickerAnchor>({
    pageX: 0,
    pageY: 0,
    bubbleWidth: 0,
    bubbleHeight: 0,
  })

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

  // True while the overlay shows the lifted copy - through its exit animation
  // too, which outlasts `isPickerVisible`.
  const [isLifted, setIsLifted] = useState(false)

  const openPicker = useCallback(() => {
    // Telegram Android's long-press tick, `HapticFeedbackConstants.LONG_PRESS`
    // (`RecyclerListView`'s item long-click), mapped to a medium impact.
    impactHaptic('Medium')
    setIsPickerVisible(true)
  }, [])

  const closePicker = useCallback(() => {
    setIsPickerVisible(false)
  }, [])

  const measureBubble = useCallback(() => {
    bubbleContainerRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
      setPickerAnchor({ pageX, pageY, bubbleWidth: width, bubbleHeight: height })
    })
  }, [])

  // The flash after a quote jump tints the bubble too, not just the row behind it.
  const highlightToken = useMessageHighlightToken(currentMessage?._id)

  // Telegram's corners (`MessageDrawable.generatePath`): 17 everywhere, 6 on the tail side
  // facing a grouped neighbour, and none at the bottom where the tail grows out.
  const cornerStyle = useMemo((): ViewStyle => {
    const outer = theme.radii.bubble
    const near = theme.radii.bubbleGrouped
    const top = isGroupedWithPrevious ? near : outer
    const bottom = hasTail ? 0 : (isGroupedWithNext ? near : outer)

    return visualPosition === 'right'
      ? { borderTopLeftRadius: outer, borderBottomLeftRadius: outer, borderTopRightRadius: top, borderBottomRightRadius: bottom }
      : { borderTopRightRadius: outer, borderBottomRightRadius: outer, borderTopLeftRadius: top, borderBottomLeftRadius: bottom }
  }, [theme, isGroupedWithPrevious, isGroupedWithNext, hasTail, visualPosition])

  const styledBubbleToNext = useMemo(() => {
    if (position && isGroupedWithNext)
      return containerToNextStyle?.[position]

    return null
  }, [position, isGroupedWithNext, containerToNextStyle])

  const styledBubbleToPrevious = useMemo(() => {
    if (position && isGroupedWithPrevious)
      return containerToPreviousStyle?.[position]

    return null
  }, [position, isGroupedWithPrevious, containerToPreviousStyle])

  // The color the body actually has, so the tail matches a `wrapperStyle` override.
  const customBodyColor = useMemo(
    () => (StyleSheet.flatten(wrapperStyle?.[position]) as ViewStyle | undefined)?.backgroundColor as string | undefined,
    [wrapperStyle, position]
  )
  const bodyColor = customBodyColor ?? (position === 'right' ? theme.colors.outgoingBubble : theme.colors.incomingBubble)
  const gradientStops = position === 'right' && !customBodyColor && !isVideoNote
    ? theme.bubble.outgoingGradient
    : null
  const hasGradient = !!gradientStops && gradientStops.length > 1
  const shadowColor = position === 'right' ? theme.colors.outgoingBubbleShadow : theme.colors.incomingBubbleShadow
  const hasShadow = !isVideoNote && !hasGradient && !!shadowColor && shadowColor !== 'transparent'

  // Telegram's text column: `min(width, height) - 80dp`, minus the avatar column beside it.
  const isAvatarShown = position === 'left' && (props as { isAvatarVisible?: boolean }).isAvatarVisible === true
  const maxWidth = Math.min(windowSize.width, windowSize.height) -
    theme.bubble.maxWidthInset -
    (isAvatarShown ? theme.avatar.size : 0) +
    theme.spacing.bubblePaddingH * 2

  const isOwnMessage = !(props.user && currentMessage?.user && currentMessage.user._id !== props.user._id)
  const statusKind: MessageStatusKind | null = !currentMessage || !isOwnMessage
    ? null
    : currentMessage.isFailed
      ? 'failed'
      : currentMessage.pending
        ? 'pending'
        : currentMessage.received
          ? 'read'
          : currentMessage.sent
            ? 'sent'
            : null
  const hasStatus = !!props.renderTicks || !!statusKind

  const hasDefaultReactions = !!currentMessage?.reactions?.length && !reactions?.renderReactions

  // Where the time goes: on the last line of text, on the last row of reaction pills, in a
  // pill over a photo, or - for anything custom - on a row of its own.
  const metaMode: MetaMode = useMemo(() => {
    if (isVideoNote)
      return 'note'
    if (isVoiceNote)
      return 'voice'
    if (!theme.bubble.isTimeInline || props.renderTime || (props.isCustomViewBottom && props.renderCustomView))
      return 'row'
    if (hasDefaultReactions)
      return 'reactions'
    if (currentMessage?.text)
      return props.renderMessageText ? 'row' : 'inline'
    if (currentMessage?.image && !currentMessage.video && !currentMessage.location && !currentMessage.audio && !props.renderMessageImage)
      return 'overlay'
    return 'row'
  }, [isVideoNote, isVoiceNote, theme, props.renderTime, props.isCustomViewBottom, props.renderCustomView, props.renderMessageText, props.renderMessageImage, hasDefaultReactions, currentMessage])

  const timeFormat = (props as { timeFormat?: string }).timeFormat ?? TIME_FORMAT
  const timeTextStyle = (props as { timeTextStyle?: LeftRightStyle<TextStyle> }).timeTextStyle

  // The invisible copy of the time that holds its place at the end of the text. When the
  // text's direction differs from the layout's, the last line ends on the wrong side for the
  // time, so it always takes a line of its own (Telegram does the same for RTL lines).
  const timeSpacer = useMemo(() => {
    if (metaMode !== 'inline' && metaMode !== 'reactions')
      return null
    if (!currentMessage?.createdAt)
      return null

    const label = formatMessageTime(currentMessage, context.getLocale(), timeFormat, labels.edited)
    const padding = hasStatus ? STATUS_SPACES : GAP_SPACES
    const breakBefore = metaMode === 'inline' && !!currentMessage.text && isTextRTL(currentMessage.text) !== isRTL
      ? '\n'
      : ZERO_WIDTH_SPACE

    return (
      <Text style={[styles.metaSpacer, timeTextStyle?.[position], styles.metaSpacerHidden]}>
        {(metaMode === 'inline' ? breakBefore : '') + padding + label}
      </Text>
    )
  }, [metaMode, currentMessage, context, timeFormat, labels.edited, hasStatus, isRTL, styles, timeTextStyle, position])

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

      // Pills and a time row sit closer to the text than the bubble's own bottom edge does.
      const spacing = metaMode === 'reactions'
        ? styles.textAboveReactions
        : metaMode === 'row'
          ? styles.textAboveMetaRow
          : null
      const userContainerStyle = messageTextProps?.containerStyle

      return (
        <MessageText
          {...combinedProps as any}
          containerStyle={spacing
            ? { left: [spacing, userContainerStyle?.left], right: [spacing, userContainerStyle?.right] }
            : userContainerStyle}
          trailing={metaMode === 'inline' ? timeSpacer : undefined}
        />
      )
    }

    return null
  }, [props, currentMessage, metaMode, styles, timeSpacer])

  // Photo corners (`ChatMessageCell:10997`): 2 less than the bubble's, 4 next to other
  // content, 3 on the tail side next to a grouped neighbour.
  const mediaCornerStyle = useMemo((): ImageStyle => {
    const outer = theme.radii.media
    const inner = theme.radii.mediaInner
    const near = Math.max(2, theme.radii.bubbleGrouped - 3)
    const hasAbove = !!props.isUsernameVisible || !!currentMessage?.replyMessage
    const hasBelow = !!currentMessage?.text || hasDefaultReactions || !!currentMessage?.audio || !!currentMessage?.location || !!currentMessage?.video
    const tailTop = hasAbove ? inner : (isGroupedWithPrevious ? near : outer)
    const otherTop = hasAbove ? inner : outer
    const tailBottom = hasBelow ? inner : (isGroupedWithNext ? near : outer)
    const otherBottom = hasBelow ? inner : outer

    return visualPosition === 'right'
      ? { borderTopLeftRadius: otherTop, borderTopRightRadius: tailTop, borderBottomLeftRadius: otherBottom, borderBottomRightRadius: tailBottom }
      : { borderTopLeftRadius: tailTop, borderTopRightRadius: otherTop, borderBottomLeftRadius: tailBottom, borderBottomRightRadius: otherBottom }
  }, [theme, props.isUsernameVisible, currentMessage, hasDefaultReactions, isGroupedWithPrevious, isGroupedWithNext, visualPosition])

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

      return (
        <MessageImage
          {...messageImageProps}
          containerStyle={styles.mediaFrame}
          imageStyle={[mediaCornerStyle, (messageImageProps as { imageStyle?: StyleProp<ImageStyle> }).imageStyle]}
        />
      )
    }

    return null
  }, [props, currentMessage, styles, mediaCornerStyle])

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

  // `tone` picks the colors: in the bubble, on a photo's dark pill, or on a round note's pill.
  const renderTicks = useCallback((tone: 'bubble' | 'media' | 'note') => {
    const { renderTicks } = props

    if (renderTicks && currentMessage)
      return renderComponentOrElement(renderTicks, currentMessage)

    if (!statusKind)
      return null

    // Allow a color override via the (legacy) tickStyle prop.
    const overrideColor = (StyleSheet.flatten(props.tickStyle) as TextStyle | undefined)?.color as
      | string
      | undefined
    // On a photo or a note the ticks sit on a dark pill, so they are white for both
    // positions unless the consumer overrode the color.
    const pillColor = tone === 'media'
      ? theme.colors.mediaTimeText
      : tone === 'note'
        ? styles.noteMetaText.color as string
        : undefined
    const sentColor = overrideColor ?? pillColor ?? (position === 'right' ? theme.colors.ticksSent : theme.colors.incomingMeta)
    const readColor = overrideColor ?? pillColor ?? (position === 'right' ? theme.colors.ticksRead : theme.colors.accent)

    return (
      <MessageStatus
        status={statusKind}
        color={statusKind === 'read' ? readColor : sentColor}
        errorColor={theme.colors.error}
      />
    )
  }, [
    props,
    currentMessage,
    statusKind,
    position,
    theme,
    styles,
  ])

  const renderTime = useCallback((tone: 'bubble' | 'media' | 'note') => {
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

      // On a note or a photo the meta sits on a dark pill, so it is white for both
      // positions - the incoming gray would be unreadable there.
      if (tone !== 'bubble') {
        const pillText = tone === 'media' ? styles.mediaMetaText : styles.noteMetaText
        return (
          <Time
            {...timeProps}
            timeTextStyle={{ left: [pillText, timeTextStyle?.left], right: [pillText, timeTextStyle?.right] }}
          />
        )
      }

      return <Time {...timeProps} />
    }

    return null
  }, [props, currentMessage, styles, timeTextStyle])

  const renderUsername = useCallback(() => {
    const {
      user,
      renderUsername,
    } = props

    if (props.isUsernameVisible && currentMessage) {
      if (user && currentMessage.user._id === user._id)
        return null

      // Telegram names the sender once, on the first message of their run.
      if (isGroupedWithPrevious)
        return null

      if (renderUsername)
        return renderComponentOrElement(renderUsername, currentMessage.user)

      return (
        <View style={styles.usernameContainer}>
          <Text
            style={[styles.username, { color: getNameColor(theme, currentMessage.user._id) }, props.usernameStyle]}
            numberOfLines={1}
          >
            {currentMessage.user.name}
          </Text>
        </View>
      )
    }

    return null
  }, [
    currentMessage,
    isGroupedWithPrevious,
    props,
    styles,
    theme,
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

  const reactionsDisplayProps = useMemo(() => {
    const currentReactions = currentMessage?.reactions
    if (!currentReactions || currentReactions.length === 0)
      return null

    return {
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
  }, [currentMessage, position, props.user, reactions])

  // Telegram draws the pills inside the bubble, under the text, with the time on their last
  // row when it fits.
  const renderReactionsInside = useCallback(() => {
    if (!hasDefaultReactions || !reactionsDisplayProps)
      return null

    return (
      <MessageReactions
        {...reactionsDisplayProps}
        trailing={metaMode === 'reactions' ? timeSpacer : undefined}
        hasContentAbove={!!currentMessage?.text}
      />
    )
  }, [hasDefaultReactions, reactionsDisplayProps, metaMode, timeSpacer, currentMessage])

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
        {renderReactionsInside()}
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
    renderReactionsInside,
    props.isCustomViewBottom,
  ])

  const renderBackground = useCallback(() => {
    if (isVideoNote)
      return null

    const tailSide = hasTail ? visualPosition : undefined

    return (
      <>
        {hasGradient && currentMessage
          ? (
            <GradientBubbleBackground
              stops={gradientStops!}
              mode={theme.bubble.outgoingGradientMode}
              messageId={currentMessage._id}
              bottomGap={isGroupedWithNext ? theme.spacing.withinGroup : theme.spacing.betweenGroups}
              cornerStyle={cornerStyle}
              tailSide={tailSide}
            />
          )
          : tailSide && <BubbleTail side={tailSide} color={bodyColor} shadowColor={hasShadow ? shadowColor : undefined} />}
        {!!highlightToken && (
          <BubbleHighlightTint
            token={highlightToken}
            color={position === 'right' ? theme.colors.outgoingBubbleSelected : theme.colors.incomingBubbleSelected}
            cornerStyle={cornerStyle}
          />
        )}
      </>
    )
  }, [isVideoNote, hasTail, visualPosition, hasGradient, currentMessage, gradientStops, theme, isGroupedWithNext, cornerStyle, bodyColor, hasShadow, shadowColor, highlightToken, position])

  const renderMeta = useCallback(() => {
    if (metaMode === 'inline' || metaMode === 'reactions') {
      const ticks = renderTicks('bubble')
      return (
        <View
          style={[
            styles.meta,
            position === 'right'
              ? (isRTL ? styles.metaOutgoingStart : styles.metaOutgoingEnd)
              : (isRTL ? styles.metaIncomingStart : styles.metaIncomingEnd),
            bottomContainerStyle?.[position],
          ]}
          pointerEvents='none'
          // The reserved copy inside the text already reads the time out.
          accessibilityElementsHidden
          importantForAccessibility='no-hide-descendants'
        >
          {renderTime('bubble')}
          {ticks}
        </View>
      )
    }

    if (metaMode === 'overlay')
      return (
        <View
          style={[styles.mediaMeta, isRTL ? styles.mediaMetaStart : styles.mediaMetaEnd, bottomContainerStyle?.[position]]}
          pointerEvents='none'
        >
          {renderTime('media')}
          {renderTicks('media')}
        </View>
      )

    return (
      <Animated.View
        style={[
          styles.bottom,
          isVideoNote && styles.noteMetaPill,
          isVoiceNote && styles.voiceMeta,
          bottomContainerStyle?.[position],
          isVideoNote && noteTimeStyle,
        ]}
      >
        {/* Faded on its own layer so the time keeps full strength. */}
        {isVideoNote && <View style={styles.noteMetaBackground} />}
        <View style={[styles.messageTimeAndStatusContainer, isVideoNote && styles.noteMetaInner]}>
          {renderTime(isVideoNote ? 'note' : 'bubble')}
          {renderTicks(isVideoNote ? 'note' : 'bubble')}
        </View>
      </Animated.View>
    )
  }, [metaMode, renderTicks, renderTime, styles, isRTL, position, bottomContainerStyle, isVideoNote, isVoiceNote, noteTimeStyle])

  const renderBubbleBody = useCallback(() => (
    <>
      {renderBackground()}
      {renderUsername()}
      {renderBubbleContent()}
      {renderMeta()}
    </>
  ), [
    renderBackground,
    renderBubbleContent,
    renderUsername,
    renderMeta,
  ])

  const wrapperStyleList = useMemo(() => [
    getStyleWithPosition(styles, 'wrapper', position),
    { maxWidth },
    cornerStyle,
    hasShadow && { boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 0.5, color: shadowColor }] },
    styledBubbleToNext,
    styledBubbleToPrevious,
    wrapperStyle?.[position],
    hasGradient && styles.gradientWrapper,
    isVideoNote && styles.noteWrapper,
  ] as StyleProp<ViewStyle>, [position, maxWidth, cornerStyle, hasShadow, shadowColor, styledBubbleToNext, styledBubbleToPrevious, wrapperStyle, styles, hasGradient, isVideoNote])

  const containerStyleList = useMemo(() => [
    getStyleWithPosition(styles, 'container', visualPosition),
    containerStyle?.[position],
  ], [styles, position, visualPosition, containerStyle])

  const rowSurfaceStyle = useMemo(
    () => getStyleWithPosition(styles, 'rowSurface', visualPosition),
    [styles, visualPosition]
  )

  const isPreviewNeeded = isPickerVisible || isLifted
  const liftedWidth = Math.ceil(pickerAnchor.bubbleWidth + 0.5)
  const messagePreview = useMemo(() => {
    if (!isPreviewNeeded)
      return undefined

    return (
      <LiftedBubble
        onLiftChange={setIsLifted}
        onRemeasure={measureBubble}
        style={[
          wrapperStyleList,
          LIFTED_RESET,
          // Rounded up: with the time sharing the last line, a copy a fraction of a point
          // narrower than the original would wrap the time onto a line of its own.
          { width: liftedWidth, maxWidth: liftedWidth },
        ]}
      >
        {renderBubbleBody()}
      </LiftedBubble>
    )
  }, [isPreviewNeeded, wrapperStyleList, liftedWidth, renderBubbleBody, measureBubble])

  // A custom reactions display keeps its old place under the bubble.
  const renderReactionsBelow = useCallback(() => {
    if (!reactions?.renderReactions || !reactionsDisplayProps)
      return null

    const display = renderComponentOrElement(reactions.renderReactions, reactionsDisplayProps)

    if (isLifted)
      return <View style={hiddenStyle}>{display}</View>

    return display
  }, [reactions, reactionsDisplayProps, isLifted])

  // A pick is applied at once; the overlay's flight then needs the bubble's
  // new spot, as a first reaction grows the row and the list may move it.
  const selectReaction = useCallback((emoji: string) => {
    reactions?.onReactionPress?.(currentMessage, emoji)
    requestAnimationFrame(() => requestAnimationFrame(measureBubble))
  }, [reactions, currentMessage, measureBubble])

  const renderReactionPickerModal = useCallback(() => {
    if (!reactions?.isEnabled)
      return null

    const emojis = reactions.emojis ?? DEFAULT_REACTION_EMOJIS

    const pickerProps = {
      visible: isPickerVisible,
      message: currentMessage,
      emojis,
      onSelect: selectReaction,
      onDismiss: closePicker,
      position,
      ...pickerAnchor,
      pickerContainerStyle: reactions.pickerContainerStyle,
      pickerEmojiStyle: reactions.pickerEmojiStyle,
      messagePreview,
      renderExpandedPicker: reactions.renderExpandedPicker,
    }

    if (reactions.renderReactionPicker)
      return renderComponentOrElement(reactions.renderReactionPicker, pickerProps)

    // The built-in picker aligns to the side the bubble is drawn on.
    return <ReactionPicker {...pickerProps} position={visualPosition} />
  }, [reactions, isPickerVisible, currentMessage, position, visualPosition, pickerAnchor, messagePreview, closePicker, selectReaction])

  const renderContextMenu = useCallback(() => {
    const reactionsRow = reactions?.isEnabled
      ? {
        emojis: reactions.emojis ?? DEFAULT_REACTION_EMOJIS,
        onSelect: selectReaction,
        renderExpandedPicker: reactions.renderExpandedPicker,
      }
      : undefined

    return (
      <ContextMenu
        visible={isPickerVisible}
        items={menuItems}
        onDismiss={closePicker}
        position={visualPosition}
        {...pickerAnchor}
        reactions={reactionsRow}
        messagePreview={messagePreview}
      />
    )
  }, [reactions, menuItems, isPickerVisible, visualPosition, pickerAnchor, messagePreview, closePicker, selectReaction])

  // Overlay path: a long-press opens either the Telegram-style context menu
  // (when messageActions are provided, optionally with a reactions row) or the
  // reactions quick-picker. The Animated.View carries only the scale transform.
  if (reactions?.isEnabled || hasMenu)
    // `rowSurface` spans the whole message row, so a long-press in the empty
    // space beside the bubble opens the picker too - the way Telegram behaves.
    return (
      <Animated.View style={containerStyleList}>
        <PressableBubbleRow
          isGestureEnabled={isGestureEnabled}
          isLifted={isLifted}
          onPressMessage={onPressMessageProp}
          onLongPressStart={openPicker}
          measureBubble={measureBubble}
          context={context}
          currentMessage={currentMessage}
          rowSurfaceStyle={rowSurfaceStyle}
          wrapperStyleList={wrapperStyleList}
          bubbleContainerRef={bubbleContainerRef}
        >
          {renderBubbleBody()}
        </PressableBubbleRow>
        {renderQuickReplies()}
        {renderReactionsBelow()}
        {hasMenu ? renderContextMenu() : renderReactionPickerModal()}
      </Animated.View>
    )

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
      {renderReactionsBelow()}
    </View>
  )
}
