import React, { useMemo } from 'react'
import { Text, TextStyle, StyleProp } from 'react-native'
import { splitHighlights } from './components/textHighlight'
import { openLinkUrl } from './safeUrl'

export type LinkType = 'url' | 'email' | 'phone' | 'mention' | 'hashtag'

export interface ParsedLink {
  type: LinkType
  text: string
  url: string
  index: number
  length: number
}

export interface LinkMatcher {
  type: LinkType
  pattern: RegExp
  /**
   * Character class the match must NOT be preceded by. Portable stand-in for a
   * lookbehind assertion `(?<!...)`, which JavaScriptCore on iOS/Safari < 16.4
   * rejects while parsing the file, taking the whole app down with
   * "SyntaxError: Invalid regular expression: invalid group specifier name".
   * A rejected match does not end the scan: it resumes one character further
   * along, exactly as a lookbehind would.
   */
  notPrecededBy?: RegExp
  /**
   * Limits `notPrecededBy` to matches in which this capture group took part, so
   * a pattern can guard a single one of its alternatives.
   */
  notPrecededByGroup?: number
  getLinkUrl?: (text: string) => string
  getLinkText?: (text: string) => string
  baseUrl?: string
  style?: StyleProp<TextStyle>
  renderLink?: (text: string, url: string, index: number, type: LinkType) => React.ReactNode
  onPress?: (url: string, type: LinkType) => void
}

interface LinkParserProps {
  text: string
  matchers?: LinkMatcher[]
  email?: boolean
  phone?: boolean
  url?: boolean
  hashtag?: boolean
  mention?: boolean
  hashtagUrl?: string
  mentionUrl?: string
  linkStyle?: StyleProp<TextStyle>
  onPress?: (url: string, type: LinkType) => void
  stripPrefix?: boolean
  textStyle?: StyleProp<TextStyle>
  TextComponent?: React.ComponentType<any>
  /** Words to mark in the text, links included (case-insensitive) */
  highlight?: string
  highlightStyle?: StyleProp<TextStyle>
}

const HIGHLIGHT_STYLE: TextStyle = { backgroundColor: 'rgba(255, 214, 10, 0.6)', color: '#000000' }

const DEFAULT_MATCHERS: LinkMatcher[] = [
  {
    type: 'url',
    // The bare-domain alternative is captured so `notPrecededBy` applies to it
    // alone, leaving scheme/www links matchable anywhere.
    pattern: /(?:https?:\/\/(?:www\.)?|www\.)[^\s]+|((?![A-Za-z0-9._%+-]*@)[a-zA-Z0-9][a-zA-Z0-9-]*\.(?!@)[a-zA-Z]{2,}(?![A-Za-z0-9._%+-]*@)(?:\/[^\s]*)?)/gi,
    notPrecededBy: /[A-Za-z0-9_.@]/,
    notPrecededByGroup: 1,
    getLinkUrl: (text: string) => {
      if (!/^https?:\/\//i.test(text))
        return `http://${text}`

      return text
    },
  },
  {
    type: 'email',
    pattern: /([a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
    notPrecededBy: /[A-Za-z0-9]/,
    getLinkUrl: (text: string) => `mailto:${text}`,
  },
  {
    type: 'phone',
    pattern: /(?:\+?\d{1,3}[\s.\-]?)?\(?\d{1,4}\)?[\s.\-]?\d{1,4}[\s.\-]?\d{1,9}(?![A-Za-z0-9_]|\.[a-z]{2,4})/gi,
    notPrecededBy: /[A-Za-z0-9_]/,
    getLinkUrl: (text: string) => {
      const cleaned = text.replace(/[\s.()\-]/g, '')
      return `tel:${cleaned}`
    },
  },
  {
    type: 'hashtag',
    pattern: /#[\w]+/g,
    getLinkUrl: (text: string) => text,
    baseUrl: undefined,
  },
  {
    type: 'mention',
    pattern: /@[\w-]+/g,
    notPrecededBy: /[a-zA-Z0-9._%+-]/,
    getLinkUrl: (text: string) => text,
    baseUrl: undefined,
  },
]

/**
 * Runs `matcher.pattern` over `text`, honouring `matcher.notPrecededBy`.
 *
 * The pattern is cloned so a matcher shared between renders never carries
 * `lastIndex` state around, which is what `String.prototype.matchAll` does too.
 * When the preceding character is rejected the scan restarts at
 * `match.index + 1` rather than after the match, so a start position ruled out
 * here can still be part of a match found one character later - the same
 * behaviour a lookbehind assertion gives.
 */
// Compiling a RegExp is the expensive half of parsing, and every pattern here is a
// constant - only `lastIndex` varies per call, and that is reset on checkout. Without
// this, each message re-compiled the whole matcher set on every render of its text.
// Keyed on the source RegExp object so custom matchers benefit too, as long as the
// consumer keeps their pattern stable.
const globalPatternCache = new WeakMap<RegExp, RegExp>()
const boundaryPatternCache = new WeakMap<RegExp, RegExp>()

function globalPattern(pattern: RegExp): RegExp {
  let compiled = globalPatternCache.get(pattern)

  if (!compiled) {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
    compiled = new RegExp(pattern.source, flags)
    globalPatternCache.set(pattern, compiled)
  }

  // Reused across calls, so the cursor has to be rewound rather than assumed at 0.
  compiled.lastIndex = 0
  return compiled
}

function boundaryPattern(notPrecededBy: RegExp): RegExp {
  let compiled = boundaryPatternCache.get(notPrecededBy)

  if (!compiled) {
    // Dropped `g` here as well: `test` on a global regex advances lastIndex and
    // would skip every other rejection.
    compiled = new RegExp(notPrecededBy.source, notPrecededBy.flags.replace(/[gy]/g, ''))
    boundaryPatternCache.set(notPrecededBy, compiled)
  }

  return compiled
}

function execMatches(text: string, matcher: LinkMatcher): RegExpExecArray[] {
  const { pattern, notPrecededBy, notPrecededByGroup } = matcher
  const regex = globalPattern(pattern)
  const boundary = notPrecededBy ? boundaryPattern(notPrecededBy) : undefined
  const matches: RegExpExecArray[] = []

  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    const guarded = notPrecededByGroup === undefined || match[notPrecededByGroup] !== undefined

    if (boundary && guarded && match.index > 0 && boundary.test(text[match.index - 1])) {
      regex.lastIndex = match.index + 1
      continue
    }

    matches.push(match)

    // Zero-length matches would otherwise spin forever.
    if (match[0].length === 0)
      regex.lastIndex += 1

  }

  return matches
}

/**
 * Most link patterns cost the square of the text they scan, and a message is whatever its
 * sender typed, so a long one is scanned in pieces of up to this many characters, cut at
 * whitespace. A run of more than this many characters with no whitespace is no link anyone
 * types; it is shown as plain text.
 */
const MAX_SCAN_LENGTH = 4096

/** The ranges of \`text\` to scan for links, each up to \`MAX_SCAN_LENGTH\` long and cut at whitespace. */
function scanRanges (text: string): Array<[number, number]> {
  if (text.length <= MAX_SCAN_LENGTH)
    return [[0, text.length]]

  const ranges: Array<[number, number]> = []
  let start = 0
  const token = /\S+/g
  let match: RegExpExecArray | null
  while ((match = token.exec(text)) !== null) {
    const tokenStart = match.index
    const tokenEnd = tokenStart + match[0].length
    if (match[0].length > MAX_SCAN_LENGTH) {
      if (tokenStart > start)
        ranges.push([start, tokenStart])
      start = tokenEnd
    } else if (tokenEnd - start > MAX_SCAN_LENGTH) {
      ranges.push([start, tokenStart])
      start = tokenStart
    }
  }
  if (text.length > start)
    ranges.push([start, text.length])

  return ranges
}

function parseLinks(text: string, matchers: LinkMatcher[]): ParsedLink[] {
  const ranges = scanRanges(text)
  if (ranges.length === 1 && ranges[0][0] === 0 && ranges[0][1] === text.length)
    return parseRange(text, matchers)

  const links: ParsedLink[] = []
  for (const [start, end] of ranges)
    for (const link of parseRange(text.slice(start, end), matchers))
      links.push({ ...link, index: link.index + start })

  return links
}

function parseRange(text: string, matchers: LinkMatcher[]): ParsedLink[] {
  const links: ParsedLink[] = []

  matchers.forEach(matcher => {
    const matches = execMatches(text, matcher)
    for (const match of matches)
      if (match.index !== undefined) {
        const matchText = match[0]
        const url = matcher.getLinkUrl
          ? matcher.getLinkUrl(matchText)
          : matchText
        const linkText = matcher.getLinkText
          ? matcher.getLinkText(matchText)
          : matchText

        links.push({
          type: matcher.type,
          text: linkText,
          url,
          index: match.index,
          length: matchText.length,
        })
      }

  })

  // Sort by index to maintain order
  return links.sort((a, b) => a.index - b.index)
}

// \`links\` is sorted by start, so a link overlaps one already kept exactly when it starts before
// the furthest end kept so far: one pass, where comparing with every kept link was quadratic in
// the number of links (a message of thousands of short domains froze the row).
function removeOverlaps(links: ParsedLink[]): ParsedLink[] {
  const filtered: ParsedLink[] = []
  let keptEnd = 0

  for (const link of links)
    if (link.index >= keptEnd) {
      filtered.push(link)
      keptEnd = link.index + link.length
    }

  return filtered
}

function LinkParserComponent({
  text,
  matchers: customMatchers,
  email = true,
  phone = true,
  url = true,
  hashtag = false,
  mention = false,
  hashtagUrl,
  mentionUrl,
  linkStyle,
  onPress,
  stripPrefix = true,
  textStyle,
  TextComponent = Text,
  highlight,
  highlightStyle,
}: LinkParserProps): React.ReactElement {
  // A piece of text with the highlighted words wrapped in a marked span.
  const marked = (value: string, key: string) => {
    if (!highlight)
      return value
    const parts = splitHighlights(value, highlight)
    if (parts.length === 1 && !parts[0].isMatch)
      return value
    return parts.map((part, index) => part.isMatch
      ? <TextComponent key={`${key}-${index}`} style={[HIGHLIGHT_STYLE, highlightStyle]}>{part.text}</TextComponent>
      : part.text)
  }

  // Parsing is the expensive part of rendering a message body - matcher assembly plus a
  // scan per matcher - and it depends only on the text and the matcher configuration.
  // Left in the render body it re-ran on every render of every message.
  const { links, activeMatchers } = useMemo(() => {
    const activeMatchers: LinkMatcher[] = []

    // Add custom matchers first (they take precedence)
    if (customMatchers)
      activeMatchers.push(...customMatchers)


    // Add default matchers based on flags
    if (url && !customMatchers?.some(m => m.type === 'url'))
      activeMatchers.push(DEFAULT_MATCHERS.find(m => m.type === 'url')!)

    if (email && !customMatchers?.some(m => m.type === 'email'))
      activeMatchers.push(DEFAULT_MATCHERS.find(m => m.type === 'email')!)

    if (phone && !customMatchers?.some(m => m.type === 'phone'))
      activeMatchers.push(DEFAULT_MATCHERS.find(m => m.type === 'phone')!)

    if (hashtag && !customMatchers?.some(m => m.type === 'hashtag')) {
      const hashtagMatcher = { ...DEFAULT_MATCHERS.find(m => m.type === 'hashtag')! }
      if (hashtagUrl) {
        hashtagMatcher.baseUrl = hashtagUrl
        const baseUrl = hashtagUrl.endsWith('/') ? hashtagUrl : `${hashtagUrl}/`
        hashtagMatcher.getLinkUrl = (text: string) => `${baseUrl}${text.substring(1)}`
      }
      activeMatchers.push(hashtagMatcher)
    }

    if (mention && !customMatchers?.some(m => m.type === 'mention')) {
      const mentionMatcher = { ...DEFAULT_MATCHERS.find(m => m.type === 'mention')! }
      if (mentionUrl) {
        mentionMatcher.baseUrl = mentionUrl
        const baseUrl = mentionUrl.endsWith('/') ? mentionUrl : `${mentionUrl}/`
        mentionMatcher.getLinkUrl = (text: string) => `${baseUrl}${text.substring(1)}`
      }
      activeMatchers.push(mentionMatcher)
    }


    return { activeMatchers, links: removeOverlaps(parseLinks(text, activeMatchers)) }
  }, [text, customMatchers, url, email, phone, hashtag, mention, hashtagUrl, mentionUrl])

  if (links.length === 0)
    return <TextComponent style={textStyle}>{marked(text, 'text')}</TextComponent>


  const elements: React.ReactNode[] = []
  let lastIndex = 0

  links.forEach((link, index) => {
    // Add text before link
    if (link.index > lastIndex)
      elements.push(
        <TextComponent key={`text-${index}`} style={textStyle}>
          {marked(text.substring(lastIndex, link.index), `text-${index}`)}
        </TextComponent>
      )


    // Find the matcher for this link
    const matcher = activeMatchers.find(m => m.type === link.type)

    // Handle link rendering
    if (matcher?.renderLink) {
      elements.push(matcher.renderLink(link.text, link.url, index, link.type))
    } else {
      const handlePress = () => {
        if (matcher?.onPress)
          matcher.onPress(link.url, link.type)
        else if (onPress)
          onPress(link.url, link.type)
        else
          // Default behavior: only safe schemes; a custom matcher's URL is checked too
          openLinkUrl(link.url)

      }

      let displayText = link.text
      if (stripPrefix && link.type === 'url')
        displayText = displayText.replace(/^https?:\/\//i, '')


      elements.push(
        <TextComponent
          key={`link-${index}`}
          style={[linkStyle, matcher?.style]}
          onPress={handlePress}
        >
          {marked(displayText, `link-${index}`)}
        </TextComponent>
      )
    }

    lastIndex = link.index + link.length
  })

  // Add remaining text
  if (lastIndex < text.length)
    elements.push(
      <TextComponent key='text-end' style={textStyle}>
        {marked(text.substring(lastIndex), 'text-end')}
      </TextComponent>
    )


  return <TextComponent style={textStyle}>{elements}</TextComponent>
}

// Rendered once per message body, and rebuilding its element list is the second most expensive
// thing a message row does after the row itself. The parse is already memoised, but the component
// still re-ran whenever its parent did - which, in a list, is on every commit that touches the
// row. Memoising the component lets an unchanged body skip the work entirely.
export const LinkParser = React.memo(LinkParserComponent)
