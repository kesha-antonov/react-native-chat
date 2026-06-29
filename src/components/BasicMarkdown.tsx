import React from 'react'
import {
  Linking,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from 'react-native'

import { useThemedStyles } from '../hooks/useTheme'
import { ChatTheme } from '../Theme'

/**
 * Dependency-free markdown renderer used when the optional
 * `react-native-streamdown` peer is not installed. It is intentionally small but
 * covers what AI/streamed replies actually use: headings, bullet/ordered lists,
 * blockquotes, fenced and inline code, bold/italic/strikethrough, and links
 * (both `[text](url)` and bare URLs). Unterminated markers (a half-written
 * `**bold` or an unclosed code fence) render gracefully as plain text, so it is
 * safe to feed token-by-token while streaming.
 */

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })

// Inline tokens, tried left-to-right at each position:
// `code` | **bold** | *italic* | ~~strike~~ | [text](url) | bare url
const INLINE_RE = /`([^`]+)`|\*\*([\s\S]+?)\*\*|\*([\s\S]+?)\*|~~([\s\S]+?)~~|\[([^\]]+)\]\(([^)]+)\)|(https?:\/\/[^\s)]+)/

type MdStyles = ReturnType<typeof createStyles>

function openUrl (url: string, onLinkPress?: (url: string) => void) {
  if (onLinkPress)
    onLinkPress(url)
  else
    Linking.openURL(url).catch(() => {})
}

// Parse a single line/segment of inline markdown into React text nodes. Returns
// an array suitable to drop inside a parent <Text> (so color/size are inherited).
function parseInline (
  text: string,
  styles: MdStyles,
  keyBase: string,
  linkStyle?: StyleProp<TextStyle>,
  onLinkPress?: (url: string) => void
): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let rest = text
  let i = 0

  while (rest.length > 0) {
    const m = INLINE_RE.exec(rest)
    if (!m) {
      nodes.push(rest)
      break
    }

    if (m.index > 0)
      nodes.push(rest.slice(0, m.index))

    const key = `${keyBase}.${i++}`

    if (m[1] != null) {
      nodes.push(<Text key={key} style={styles.code}>{m[1]}</Text>)
    } else if (m[2] != null) {
      nodes.push(<Text key={key} style={styles.bold}>{parseInline(m[2], styles, key, linkStyle, onLinkPress)}</Text>)
    } else if (m[3] != null) {
      nodes.push(<Text key={key} style={styles.italic}>{parseInline(m[3], styles, key, linkStyle, onLinkPress)}</Text>)
    } else if (m[4] != null) {
      nodes.push(<Text key={key} style={styles.strike}>{parseInline(m[4], styles, key, linkStyle, onLinkPress)}</Text>)
    } else if (m[5] != null) {
      const url = m[6]
      nodes.push(
        <Text key={key} style={[styles.link, linkStyle]} onPress={() => openUrl(url, onLinkPress)}>
          {m[5]}
        </Text>
      )
    } else if (m[7] != null) {
      const url = m[7]
      nodes.push(
        <Text key={key} style={[styles.link, linkStyle]} onPress={() => openUrl(url, onLinkPress)}>
          {url}
        </Text>
      )
    }

    rest = rest.slice(m.index + m[0].length)
  }

  return nodes
}

export interface BasicMarkdownProps {
  text: string
  /** Base text style (color/size/weight) inherited by every block. */
  textStyle?: StyleProp<TextStyle>
  /** Position-aware link style (color), forwarded from MessageText. */
  linkStyle?: StyleProp<TextStyle>
  onLinkPress?: (url: string) => void
}

export const BasicMarkdown = ({ text, textStyle, linkStyle, onLinkPress }: BasicMarkdownProps) => {
  const styles = useThemedStyles(createStyles)

  const lines = text.split('\n')
  const blocks: React.ReactNode[] = []
  let paragraph: string[] = []
  let key = 0

  const flushParagraph = () => {
    if (paragraph.length === 0)
      return

    const k = `p${key++}`
    blocks.push(
      <Text key={k} style={[textStyle, styles.paragraph]}>
        {parseInline(paragraph.join('\n'), styles, k, linkStyle, onLinkPress)}
      </Text>
    )
    paragraph = []
  }

  for (let i = 0; i < lines.length;) {
    const line = lines[i]

    // Fenced code block (```lang ... ```), tolerant of a missing closing fence.
    if (/^```/.test(line.trim())) {
      flushParagraph()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing fence if present
      blocks.push(
        <View key={`c${key++}`} style={styles.codeBlock}>
          <Text style={[textStyle, styles.codeBlockText]}>{codeLines.join('\n')}</Text>
        </View>
      )
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      flushParagraph()
      const level = heading[1].length
      const k = `h${key++}`
      blocks.push(
        <Text
          key={k}
          style={[textStyle, styles.heading, level <= 1 ? styles.h1 : level === 2 ? styles.h2 : null]}
        >
          {parseInline(heading[2], styles, k, linkStyle, onLinkPress)}
        </Text>
      )
      i++
      continue
    }

    const bullet = line.match(/^\s*[-*+]\s+(.*)$/)
    const ordered = line.match(/^\s*(\d+)\.\s+(.*)$/)
    if (bullet || ordered) {
      flushParagraph()
      const k = `l${key++}`
      const marker = ordered ? `${ordered[1]}.` : '•'
      const content = ordered ? ordered[2] : bullet![1]
      blocks.push(
        <View key={k} style={styles.listItem}>
          <Text style={[textStyle, styles.listMarker]}>{marker}</Text>
          <Text style={[textStyle, styles.listText]}>
            {parseInline(content, styles, k, linkStyle, onLinkPress)}
          </Text>
        </View>
      )
      i++
      continue
    }

    const quote = line.match(/^>\s?(.*)$/)
    if (quote) {
      flushParagraph()
      const k = `q${key++}`
      blocks.push(
        <View key={k} style={styles.quote}>
          <Text style={[textStyle, styles.quoteText]}>
            {parseInline(quote[1], styles, k, linkStyle, onLinkPress)}
          </Text>
        </View>
      )
      i++
      continue
    }

    if (line.trim() === '') {
      flushParagraph()
      i++
      continue
    }

    paragraph.push(line)
    i++
  }

  flushParagraph()

  return <View style={styles.root}>{blocks}</View>
}

const createStyles = (theme: ChatTheme) => {
  const fontSize = theme.typography.message.fontSize
  const lineHeight = theme.typography.message.lineHeight ?? Math.round(fontSize * 1.3)

  return StyleSheet.create({
    root: {
    // Blocks stack vertically; spacing handled per-block.
    },
    paragraph: {
      marginBottom: 4,
    },
    bold: {
      fontWeight: '700',
    },
    italic: {
      fontStyle: 'italic',
    },
    strike: {
      textDecorationLine: 'line-through',
    },
    link: {
      color: theme.colors.accent,
      textDecorationLine: 'underline',
    },
    code: {
      fontFamily: MONO,
      fontSize: fontSize - 1,
      backgroundColor: 'rgba(127,127,127,0.18)',
    },
    codeBlock: {
      backgroundColor: 'rgba(127,127,127,0.16)',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginVertical: 4,
    },
    codeBlockText: {
      fontFamily: MONO,
      fontSize: fontSize - 1,
    },
    heading: {
      fontWeight: '700',
      marginBottom: 4,
    },
    h1: {
      fontSize: fontSize + 5,
      lineHeight: lineHeight + 6,
    },
    h2: {
      fontSize: fontSize + 2,
      lineHeight: lineHeight + 3,
    },
    listItem: {
      flexDirection: 'row',
      marginBottom: 2,
    },
    listMarker: {
      marginRight: 6,
    },
    listText: {
      flex: 1,
    },
    quote: {
      borderLeftWidth: 3,
      borderLeftColor: 'rgba(127,127,127,0.5)',
      paddingLeft: 8,
      marginVertical: 4,
    },
    quoteText: {
      opacity: 0.85,
    },
  })
}
