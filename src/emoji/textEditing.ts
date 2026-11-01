/** Text edits the emoji keyboard makes in the composer, at the caret or over the selection. */

export interface TextSelection {
  start: number
  end: number
}

export interface TextEdit {
  text: string
  selection: TextSelection
}

const clampSelection = (text: string, selection?: TextSelection | null): TextSelection => {
  if (!selection)
    return { start: text.length, end: text.length }

  const start = Math.max(0, Math.min(selection.start, text.length))
  const end = Math.max(start, Math.min(selection.end, text.length))
  return { start, end }
}

/** Put `insert` in place of the selection (or at the caret; at the end without one). */
export const insertText = (text: string, insert: string, selection?: TextSelection | null): TextEdit => {
  const { start, end } = clampSelection(text, selection)
  const caret = start + insert.length
  return {
    text: text.slice(0, start) + insert + text.slice(end),
    selection: { start: caret, end: caret },
  }
}

const isVariationSelector = (point: number) => point === 0xFE0F || point === 0xFE0E
const isSkinTone = (point: number) => point >= 0x1F3FB && point <= 0x1F3FF
const isRegionalIndicator = (point: number) => point >= 0x1F1E6 && point <= 0x1F1FF
const isTag = (point: number) => point >= 0xE0020 && point <= 0xE007F
const ZWJ = 0x200D
const KEYCAP = 0x20E3

/**
 * Where the character before `index` starts, keeping an emoji whole: ZWJ sequences
 * (👨‍👩‍👧), skin tones, variation selectors, keycaps, flags and tag sequences (🏴󠁧󠁢󠁳󠁣󠁴󠁿) are one
 * character to the user, so one backspace removes all of it.
 */
export const previousCharacterStart = (text: string, index: number): number => {
  const points = Array.from(text.slice(0, index))
  if (points.length === 0)
    return 0

  let i = points.length - 1
  const code = (at: number) => points[at]?.codePointAt(0) ?? 0

  // Trailing modifiers belong to the character before them.
  while (i > 0 && (isVariationSelector(code(i)) || isSkinTone(code(i)) || isTag(code(i)) || code(i) === KEYCAP))
    i -= 1
  if (i > 0 && isVariationSelector(code(i)))
    i -= 1

  // A flag is a pair of regional indicators.
  if (isRegionalIndicator(code(i))) {
    let run = 0
    for (let j = i; j >= 0 && isRegionalIndicator(code(j)); j -= 1)
      run += 1
    if (run % 2 === 0)
      i -= 1
  }

  // Joined parts: keep walking back while a ZWJ links this part to the previous one.
  while (i > 1 && code(i - 1) === ZWJ) {
    i -= 2
    while (i > 0 && (isVariationSelector(code(i)) || isSkinTone(code(i))))
      i -= 1
  }

  return points.slice(0, i).join('').length
}

/** The backspace key: removes the selection, or the whole character before the caret. */
export const deleteBackward = (text: string, selection?: TextSelection | null): TextEdit => {
  const { start, end } = clampSelection(text, selection)
  if (start !== end)
    return { text: text.slice(0, start) + text.slice(end), selection: { start, end: start } }
  if (start === 0)
    return { text, selection: { start: 0, end: 0 } }

  const from = previousCharacterStart(text, start)
  return {
    text: text.slice(0, from) + text.slice(start),
    selection: { start: from, end: from },
  }
}
