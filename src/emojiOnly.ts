/**
 * Counting the emoji in an emoji-only message, for big-emoji messages: a message made of
 * nothing but emoji (and spaces) drops its
 * bubble and draws them large.
 */

// Hermes and V8 both support Unicode property escapes; the range test below is only a fallback
// for an engine that does not.
let pictographic: RegExp | null = null
try {
  pictographic = new RegExp('\\p{Extended_Pictographic}', 'u')
} catch {
  pictographic = null
}

const isPictographic = (codePoint: number, char: string): boolean => {
  if (pictographic)
    return pictographic.test(char)

  return (codePoint >= 0x1F000 && codePoint <= 0x1FAFF) ||
    (codePoint >= 0x2600 && codePoint <= 0x27BF) ||
    (codePoint >= 0x2300 && codePoint <= 0x23FF) ||
    (codePoint >= 0x2B00 && codePoint <= 0x2BFF) ||
    codePoint === 0x00A9 || codePoint === 0x00AE || codePoint === 0x203C || codePoint === 0x2049 ||
    codePoint === 0x2122 || codePoint === 0x2139 || codePoint === 0x3030 || codePoint === 0x303D
}

const isRegionalIndicator = (codePoint: number) => codePoint >= 0x1F1E6 && codePoint <= 0x1F1FF
const isSkinTone = (codePoint: number) => codePoint >= 0x1F3FB && codePoint <= 0x1F3FF
const isTag = (codePoint: number) => codePoint >= 0xE0020 && codePoint <= 0xE007F
const VS15 = 0xFE0E
const VS16 = 0xFE0F
const ZWJ = 0x200D
const KEYCAP = 0x20E3

const isWhitespace = (char: string) => /\s/.test(char)

/**
 * How many emoji `text` holds when it holds nothing else (spaces aside), or 0. A ZWJ family,
 * a flag, a keycap or a skin-toned hand counts as one. Gives up past `max`, returning 0.
 */
export function countEmojiOnly (text: string | undefined | null, max = Infinity): number {
  if (!text)
    return 0

  const chars = Array.from(text)
  let count = 0
  let i = 0

  const codeAt = (index: number) => chars[index]?.codePointAt(0) ?? -1

  while (i < chars.length) {
    const char = chars[i]
    const codePoint = codeAt(i)

    if (isWhitespace(char)) {
      i += 1
      continue
    }

    if (isRegionalIndicator(codePoint)) {
      // A flag is a pair; a lone indicator still draws as one glyph.
      i += isRegionalIndicator(codeAt(i + 1)) ? 2 : 1
    } else if (/[0-9#*]/.test(char)) {
      // A keycap: the digit, an optional VS16, then U+20E3.
      let next = i + 1
      if (codeAt(next) === VS16)
        next += 1
      if (codeAt(next) !== KEYCAP)
        return 0
      i = next + 1
    } else if (isPictographic(codePoint, char)) {
      i += 1
      // Modifiers, then any ZWJ-joined parts of the same sequence.
      for (;;) {
        const next = codeAt(i)
        if (next === VS16 || next === VS15 || isSkinTone(next) || isTag(next) || next === KEYCAP) {
          i += 1
          continue
        }
        if (next === ZWJ && i + 1 < chars.length && isPictographic(codeAt(i + 1), chars[i + 1])) {
          i += 2
          continue
        }
        break
      }
      // A text-style symbol (© without VS16, ♥ with VS15) is not drawn as an emoji.
      if (codePoint < 0x2000 && codeAt(i - 1) !== VS16)
        return 0
    } else {
      return 0
    }

    count += 1
    if (count > max)
      return 0
  }

  return count
}
