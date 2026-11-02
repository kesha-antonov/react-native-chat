import React, { useMemo } from 'react'
import { ImageStyle, StyleProp, Text } from 'react-native'

import { LinkPreviewCard } from '../components/LinkPreviewCard'
import { MessageReply } from '../components/MessageReply'
import { useTheme, useThemedStyles } from '../hooks/useTheme'
import { MessageAudio } from '../MessageAudio'
import { MessageFile } from '../MessageFile'
import { MessageImage } from '../MessageImage'
import { MessageLocation } from '../MessageLocation'
import { MessageText } from '../MessageText'
import { MessageVideo } from '../MessageVideo'
import { IMessage } from '../Models'
import { QuickReplies } from '../QuickReplies'
import { MessageReactions } from '../Reactions'
import { renderComponentOrElement } from '../utils'
import { BubbleLayout } from './layout'
import { createBubbleStyles } from './styles'
import { BubbleProps, RenderMessageTextProps } from './types'

/** The props a content renderer gets: the bubble's, without its own container styles. */
const contentProps = <TMessage extends IMessage>(bubble: BubbleProps<TMessage>) => {
  const {
    /* eslint-disable @typescript-eslint/no-unused-vars */
    containerStyle,
    wrapperStyle,
    /* eslint-enable @typescript-eslint/no-unused-vars */
    ...rest
  } = bubble
  return rest
}

export type ReactionsDisplayProps = React.ComponentProps<typeof MessageReactions>

/**
 * What the bubble holds, top to bottom: a custom view, the quoted reply, the media, the text, the
 * link preview and the reaction pills. Each piece is the app's renderer when it passes one, and
 * the built-in component otherwise.
 */
export function BubbleContent<TMessage extends IMessage> ({ bubble, layout, timeSpacer, reactionsDisplay }: {
  bubble: BubbleProps<TMessage>
  layout: BubbleLayout
  /** The reserved copy of the time for the end of the text or the pills (`useTimeSpacer`). */
  timeSpacer: React.ReactNode
  reactionsDisplay: ReactionsDisplayProps | null
}) {
  const theme = useTheme()
  const styles = useThemedStyles(createBubbleStyles)
  const { currentMessage, position } = bubble
  const {
    metaMode,
    isBigEmoji,
    bigEmojiCount,
    hasLinkPreview,
    linkPreview,
    maxWidth,
    isUsernameShown,
    hasDefaultReactions,
    isGroupedWithPrevious,
    isGroupedWithNext,
    visualPosition,
  } = layout

  // Photo corners: 2 less than the bubble's, 4 next to other
  // content, 3 on the tail side next to a grouped neighbour.
  const mediaCornerStyle = useMemo((): ImageStyle => {
    const outer = theme.radii.media
    const inner = theme.radii.mediaInner
    const near = Math.max(2, theme.radii.bubbleGrouped - 3)
    // Only a name actually drawn above the photo squares its top corners: in a group, a photo
    // grouped under the sender's previous message has none, and took the 4pt corners anyway,
    // poking past the bubble's 17pt curve.
    const hasAbove = isUsernameShown || !!currentMessage?.replyMessage
    const hasBelow = !!currentMessage?.text || hasDefaultReactions || !!currentMessage?.audio || !!currentMessage?.location || !!currentMessage?.video
    const tailTop = hasAbove ? inner : (isGroupedWithPrevious ? near : outer)
    const otherTop = hasAbove ? inner : outer
    const tailBottom = hasBelow ? inner : (isGroupedWithNext ? near : outer)
    const otherBottom = hasBelow ? inner : outer

    return visualPosition === 'right'
      ? { borderTopLeftRadius: otherTop, borderTopRightRadius: tailTop, borderBottomLeftRadius: otherBottom, borderBottomRightRadius: tailBottom }
      : { borderTopLeftRadius: tailTop, borderTopRightRadius: otherTop, borderBottomLeftRadius: tailBottom, borderBottomRightRadius: otherBottom }
  }, [theme, isUsernameShown, currentMessage, hasDefaultReactions, isGroupedWithPrevious, isGroupedWithNext, visualPosition])

  const customView = bubble.renderCustomView ? renderComponentOrElement(bubble.renderCustomView, bubble) : null

  const renderMessageReply = () => {
    if (!currentMessage?.replyMessage)
      return null

    const { messageReply } = bubble
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
  }

  const renderMessageImage = () => {
    if (!currentMessage?.image)
      return null

    const messageImageProps = contentProps(bubble)
    if (bubble.renderMessageImage)
      return renderComponentOrElement(bubble.renderMessageImage, messageImageProps)

    return (
      <MessageImage
        {...messageImageProps}
        containerStyle={styles.mediaFrame}
        imageStyle={[mediaCornerStyle, (messageImageProps as { imageStyle?: StyleProp<ImageStyle> }).imageStyle]}
      />
    )
  }

  const renderMessageVideo = () => {
    if (!currentMessage?.video)
      return null

    const messageVideoProps = contentProps(bubble)
    if (bubble.renderMessageVideo)
      return renderComponentOrElement(bubble.renderMessageVideo, messageVideoProps)

    return <MessageVideo {...messageVideoProps} />
  }

  const renderMessageAudio = () => {
    if (!currentMessage?.audio)
      return null

    const messageAudioProps = contentProps(bubble)
    if (bubble.renderMessageAudio)
      return renderComponentOrElement(bubble.renderMessageAudio, messageAudioProps)

    return <MessageAudio {...messageAudioProps} />
  }

  const renderMessageLocation = () => {
    if (!currentMessage?.location)
      return null

    const messageLocationProps = contentProps(bubble)
    if (bubble.renderMessageLocation)
      return renderComponentOrElement(bubble.renderMessageLocation, messageLocationProps)

    return <MessageLocation {...messageLocationProps} />
  }

  const renderMessageFile = () => {
    if (!currentMessage?.file)
      return null

    const messageFileProps = contentProps(bubble)
    if (bubble.renderMessageFile)
      return renderComponentOrElement(bubble.renderMessageFile, messageFileProps)

    return <MessageFile {...messageFileProps} />
  }

  const renderMessageText = () => {
    if (isBigEmoji && currentMessage?.text) {
      const sizes = theme.bubble.bigEmojiSizes
      const fontSize = sizes[Math.min(bigEmojiCount, sizes.length) - 1] ?? theme.typography.message.fontSize
      return (
        <Text
          style={[styles.bigEmoji, { fontSize, lineHeight: Math.round(fontSize * 1.2) }]}
          allowFontScaling={false}
        >
          {currentMessage.text.trim()}
        </Text>
      )
    }

    if (!currentMessage?.text)
      return null

    const {
      messageTextProps,
      ...messageTextPropsRest
    } = contentProps(bubble)

    const combinedProps = {
      ...messageTextPropsRest,
      ...messageTextProps,
    } as RenderMessageTextProps<TMessage>

    if (bubble.renderMessageText)
      return renderComponentOrElement(bubble.renderMessageText, combinedProps)

    // Pills and a time row sit closer to the text than the bubble's own bottom edge does.
    const spacing = hasLinkPreview
      ? styles.textAboveLinkPreview
      : metaMode === 'reactions'
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

  const renderLinkPreview = () => {
    if (!hasLinkPreview || !linkPreview || !currentMessage)
      return null

    const previewProps = {
      preview: linkPreview,
      currentMessage,
      position,
      maxWidth: maxWidth - theme.spacing.bubblePaddingH * 2,
      onPress: bubble.onPressLinkPreview,
    }

    if (bubble.renderLinkPreview)
      return renderComponentOrElement(bubble.renderLinkPreview, previewProps)

    return <LinkPreviewCard {...previewProps} />
  }

  // The pills sit inside the bubble, under the text, with the time on their last
  // row when it fits.
  const reactionsInside = hasDefaultReactions && reactionsDisplay
    ? (
      <MessageReactions
        {...reactionsDisplay}
        trailing={metaMode === 'reactions' ? timeSpacer : undefined}
        hasContentAbove={!!currentMessage?.text}
      />
    )
    : null

  return (
    <>
      {!bubble.isCustomViewBottom && customView}
      {renderMessageReply()}
      {renderMessageImage()}
      {renderMessageVideo()}
      {renderMessageAudio()}
      {renderMessageLocation()}
      {renderMessageFile()}
      {renderMessageText()}
      {renderLinkPreview()}
      {bubble.isCustomViewBottom && customView}
      {reactionsInside}
    </>
  )
}

/** Quick reply chips under the bubble, for a message that offers them. */
export function BubbleQuickReplies<TMessage extends IMessage> ({ bubble }: { bubble: BubbleProps<TMessage> }) {
  const { currentMessage } = bubble
  if (!currentMessage?.quickReplies)
    return null

  if (bubble.renderQuickReplies)
    return renderComponentOrElement(bubble.renderQuickReplies, contentProps(bubble))

  return (
    <QuickReplies
      currentMessage={currentMessage}
      onQuickReply={bubble.onQuickReply}
      renderQuickReplySend={bubble.renderQuickReplySend}
      quickReplyStyle={bubble.quickReplyStyle}
      quickReplyTextStyle={bubble.quickReplyTextStyle}
      quickReplyContainerStyle={bubble.quickReplyContainerStyle}
      nextMessage={bubble.nextMessage}
    />
  )
}
