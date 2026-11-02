import { useCallback, useLayoutEffect, useRef } from 'react'

import { ComposerProps } from '../Composer'
import { TextSelection, deleteBackward, insertText } from '../emoji/textEditing'

type OnChangeText = NonNullable<ComposerProps['textInputProps']>['onChangeText']

// The composer's caret, kept for the emoji keyboard. The setter goes into the composer props
// handed to a custom `renderComposer`, which is called during render; behind a hook it is not
// mistaken for a ref read there - it only ever runs from the input's selection event.
function useSelectionTracker () {
  const selectionRef = useRef<TextSelection | null>(null)
  const getSelection = useCallback(() => selectionRef.current, [])
  const rememberSelection = useCallback((selection: TextSelection) => {
    selectionRef.current = selection
  }, [])
  return { getSelection, rememberSelection }
}

/** The emoji keyboard's edits to the composer's text, at its caret. */
export function useComposerEditing (text: string, onChangeText: OnChangeText) {
  // Edits go through the composer's own change handler, so they work whether the app controls
  // `text` or not. Kept in refs, as several taps can land before the next render.
  const textRef = useRef(text)
  const { getSelection, rememberSelection } = useSelectionTracker()
  const onChangeTextRef = useRef(onChangeText)
  useLayoutEffect(() => {
    textRef.current = text
    onChangeTextRef.current = onChangeText
  })

  const applyEdit = useCallback((edit: { text: string, selection: TextSelection }) => {
    textRef.current = edit.text
    rememberSelection(edit.selection)
    onChangeTextRef.current?.(edit.text)
  }, [rememberSelection])
  const insertEmoji = useCallback((value: string) => {
    applyEdit(insertText(textRef.current, value, getSelection()))
  }, [applyEdit, getSelection])
  const deleteBackwardInComposer = useCallback(() => {
    applyEdit(deleteBackward(textRef.current, getSelection()))
  }, [applyEdit, getSelection])

  return { rememberSelection, insertEmoji, deleteBackwardInComposer }
}
