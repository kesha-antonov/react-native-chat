import React from 'react'
import { StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native'
import { StreamingCursor } from './StreamingCursor'

// Optional markdown renderer for AI/streamed replies. Resolved through a
// try/catch require so the bundle works whether or not the consumer installed
// `react-native-streamdown` (Metro treats try/catch-wrapped requires as optional
// dependencies). Streamdown renders streaming-incomplete markdown gracefully
// (unterminated code fences, half-written bold, partial tables).
let streamdown: any = null
try {
  streamdown = require('react-native-streamdown')
} catch {
  streamdown = null
}

const Streamdown = streamdown?.Streamdown ?? streamdown?.default ?? null

export const isMarkdownAvailable = !!Streamdown

export interface MarkdownMessageTextProps {
  text: string
  isStreaming?: boolean
  /** Base text style (color/size) derived from the theme. */
  textStyle?: StyleProp<TextStyle>
  containerStyle?: StyleProp<ViewStyle>
  /** Escape hatch: extra props forwarded to the Streamdown component (theming, rules, etc.). */
  componentProps?: Record<string, unknown>
}

/**
 * Renders message text as markdown via react-native-streamdown. Only used when
 * the package is installed and markdown is enabled; otherwise MessageText falls
 * back to its plain-text LinkParser path.
 */
export const MarkdownMessageText = ({
  text,
  isStreaming,
  textStyle,
  containerStyle,
  componentProps,
}: MarkdownMessageTextProps) => {
  if (!Streamdown)
    return null

  return (
    <View style={containerStyle}>
      <Streamdown style={textStyle} {...componentProps}>
        {text}
      </Streamdown>
      {isStreaming && (
        <Text style={textStyle}>
          <StreamingCursor />
        </Text>
      )}
    </View>
  )
}
