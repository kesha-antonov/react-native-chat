import { useMemo } from 'react'
import { StyleSheet, TextStyle, ViewStyle, useWindowDimensions } from 'react-native'

import { useLinkPreview } from '../components/LinkPreviewCard'
import { MessageStatusKind } from '../components/MessageStatus'
import { TIME_FORMAT } from '../Constant'
import { countEmojiOnly } from '../emojiOnly'
import { useIsRTL } from '../hooks/useIsRTL'
import { useTheme } from '../hooks/useTheme'
import { IMessage, LeftRightStyle } from '../Models'
import { mirrorPosition } from '../rtl'
import { isSameGroup } from '../utils'
import { BubbleProps } from './types'

/** Where the time goes: on the last line of text, on the last row of reaction pills, in a pill
 * over a photo or a note, beside a voice note's duration, under big emoji, or on a row of its own. */
export type MetaMode = 'inline' | 'reactions' | 'overlay' | 'row' | 'voice' | 'note' | 'emoji'

// First strong character decides a paragraph's direction (Hebrew, Arabic and friends are RTL).
const RTL_CHAR = /[֐-ࣿיִ-﷿ﹰ-﻿]/
const LTR_CHAR = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ԰-֏ऀ-෿฀-࿿ᄀ-ᇿ぀-ヿ㐀-鿿가-힯]/
export const isTextRTL = (text: string) => {
  for (const char of text) {
    if (RTL_CHAR.test(char))
      return true
    if (LTR_CHAR.test(char))
      return false
  }
  return false
}

/**
 * Everything a bubble decides from its message, its neighbours and the theme before it draws:
 * what kind of message it is, its corners and colours, where the time goes. Shared by the parts
 * of the bubble so each of them reads the same answers.
 */
export function useBubbleLayout<TMessage extends IMessage> (props: BubbleProps<TMessage>) {
  const {
    currentMessage,
    nextMessage,
    previousMessage,
    position,
    containerToNextStyle,
    containerToPreviousStyle,
    wrapperStyle,
    reactions,
  } = props

  const theme = useTheme()
  const isRTL = useIsRTL()
  const windowSize = useWindowDimensions()
  // Only for physical layout (alignment, corner radii) - `wrapper`'s background
  // color and every `xStyle?.[position]` consumer override stay keyed by
  // the real, unmirrored `position` ("my bubble vs. theirs"), not screen side.
  const visualPosition = mirrorPosition(position, isRTL)

  // A pure video note (round video, no text) drops the bubble background so the
  // circle floats on its own. Its meta row then has no bubble to sit on,
  // so it moves into a translucent pill over the circle instead.
  const isVideoNote = !!currentMessage?.videoNote && !!currentMessage?.video && !currentMessage?.text

  // A bare voice note keeps its time on the duration's line, at the bubble's
  // bottom-right, rather than on a row of its own under
  // the player. Only the built-in player leaves room for it there.
  const isVoiceNote = !!currentMessage?.audio && !currentMessage?.text && !isVideoNote &&
    !currentMessage?.image && !currentMessage?.video && !currentMessage?.location &&
    !props.renderMessageAudio

  // A bare file keeps its time on the size line too.
  const isFileNote = !!currentMessage?.file && !currentMessage?.text && !currentMessage?.image &&
    !currentMessage?.video && !currentMessage?.audio && !currentMessage?.location &&
    !props.renderMessageFile

  // Big emoji: a text of nothing
  // but emoji, with no media, quote or custom renderer, drops its bubble and draws them large.
  const bigEmojiMaxCount = theme.bubble.bigEmojiMaxCount
  const bigEmojiCount = useMemo(() => {
    if (!bigEmojiMaxCount || !currentMessage?.text || props.renderMessageText || props.renderCustomView)
      return 0
    if (currentMessage.image || currentMessage.video || currentMessage.audio || currentMessage.location ||
      currentMessage.file || currentMessage.replyMessage || currentMessage.quickReplies || currentMessage.linkPreview)
      return 0
    return countEmojiOnly(currentMessage.text, bigEmojiMaxCount)
  }, [bigEmojiMaxCount, currentMessage, props.renderMessageText, props.renderCustomView])
  const isBigEmoji = bigEmojiCount > 0

  // The web page preview under the text, for the first link in it.
  const linkPreview = useLinkPreview(
    props.renderLinkPreview === null || isBigEmoji ? undefined : currentMessage,
    props.fetchLinkPreview
  )
  const hasLinkPreview = !!linkPreview && !!currentMessage?.text

  // Runs: the same sender within five minutes. A run shares one tail, one name.
  const isGroupedWithPrevious = isSameGroup(currentMessage, previousMessage)
  const isGroupedWithNext = isSameGroup(currentMessage, nextMessage)

  // Photos, videos and maps without a caption are media bubbles: all four corners rounded
  // and no tail.
  const isMediaBubble = !currentMessage?.text &&
    (!!currentMessage?.image || !!currentMessage?.video || !!currentMessage?.location)
  const hasTail = theme.bubble.hasTail && !isGroupedWithNext && !isVideoNote && !isMediaBubble && !isBigEmoji

  // Corners: 17 everywhere, 6 on the tail side
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

  const styledBubbleToNext = position && isGroupedWithNext ? containerToNextStyle?.[position] : null
  const styledBubbleToPrevious = position && isGroupedWithPrevious ? containerToPreviousStyle?.[position] : null

  // The color the body actually has, so the tail matches a `wrapperStyle` override.
  const customBodyColor = useMemo(
    () => (StyleSheet.flatten(wrapperStyle?.[position]) as ViewStyle | undefined)?.backgroundColor as string | undefined,
    [wrapperStyle, position]
  )
  const bodyColor = customBodyColor ?? (position === 'right' ? theme.colors.outgoingBubble : theme.colors.incomingBubble)
  const gradientStops = position === 'right' && !customBodyColor && !isVideoNote && !isBigEmoji
    ? theme.bubble.outgoingGradient
    : null
  const hasGradient = !!gradientStops && gradientStops.length > 1
  const shadowColor = position === 'right' ? theme.colors.outgoingBubbleShadow : theme.colors.incomingBubbleShadow
  const hasShadow = !isVideoNote && !isBigEmoji && !hasGradient && !!shadowColor && shadowColor !== 'transparent'

  // The text column: `min(width, height) - 80dp`, minus the avatar column beside it.
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

  const metaMode: MetaMode = useMemo(() => {
    if (isVideoNote)
      return 'note'
    if (isBigEmoji && !props.renderTime)
      return 'emoji'
    if (isVoiceNote || isFileNote)
      return 'voice'
    if (!theme.bubble.isTimeInline || props.renderTime || (props.isCustomViewBottom && props.renderCustomView))
      return 'row'
    if (hasDefaultReactions)
      return 'reactions'
    // A link preview under the text puts the time on a line of its own below it.
    if (currentMessage?.text)
      return props.renderMessageText || hasLinkPreview ? 'row' : 'inline'
    if (currentMessage?.image && !currentMessage.video && !currentMessage.location && !currentMessage.audio && !props.renderMessageImage)
      return 'overlay'
    return 'row'
  }, [isVideoNote, isBigEmoji, hasLinkPreview, isVoiceNote, isFileNote, theme, props.renderTime, props.isCustomViewBottom, props.renderCustomView, props.renderMessageText, props.renderMessageImage, hasDefaultReactions, currentMessage])

  // The sender's name shows on the first message of someone else's run, in chats that name
  // senders; like a sticker, big emoji go without it.
  const isUsernameShown = !!props.isUsernameVisible && !!currentMessage && !isBigEmoji &&
    !(props.user && currentMessage.user._id === props.user._id) && !isGroupedWithPrevious

  const timeFormat = (props as { timeFormat?: string }).timeFormat ?? TIME_FORMAT
  const timeTextStyle = (props as { timeTextStyle?: LeftRightStyle<TextStyle> }).timeTextStyle

  return {
    visualPosition,
    isRTL,
    isVideoNote,
    isVoiceNote,
    isFileNote,
    bigEmojiCount,
    isBigEmoji,
    linkPreview,
    hasLinkPreview,
    isGroupedWithPrevious,
    isGroupedWithNext,
    hasTail,
    cornerStyle,
    styledBubbleToNext,
    styledBubbleToPrevious,
    bodyColor,
    gradientStops,
    hasGradient,
    shadowColor,
    hasShadow,
    maxWidth,
    statusKind,
    hasStatus,
    hasDefaultReactions,
    metaMode,
    isUsernameShown,
    timeFormat,
    timeTextStyle,
  }
}

export type BubbleLayout = ReturnType<typeof useBubbleLayout>
