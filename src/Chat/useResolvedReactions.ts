import { useCallback, useInsertionEffect, useMemo, useRef } from 'react'
import { renderDefaultExpandedPicker } from '../emoji/defaultExpandedPicker'
import { IMessage, User } from '../Models'
import { ChatProps } from './types'

/**
 * A group is any chat with more than one other sender; avatars and sender names show
 * only there.
 */
export function useIsGroupChat<TMessage extends IMessage> (
  messages: TMessage[],
  userId: string | number | undefined,
  isGroupChatProp: boolean | undefined
) {
  return useMemo(() => {
    if (isGroupChatProp !== undefined)
      return isGroupChatProp

    const others = new Set<string | number>()
    for (const message of messages) {
      if (message.system || !message.user || message.user._id === userId)
        continue

      others.add(message.user._id)
      if (others.size > 1)
        return true
    }
    return false
  }, [isGroupChatProp, messages, userId])
}

/** The app's `reactions`, with the defaults filled in that rows need to show them. */
export function useResolvedReactions<TMessage extends IMessage> ({
  reactions,
  messages,
  user,
  isGroupChat,
}: {
  reactions: ChatProps<TMessage>['reactions']
  messages: TMessage[]
  user: Partial<User>
  isGroupChat: boolean
}) {
  // Who reacted, for the avatars in a reaction pill: the senders of the loaded messages and you.
  // Read through a ref, so the lookup itself never changes and no row re-renders for it.
  const usersById = useMemo(() => {
    const map = new Map<string | number, User>()
    for (const message of messages)
      if (message.user)
        map.set(message.user._id, message.user)
    if (user && (user as Partial<User>)._id != null)
      map.set((user as User)._id, user as User)
    return map
  }, [messages, user])
  const usersByIdRef = useRef(usersById)
  useInsertionEffect(() => {
    usersByIdRef.current = usersById
  })
  const getUserFromMessages = useCallback((id: string | number) => usersByIdRef.current.get(id), [])

  // Reactions turn on by themselves once the app can apply them.
  // The expand button opens the built-in emoji grid unless the app passes its own (or `null`).
  return useMemo(() => reactions
    ? {
      ...reactions,
      isEnabled: reactions.isEnabled ?? !!reactions.onReactionPress,
      getUser: reactions.getUser ?? getUserFromMessages,
      isGroupChat,
      renderExpandedPicker: reactions.renderExpandedPicker === undefined
        ? renderDefaultExpandedPicker
        : reactions.renderExpandedPicker,
    }
    : undefined
  , [reactions, getUserFromMessages, isGroupChat])
}
