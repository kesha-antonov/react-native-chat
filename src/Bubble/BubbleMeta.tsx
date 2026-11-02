import React, { useEffect, useMemo } from 'react'
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { useChatContext } from '../ChatContext'
import { useNoteTimeShift } from '../components/mediaPlayback'
import { MessageStatus } from '../components/MessageStatus'
import { NOTE_GROW_MS, noteGrowEasing } from '../components/roundNoteChrome'
import { useLabels } from '../hooks/useLabels'
import { useTheme, useThemedStyles } from '../hooks/useTheme'
import { IMessage } from '../Models'
import { formatMessageTime, Time } from '../Time'
import { renderComponentOrElement } from '../utils'
import { BubbleLayout, isTextRTL } from './layout'
import { createBubbleStyles } from './styles'
import { BubbleProps } from './types'

// The time takes `timeWidth + 6dp` on the last line, and `+ 20.5dp` with the checks.
// The reserved copy of the time is padded with no-break spaces to
// that width: two for the gap, nine with the checks.
const NBSP = ' '
const GAP_SPACES = NBSP.repeat(2)
const STATUS_SPACES = NBSP.repeat(9)
// A break opportunity before the reserved time, so it wraps alone instead of taking the last word.
const ZERO_WIDTH_SPACE = '​'

type Tone = 'bubble' | 'media' | 'note'

/**
 * A round note's time pill. A note that grows to play moves its right edge; the sent time rides
 * along at the circle's bottom-right, on the grow's own timing. Only round notes mount this, so
 * the subscription, shared value and animated style it needs are not on every message row.
 */
const NoteMeta = ({ messageId, style, children }: { messageId: string | number | undefined, style: StyleProp<ViewStyle>, children: React.ReactNode }) => {
  const shift = useNoteTimeShift(messageId)
  const shiftSV = useSharedValue(shift)
  useEffect(() => {
    shiftSV.value = withTiming(shift, { duration: NOTE_GROW_MS, easing: noteGrowEasing })
  }, [shift, shiftSV])
  const shiftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shiftSV.value }],
  }))
  return <Animated.View style={[style, shiftStyle]}>{children}</Animated.View>
}

/**
 * The invisible copy of the time that holds its place at the end of the text (or of the last row
 * of reaction pills), so the real time can sit over it. When the text's direction differs from
 * the layout's, the last line ends on the wrong side for the time, so it always takes a line of
 * its own.
 */
export function useTimeSpacer<TMessage extends IMessage> (bubble: BubbleProps<TMessage>, layout: BubbleLayout) {
  const context = useChatContext()
  const labels = useLabels()
  const styles = useThemedStyles(createBubbleStyles)
  const { currentMessage, position } = bubble
  const { metaMode, timeFormat, hasStatus, isRTL, timeTextStyle } = layout

  return useMemo(() => {
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
}

/** The message's time and status ticks, placed where `layout.metaMode` says. */
export function BubbleMeta<TMessage extends IMessage> ({ bubble, layout }: { bubble: BubbleProps<TMessage>, layout: BubbleLayout }) {
  const theme = useTheme()
  const styles = useThemedStyles(createBubbleStyles)
  const { currentMessage, position, bottomContainerStyle } = bubble
  const { metaMode, statusKind, isRTL, isVideoNote, isVoiceNote, isFileNote, timeTextStyle } = layout

  // `tone` picks the colors: in the bubble, on a photo's dark pill, or on a round note's pill.
  const renderTicks = (tone: Tone) => {
    const { renderTicks } = bubble

    if (renderTicks && currentMessage)
      return renderComponentOrElement(renderTicks, currentMessage)

    if (!statusKind)
      return null

    // Allow a color override via the (legacy) tickStyle prop.
    const overrideColor = (StyleSheet.flatten(bubble.tickStyle) as TextStyle | undefined)?.color as
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
  }

  const renderTime = (tone: Tone) => {
    if (!currentMessage?.createdAt)
      return null

    const {
      /* eslint-disable @typescript-eslint/no-unused-vars */
      containerStyle,
      wrapperStyle,
      textStyle,
      /* eslint-enable @typescript-eslint/no-unused-vars */
      ...timeProps
    } = bubble

    if (bubble.renderTime)
      return renderComponentOrElement(bubble.renderTime, timeProps)

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

  // Under big emoji, the time sits in a service pill, as under a sticker.
  if (metaMode === 'emoji')
    return (
      <View style={[styles.emojiMeta, bottomContainerStyle?.[position]]} pointerEvents='none'>
        {renderTime('note')}
        {renderTicks('note')}
      </View>
    )

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

  const metaStyle = [
    styles.bottom,
    isVideoNote && styles.noteMetaPill,
    (isVoiceNote || isFileNote) && styles.voiceMeta,
    bottomContainerStyle?.[position],
  ]
  const meta = (
    <View style={[styles.messageTimeAndStatusContainer, isVideoNote && styles.noteMetaInner]}>
      {renderTime(isVideoNote ? 'note' : 'bubble')}
      {renderTicks(isVideoNote ? 'note' : 'bubble')}
    </View>
  )

  if (isVideoNote)
    return (
      <NoteMeta messageId={currentMessage?._id} style={metaStyle}>
        {/* Faded on its own layer so the time keeps full strength. */}
        <View style={styles.noteMetaBackground} />
        {meta}
      </NoteMeta>
    )

  return <View style={metaStyle}>{meta}</View>
}
