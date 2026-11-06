import { useCallback, useInsertionEffect, useMemo, useRef } from 'react'
import { Keyboard } from 'react-native'
import { ComposerPanelsStore } from '../components/composerPanels'
import { buildDefaultMessageActions, DEFAULT_MESSAGE_ACTION_KEYS } from '../components/defaultMessageActions'
import { MessageSelectionStore } from '../components/messageSelection'
import { ChatLabels } from '../i18n'
import { IMessage, MessageMenuItem } from '../Models'
import { getClipboard } from '../optional'
import { Store } from '../store'
import { ChatProps } from './types'

/**
 * The long-press menu every row gets (the app's `messageActions`, the built-in defaults, or
 * both) and what the selection bar's Copy, Forward and Delete do.
 */
export function useMessageActions<TMessage extends IMessage> ({
  props,
  userId,
  resolvedLabels,
  isReplyEnabled,
  startReply,
  startEdit,
  stopEdit,
  editStore,
  composerPanels,
  selectionStore,
}: {
  props: ChatProps<TMessage>
  userId: string | number | undefined
  resolvedLabels: ChatLabels
  isReplyEnabled: boolean
  startReply: (message: TMessage) => void
  startEdit: (message: TMessage) => void
  stopEdit: () => void
  editStore: Store<TMessage | null>
  composerPanels: ComposerPanelsStore
  selectionStore: MessageSelectionStore
}) {
  const {
    messageActions,
    defaultMessageActions = true,
    onEditMessage,
    onDeleteMessage,
    onForwardMessage,
    onPinMessage,
    onForwardMessages,
    onDeleteMessages,
    onLongPressMessage,
    onRetryMessage,
  } = props

  // The app's callbacks are read through a ref, so an inline arrow does not hand every row a
  // new `messageActions` (and re-render it) on each parent render.
  const actionCallbacksRef = useRef({ onEditMessage, onDeleteMessage, onForwardMessage, onPinMessage, onForwardMessages, onDeleteMessages, onRetryMessage })
  useInsertionEffect(() => {
    actionCallbacksRef.current = { onEditMessage, onDeleteMessage, onForwardMessage, onPinMessage, onForwardMessages, onDeleteMessages, onRetryMessage }
  })
  const hasRetry = !!onRetryMessage
  const hasPin = !!onPinMessage
  const hasEdit = !!onEditMessage
  const hasDelete = !!onDeleteMessage || !!onDeleteMessages
  const hasForward = !!onForwardMessage || !!onForwardMessages
  const hasClipboard = !!getClipboard()
  // Selecting is only offered when a selection can be acted on.
  const canSelect = hasClipboard || hasDelete || hasForward

  // An app that already handles long-press itself keeps that, unless it asks for actions.
  const actionKeys = defaultMessageActions === false || (onLongPressMessage && messageActions === undefined)
    ? []
    : defaultMessageActions === true ? DEFAULT_MESSAGE_ACTION_KEYS : defaultMessageActions
  const actionKeysId = actionKeys.join(',')

  const resolvedMessageActions = useMemo(() => {
    if (Array.isArray(messageActions))
      return messageActions

    const keys = (actionKeysId ? actionKeysId.split(',') : []) as typeof DEFAULT_MESSAGE_ACTION_KEYS
    if (keys.length === 0 && !messageActions && !hasRetry)
      return undefined

    const clipboard = keys.includes('copy') ? getClipboard() : null
    const startSelection = (message: TMessage) => {
      Keyboard.dismiss()
      composerPanels.close()
      selectionStore.start(message._id)
    }
    const owner = userId != null ? { _id: userId } : undefined
    const defaultsFor = (message: TMessage): MessageMenuItem[] => keys.length === 0 && !hasRetry
      ? []
      : buildDefaultMessageActions({
        message,
        user: owner,
        labels: resolvedLabels,
        keys,
        clipboard,
        onReply: isReplyEnabled ? startReply : undefined,
        onEdit: hasEdit ? startEdit : undefined,
        onForward: hasForward
          ? m => {
            const { onForwardMessage, onForwardMessages } = actionCallbacksRef.current
            if (onForwardMessage)
              onForwardMessage(m)
            else
              onForwardMessages?.([m])
          }
          : undefined,
        onSelect: canSelect ? startSelection : undefined,
        onPin: hasPin ? m => actionCallbacksRef.current.onPinMessage?.(m) : undefined,
        onRetry: hasRetry ? m => actionCallbacksRef.current.onRetryMessage?.(m) : undefined,
        onDelete: hasDelete
          ? m => {
            if (editStore.get()?._id === m._id)
              stopEdit()
            const { onDeleteMessage, onDeleteMessages } = actionCallbacksRef.current
            if (onDeleteMessage)
              onDeleteMessage(m)
            else
              onDeleteMessages?.([m])
          }
          : undefined,
      })

    if (typeof messageActions === 'function')
      return (message: TMessage) => messageActions(message, defaultsFor(message))

    return defaultsFor
  }, [
    messageActions,
    actionKeysId,
    userId,
    resolvedLabels,
    isReplyEnabled,
    startReply,
    startEdit,
    stopEdit,
    editStore,
    hasEdit,
    hasDelete,
    hasForward,
    hasPin,
    hasRetry,
    canSelect,
    composerPanels,
    selectionStore,
  ])

  const copySelection = useCallback((selected: TMessage[]) => {
    const text = selected.map(message => message.text).filter(Boolean).join('\n\n')
    if (text)
      getClipboard()?.setString(text)
    selectionStore.clear()
  }, [selectionStore])

  const forwardSelection = useMemo(() => {
    if (!hasForward)
      return undefined
    return (selected: TMessage[]) => {
      const { onForwardMessage, onForwardMessages } = actionCallbacksRef.current
      if (onForwardMessages)
        onForwardMessages(selected)
      else
        selected.forEach(message => onForwardMessage?.(message))
      selectionStore.clear()
    }
  }, [hasForward, selectionStore])

  const deleteSelection = useMemo(() => {
    if (!hasDelete)
      return undefined
    return (selected: TMessage[]) => {
      const editingMessage = editStore.get()
      if (editingMessage && selected.some(message => message._id === editingMessage._id))
        stopEdit()
      const { onDeleteMessage, onDeleteMessages } = actionCallbacksRef.current
      if (onDeleteMessages)
        onDeleteMessages(selected)
      else
        selected.forEach(message => onDeleteMessage?.(message))
      selectionStore.clear()
    }
  }, [hasDelete, editStore, stopEdit, selectionStore])

  return { resolvedMessageActions, actionCallbacksRef, hasClipboard, copySelection, forwardSelection, deleteSelection }
}
