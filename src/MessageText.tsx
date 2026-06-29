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
}: MessageTextProps<TMessage>) {
  const styles = useThemedStyles(createStyles)

  const linkStyle = useMemo(() => StyleSheet.flatten([
    styles.link,
    position === 'left' && styles.link_left,
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

  if (wantMarkdown && isMarkdownAvailable)
    return (
      <MarkdownMessageText
        text={currentMessage!.text}
        isStreaming={isStreaming}
        textStyle={style}
        containerStyle={[styles.container, containerStyle?.[position]]}
        componentProps={markdownProps}
      />
    )

  if (wantMarkdown)
    return (
      <View style={[styles.container, containerStyle?.[position]]}>
        <BasicMarkdown
          text={currentMessage!.text}
          textStyle={style}
          linkStyle={linkStyle}
          onLinkPress={onPressProp ? (link: string) => handlePress(link, 'url') : undefined}
        />
        {isStreaming && (
          <Text style={style}>
            <StreamingCursor />
          </Text>
        )}
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
      {isStreaming
        ? (
          // Wrap in a Text so the caret flows inline after the last word and
          // inherits the bubble text color.
          <Text style={style}>
            {parsed}
            <StreamingCursor />
          </Text>
        )
        : parsed}
    </View>
  )
}

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  container: {
    marginVertical: theme.spacing.bubblePaddingV,
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
  link: {
    textDecorationLine: 'underline',
  },
  link_left: {
    color: theme.colors.accent,
  },
})
