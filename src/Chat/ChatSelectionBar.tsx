import React, { useMemo } from 'react'
import { MessageSelectionStore, useSelectedIds } from '../components/messageSelection'
import { SelectionBar, SelectionBarAction, SelectionBarProps } from '../components/SelectionBar'
import { IMessage } from '../Models'

/** Oldest first, the order a selection is copied and forwarded in. */
const byDate = <TMessage extends IMessage>(a: TMessage, b: TMessage) =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()

/**
 * The bar in the composer's place while messages are selected. Only this re-renders as messages
 * are checked; `Chat` itself re-renders once on the way in and once on the way out.
 */
export function ChatSelectionBar<TMessage extends IMessage> ({
  store,
  messages: allMessages,
  canCopy,
  onCopy,
  onForward,
  onDelete,
  renderSelectionBar,
}: {
  store: MessageSelectionStore
  messages: TMessage[]
  canCopy: boolean
  onCopy: (messages: TMessage[]) => void
  onForward?: (messages: TMessage[]) => void
  onDelete?: (messages: TMessage[]) => void
  renderSelectionBar?: ((props: SelectionBarProps & { messages: TMessage[] }) => React.ReactNode) | null
}) {
  const ids = useSelectedIds(store)
  const messages = useMemo(() => ids
    .map(id => allMessages.find(message => message._id === id))
    .filter((message): message is TMessage => !!message)
  , [ids, allMessages])
  const ordered = useMemo(() => [...messages].sort(byDate), [messages])

  const actions: SelectionBarAction[] = []
  if (canCopy && ordered.some(message => !!message.text))
    actions.push({ key: 'copy', onPress: () => onCopy(ordered) })
  if (onForward)
    actions.push({ key: 'forward', onPress: () => onForward(ordered) })
  if (onDelete)
    actions.push({ key: 'delete', onPress: () => onDelete(ordered) })

  const props = { count: ids.length, onClose: store.clear, actions }
  if (renderSelectionBar)
    return <>{renderSelectionBar({ ...props, messages: ordered })}</>

  return <SelectionBar {...props} />
}
