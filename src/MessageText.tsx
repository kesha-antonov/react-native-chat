import React, { useMemo, useCallback } from 'react'
import {
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
  View,
  Text } from 'react-native'

import { BasicMarkdown } from './components/BasicMarkdown'
import { MarkdownMessageText, isMarkdownAvailable } from './components/MarkdownMessageText'
import { StreamingCursor } from './components/StreamingCursor'
import { useThemedStyles } from './hooks/useTheme'
import { LinkParser, LinkMatcher, LinkType } from './linkParser'
import { LeftRightStyle, IMessage } from './Models'
import { ChatTheme } from './Theme'

export type MessageTextProps<TMessage extends IMessage> = {
  position?: 'left' | 'right'
  currentMessage: TMessage
  containerStyle?: LeftRightStyle<ViewStyle>
  textStyle?: LeftRightStyle<TextStyle>
  linkStyle?: LeftRightStyle<TextStyle>
  customTextStyle?: StyleProp<TextStyle>
  onPress?: (
    message: TMessage,
    url: string,
    type: LinkType
  ) => void
  // Link parser options
  matchers?: LinkMatcher[]
  email?: boolean
  phone?: boolean
  url?: boolean
  hashtag?: boolean
  mention?: boolean
  hashtagUrl?: string
  mentionUrl?: string
  stripPrefix?: boolean
  /**
   * Render the message body as markdown (great for AI/streamed replies). `true`
   * forces markdown for every message, `false` disables it; when left unset,
   * streamed messages render as markdown automatically. Uses the optional
   * `react-native-streamdown` peer when installed (best handling of
   * streaming-incomplete markdown), otherwise a built-in dependency-free renderer
   * covering headings, lists, blockquotes, code, bold/italic/strikethrough and links.
   */
  markdown?: boolean
  /** Extra props forwarded to the Streamdown component (its own theming/rules API); only used when streamdown is installed. */
  markdownProps?: Record<string, unknown>
  /**
   * Inline content after the last word. `Bubble` puts an invisible copy of the time here, so
   * the visible time can sit on the last line when it fits and the text wraps around it
   * when it does not - Telegram's trailing time. In markdown it follows the closing paragraph,
   * heading or list item; after a code block or a quote it takes a line of its own.
   */
  trailing?: React.ReactNode
}

export function MessageText<TMessage extends IMessage>({
  currentMessage,
  position = 'left',
  containerStyle,
  textStyle,
  linkStyle: linkStyleProp,
  customTextStyle,
  onPress: onPressProp,
  matchers,
  email = true,
  phone = true,
  url = true,
  hashtag = false,
  mention = false,
  hashtagUrl,
  mentionUrl,
  stripPrefix = false,
  markdown,
  markdownProps,
  trailing,
}: MessageTextProps<TMessage>) {
  const styles = useThemedStyles(createStyles)

  const linkStyle = useMemo(() => StyleSheet.flatten([
    styles.link,
    styles[`link_${position}`],
    linkStyleProp?.[position],
  ]), [styles, position, linkStyleProp])

  const style = useMemo(() => [
    styles.text,
    styles[`text_${position}`],
    textStyle?.[position],
    customTextStyle,
  ], [styles, position, textStyle, customTextStyle])

  const handlePress = useCallback((url: string, type: LinkType) => {
    onPressProp?.(currentMessage, url, type)
  }, [onPressProp, currentMessage])

  const isStreaming = !!currentMessage?.streaming

  // Render markdown when explicitly enabled, or when the message is being
  // streamed (AI replies) and it wasn't explicitly disabled. Prefer
  // react-native-streamdown when installed (best streaming-incomplete handling),
  // otherwise fall back to the built-in dependency-free renderer.
  const wantMarkdown = markdown !== false && (markdown === true || isStreaming)

  // Blocks of markdown have no last line to share, so the time gets one of its own.
  const trailingLine = trailing ? <Text style={style}>{trailing}</Text> : null

  if (wantMarkdown && isMarkdownAvailable)
    return (
      <View style={[styles.container, containerStyle?.[position]]}>
        <MarkdownMessageText
          text={currentMessage!.text}
          isStreaming={isStreaming}
          textStyle={style}
          componentProps={markdownProps}
        />
        {trailingLine}
      </View>
    )

  if (wantMarkdown)
    return (
      <View style={[styles.container, containerStyle?.[position]]}>
        <BasicMarkdown
          text={currentMessage!.text}
          textStyle={style}
          linkStyle={linkStyle}
          onLinkPress={onPressProp ? (link: string) => handlePress(link, 'url') : undefined}
          // The time shares the last line when it fits, as with plain text; a streaming reply
          // keeps its caret on the line after, so the time waits below it.
          trailing={isStreaming ? undefined : trailing}
        />
        {isStreaming && (
          <Text style={style}>
            <StreamingCursor />
          </Text>
        )}
        {isStreaming && trailingLine}
      </View>
    )

  const parsed = (
    <LinkParser
      text={currentMessage!.text}
      matchers={matchers}
      email={email}
      phone={phone}
      url={url}
      hashtag={hashtag}
      mention={mention}
      hashtagUrl={hashtagUrl}
      mentionUrl={mentionUrl}
      stripPrefix={stripPrefix}
      linkStyle={linkStyle}
      textStyle={style}
      onPress={onPressProp ? handlePress : undefined}
      TextComponent={Text}
    />
  )

  return (
    <View
      style={[
        styles.container,
        containerStyle?.[position],
      ]}
    >
      {isStreaming || trailing
        ? (
          // Wrap in a Text so the caret and the reserved time space flow inline after the
          // last word and inherit the bubble text color.
          <Text style={style}>
            {parsed}
            {isStreaming && <StreamingCursor />}
            {trailing}
          </Text>
        )
        : parsed}
    </View>
  )
}

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  container: {
    marginTop: theme.spacing.bubblePaddingV,
    marginBottom: theme.spacing.bubblePaddingBottom,
    marginHorizontal: theme.spacing.bubblePaddingH,
  },
  text: {
    fontSize: theme.typography.message.fontSize,
    lineHeight: theme.typography.message.lineHeight,
    fontWeight: theme.typography.message.fontWeight,
  },
  text_left: {
    color: theme.colors.incomingText,
  },
  text_right: {
    color: theme.colors.outgoingText,
  },
  // Telegram colors links without underlining them.
  link: {},
  link_left: {
    color: theme.colors.incomingLink,
  },
  link_right: {
    color: theme.colors.outgoingLink,
  },
})
