import { RefObject, useEffect, useInsertionEffect, useRef, useState } from 'react'
import { BackHandler } from 'react-native'
import { createMessageSelectionStore, useIsSelectionActive } from '../components/messageSelection'
import { IMessage } from '../Models'

/**
 * The chat's message selection: the store rows check themselves in, kept in step with the
 * messages, reported through `onSelectionChange` and left with Android's back.
 */
export function useChatSelection<TMessage extends IMessage> ({
  messages,
  messagesRef,
  onSelectionChange,
}: {
  messages: TMessage[]
  messagesRef: RefObject<TMessage[]>
  onSelectionChange: ((messages: TMessage[]) => void) | undefined
}) {
  const [selectionStore] = useState(createMessageSelectionStore)
  const isSelecting = useIsSelectionActive(selectionStore)

  // The selection's messages are looked up by id when it changes; deleted ones drop out of it.
  useEffect(() => {
    selectionStore.retain(new Set(messages.map(message => message._id)))
  }, [messages, selectionStore])

  const onSelectionChangeRef = useRef(onSelectionChange)
  useInsertionEffect(() => {
    onSelectionChangeRef.current = onSelectionChange
  })
  useEffect(() => selectionStore.subscribe(() => {
    const ids = selectionStore.getSelectedIds()
    onSelectionChangeRef.current?.(
      ids.map(id => messagesRef.current.find(message => message._id === id)).filter((m): m is TMessage => !!m)
    )
  }), [selectionStore, messagesRef])

  // Android's back leaves selection mode first.
  useEffect(() => {
    if (!isSelecting)
      return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      selectionStore.clear()
      return true
    })
    return () => subscription.remove()
  }, [isSelecting, selectionStore])

  return { selectionStore, isSelecting }
}
