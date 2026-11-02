import React, { RefObject, useCallback, useInsertionEffect, useRef, useState } from 'react'
import { TextInput } from 'react-native'
import { IMessage, ReplyMessage } from '../Models'
import { createStore } from '../store'
import { ChatProps } from './types'

/**
 * What the composer holds: the typed text, the reply, the message being edited and the draft set
 * aside while editing. Each lives in a store `ComposerHost` reads, so none of them re-renders
 * `Chat`.
 */
export function useComposerState<TMessage extends IMessage> (
  props: ChatProps<TMessage>,
  textInputRef: RefObject<React.ComponentRef<typeof TextInput>>
) {
  const { reply } = props

  // Extract reply props for internal use
  const replyMessageProp = reply?.message
  const onClearReply = reply?.onClear
  const onSwipeToReply = reply?.swipe?.onSwipe

  // The typed text, read by `ComposerHost` alone: a keystroke must not re-render `Chat`.
  const [textStore] = useState(() => createStore<string>(props.text || props.initialText || ''))
  // The reply (when the app does not control it) and the message being edited live in stores
  // the composer reads, so starting or dropping either re-renders the composer and not `Chat`.
  const [replyStore] = useState(() => createStore<ReplyMessage | null>(null))
  // The message being edited in the composer (edit mode), or null.
  const [editStore] = useState(() => createStore<TMessage | null>(null))

  // Use controlled or uncontrolled reply state
  const isReplyControlled = replyMessageProp !== undefined
  const getReplyMessage = useCallback(
    () => (isReplyControlled ? replyMessageProp : replyStore.get()) ?? null,
    [isReplyControlled, replyMessageProp, replyStore]
  )

  const getTextFromProp = useCallback(
    (fallback: string) => {
      if (props.text === undefined)
        return fallback

      return props.text
    },
    [props.text]
  )

  const isReplyEnabled = reply?.isEnabled !== false
  const onReply = reply?.onReply
  const onReplyRef = useRef(onReply)
  useInsertionEffect(() => {
    onReplyRef.current = onReply
  })

  const focusComposer = useCallback(() => {
    // After the menu's exit, so the keyboard does not fight the lifted bubble flying back.
    requestAnimationFrame(() => textInputRef.current?.focus())
  }, [textInputRef])

  // A reply replaces an edit in progress.
  const cancelEdit = useRef<() => void>(() => {})

  const startReply = useCallback(
    (message: TMessage) => {
      cancelEdit.current()

      if (replyMessageProp === undefined)
        // Uncontrolled mode: manage state internally
        replyStore.set({
          _id: message._id,
          text: message.text,
          user: message.user,
          image: message.image,
          audio: message.audio,
        })

      onReplyRef.current?.(message)
      focusComposer()
    },
    [replyMessageProp, focusComposer, replyStore]
  )

  const handleSwipeToReply = useCallback(
    (message: TMessage) => {
      startReply(message)
      onSwipeToReply?.(message)
    },
    [startReply, onSwipeToReply]
  )

  const clearReply = useCallback(() => {
    if (replyMessageProp === undefined)
      // Uncontrolled mode: manage state internally
      replyStore.set(null)

    onClearReply?.()
  }, [replyMessageProp, onClearReply, replyStore])

  // Edit mode: the message's text goes into the composer under an "Editing"
  // banner, and sending saves it instead of posting a new message. Text changes go through
  // `_onChangeText` (in `useComposerHandlers`), reached through a ref.
  const changeTextRef = useRef<(text: string) => void>(() => {})
  const clearReplyRef = useRef<() => void>(() => {})
  // The draft (what the user typed, never a message being edited): set aside while editing,
  // put back when the edit is saved or cancelled, and reported through `onDraftChange`.
  const isEditingRef = useRef(false)
  const stashedDraftRef = useRef('')
  const draftRef = useRef(props.initialText ?? '')
  const onDraftChange = props.onDraftChange
  const onDraftChangeRef = useRef(onDraftChange)
  useInsertionEffect(() => {
    onDraftChangeRef.current = onDraftChange
  })
  const notifyDraft = useCallback((draft: string) => {
    if (isEditingRef.current || draft === draftRef.current)
      return
    draftRef.current = draft
    onDraftChangeRef.current?.(draft)
  }, [])

  const startEdit = useCallback((message: TMessage) => {
    clearReplyRef.current()
    if (!isEditingRef.current)
      stashedDraftRef.current = textStore.get()
    isEditingRef.current = true
    editStore.set(message)
    changeTextRef.current(message.text ?? '')
    focusComposer()
  }, [focusComposer, textStore, editStore])

  /** Leaves edit mode and gives the composer back the draft from before it. */
  const restoreDraft = useCallback(() => {
    isEditingRef.current = false
    const draft = stashedDraftRef.current
    stashedDraftRef.current = ''
    changeTextRef.current(draft)
  }, [])

  const stopEdit = useCallback(() => {
    editStore.set(null)
    restoreDraft()
  }, [restoreDraft, editStore])

  useInsertionEffect(() => {
    cancelEdit.current = () => {
      if (editStore.get())
        stopEdit()
    }
  })

  return {
    textStore,
    replyStore,
    editStore,
    isReplyEnabled,
    getReplyMessage,
    getTextFromProp,
    startReply,
    handleSwipeToReply,
    clearReply,
    notifyDraft,
    startEdit,
    restoreDraft,
    stopEdit,
    changeTextRef,
    clearReplyRef,
  }
}
