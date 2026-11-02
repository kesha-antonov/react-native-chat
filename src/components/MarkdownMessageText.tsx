import React from 'react'
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native'
import { devHint } from '../logging'
import { getStreamdown } from '../optional'
import { StreamingCursor } from './StreamingCursor'

// Optional markdown renderer for AI/streamed replies. Resolved through a
// optional-peer registry (`src/optional`) so the bundle works whether or not the consumer installed
// `react-native-streamdown` (Metro treats try/catch-wrapped requires as optional
// dependencies). Streamdown renders streaming-incomplete markdown gracefully
// (unterminated code fences, half-written bold, partial tables).
//
// Two shapes are supported: `StreamdownText` (0.3+, a `markdown` string prop and a
// `markdownStyle` object, rendered natively by react-native-enriched-markdown), and the
// older `Streamdown` / default export that took the text as children and a `style`.
const streamdown = getStreamdown()

const StreamdownText = streamdown?.StreamdownText ?? null
const LegacyStreamdown = StreamdownText ? null : (streamdown?.Streamdown ?? streamdown?.default ?? null)

// `StreamdownText` runs remend on a worklet runtime, which only works under react-native-worklets'
// Bundle Mode (the Babel plugin's `bundleMode: true` flips this global). Without it the first
// render throws "Tried to synchronously call a Remote Function" from the remend runtime and takes
// the screen down, so the built-in renderer stays in charge until the app has opted in.
const isBundleMode = () => (globalThis as { _WORKLETS_BUNDLE_MODE_ENABLED?: boolean })._WORKLETS_BUNDLE_MODE_ENABLED === true

/** Whether react-native-streamdown is installed and able to render here. */
export const canUseStreamdown = (): boolean => {
  if (LegacyStreamdown)
    return true
  if (!StreamdownText)
    return false
  if (isBundleMode())
    return true
  devHint('streamdown-bundle-mode', 'MessageText: `react-native-streamdown` is installed but react-native-worklets Bundle Mode is off, so markdown uses the built-in renderer. Enable `bundleMode` with `importForwarding: { moduleNames: [\'remend\'] }` in the worklets Babel plugin to use it.')
  return false
}

export const isMarkdownAvailable = !!(StreamdownText || LegacyStreamdown)

/**
 * How often a streaming reply's text reaches the renderer. `StreamdownText` processes each text
 * on a worklet and drops every result older than the newest text, so a reply growing every few
 * milliseconds showed nothing until it stopped. Fed at this pace, each step lands.
 */
export const STREAM_RENDER_MS = 250

/** The text, updated at most every `STREAM_RENDER_MS` while streaming, and at once when it ends. */
export const useStreamThrottledText = (text: string, isStreaming: boolean) => {
  const [shown, setShown] = React.useState(text)
  const latestRef = React.useRef(text)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAtRef = React.useRef(0)

  React.useEffect(() => {
    // Read by the pending timer, which takes whatever the text is when it fires. This effect
    // runs on every text change, so the ref is never behind.
    latestRef.current = text
    if (!isStreaming) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setShown(text)
      return
    }
    // One pending update at a time, which takes whatever the text is when it fires.
    if (timerRef.current)
      return
    const wait = Math.max(0, lastAtRef.current + STREAM_RENDER_MS - Date.now())
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      lastAtRef.current = Date.now()
      setShown(latestRef.current)
    }, wait)
  }, [text, isStreaming])

  React.useEffect(() => () => {
    if (timerRef.current)
      clearTimeout(timerRef.current)
  }, [])

  return isStreaming ? shown : text
}

export interface MarkdownMessageTextProps {
  text: string
  isStreaming?: boolean
  /** Base text style (color/size) derived from the theme. */
  textStyle?: StyleProp<TextStyle>
  /** Link style derived from the theme; its color tints markdown links. */
  linkStyle?: StyleProp<TextStyle>
  /** Called with the URL when a markdown link is pressed. */
  onLinkPress?: (url: string) => void
  containerStyle?: StyleProp<ViewStyle>
  /** Escape hatch: extra props forwarded to the Streamdown component (theming, rules, etc.). */
  componentProps?: Record<string, unknown>
}

// The native renderer takes plain values per element, not a React Native text style, so the
// bubble's text style is translated into the blocks a chat reply actually uses.
export function buildMarkdownStyle (
  textStyle: StyleProp<TextStyle>,
  linkStyle: StyleProp<TextStyle>,
  override?: Record<string, any>
): Record<string, any> {
  const text = StyleSheet.flatten(textStyle) ?? {}
  const link = StyleSheet.flatten(linkStyle) ?? {}
  const color = typeof text.color === 'string' ? text.color : undefined
  const base = {
    ...(color != null && { color }),
    ...(text.fontSize != null && { fontSize: text.fontSize }),
    ...(text.fontFamily != null && { fontFamily: text.fontFamily }),
  }
  const block = {
    ...base,
    ...(text.lineHeight != null && { lineHeight: text.lineHeight }),
  }
  const fontSize = text.fontSize ?? 16
  const heading = (scale: number) => ({
    ...base,
    fontSize: Math.round(fontSize * scale),
    fontWeight: '700',
  })

  const style: Record<string, any> = {
    paragraph: { ...block, marginTop: 0, marginBottom: 4 },
    h1: heading(1.25),
    h2: heading(1.15),
    h3: heading(1.05),
    h4: heading(1),
    h5: heading(1),
    h6: heading(1),
    list: { ...block, ...(color != null && { bulletColor: color, markerColor: color }) },
    codeBlock: { marginBottom: 4, borderRadius: 6, padding: 10 },
    blockquote: { ...block, ...(color != null && { borderColor: color }) },
    link: {
      ...(typeof link.color === 'string' ? { color: link.color } : color != null ? { color } : {}),
      underline: link.textDecorationLine === 'underline',
    },
    ...(color != null && { strong: { color }, em: { color } }),
  }

  if (override)
    for (const key of Object.keys(override))
      style[key] = { ...style[key], ...override[key] }

  return style
}

/**
 * Renders message text as markdown via react-native-streamdown. Only used when
 * the package is installed and markdown is enabled; otherwise MessageText falls
 * back to the built-in renderer.
 */
export const MarkdownMessageText = ({
  text,
  isStreaming,
  textStyle,
  linkStyle,
  onLinkPress,
  containerStyle,
  componentProps,
}: MarkdownMessageTextProps) => {
  const { markdownStyle: markdownStyleProp, ...restProps } = (componentProps ?? {}) as { markdownStyle?: Record<string, any> }

  const markdownStyle = React.useMemo(
    () => StreamdownText ? buildMarkdownStyle(textStyle, linkStyle, markdownStyleProp) : undefined,
    [textStyle, linkStyle, markdownStyleProp]
  )

  const renderedText = useStreamThrottledText(text, !!isStreaming)

  const handleLinkPress = React.useMemo(
    () => onLinkPress ? (event: { url?: string }) => event?.url && onLinkPress(event.url) : undefined,
    [onLinkPress]
  )

  if (!StreamdownText && !LegacyStreamdown)
    return null

  return (
    <View style={containerStyle}>
      {StreamdownText
        ? (
          <StreamdownText
            markdown={renderedText}
            markdownStyle={markdownStyle}
            onLinkPress={handleLinkPress}
            {...restProps}
          />
        )
        : (
          <LegacyStreamdown style={textStyle} {...componentProps}>
            {text}
          </LegacyStreamdown>
        )}
      {isStreaming && (
        <Text style={textStyle}>
          <StreamingCursor />
        </Text>
      )}
    </View>
  )
}
