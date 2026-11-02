import { IMessage, MessageReaction } from './Models'

export interface ToggleReactionOptions {
  /**
   * How many different reactions one user may leave on a message. Picking another emoji past
   * the limit replaces the oldest of the user's own. Default 3, Telegram's limit; pass `1` for
   * one reaction each (a new pick replaces it), or `Infinity` for no limit.
   */
  maxPerUser?: number
}

/**
 * Add or remove `userId`'s `emoji` reaction on the message with `messageId`, returning a new
 * messages array (the input is not mutated; untouched messages keep their identity).
 */
export function toggleReaction<TMessage extends IMessage> (
  messages: TMessage[],
  messageId: TMessage['_id'],
  emoji: string,
  userId: string | number,
  { maxPerUser = 3 }: ToggleReactionOptions = {}
): TMessage[] {
  return messages.map(message => {
    if (message._id !== messageId)
      return message

    const current: MessageReaction[] = message.reactions ?? []
    const existing = current.find(reaction => reaction.emoji === emoji)

    // Taking your own reaction back.
    if (existing?.userIds.includes(userId)) {
      const userIds = existing.userIds.filter(id => id !== userId)
      return {
        ...message,
        reactions: userIds.length === 0
          ? current.filter(reaction => reaction !== existing)
          : current.map(reaction => (reaction === existing ? { ...reaction, userIds } : reaction)),
      }
    }

    // Over the limit: drop the user from their oldest reactions first.
    let reactions = current
    const own = reactions.filter(reaction => reaction.userIds.includes(userId))
    const excess = own.length - Math.max(0, maxPerUser - 1)
    if (excess > 0) {
      const dropped = new Set(own.slice(0, excess))
      reactions = reactions
        .map(reaction => (dropped.has(reaction)
          ? { ...reaction, userIds: reaction.userIds.filter(id => id !== userId) }
          : reaction))
        .filter(reaction => reaction.userIds.length > 0)
    }

    const target = reactions.find(reaction => reaction.emoji === emoji)
    return {
      ...message,
      reactions: target
        ? reactions.map(reaction => (reaction === target ? { ...reaction, userIds: [...reaction.userIds, userId] } : reaction))
        : [...reactions, { emoji, userIds: [userId] }],
    }
  })
}

/** Append messages at the newest end of the list. */
export function appendMessages<TMessage extends IMessage> (
  currentMessages: TMessage[] = [],
  messages: TMessage[] | TMessage,
  isInverted = true
): TMessage[] {
  const list = Array.isArray(messages) ? messages : [messages]
  return isInverted ? list.concat(currentMessages) : currentMessages.concat(list)
}

/** Prepend messages at the oldest end of the list. */
export function prependMessages<TMessage extends IMessage> (
  currentMessages: TMessage[] = [],
  messages: TMessage[] | TMessage,
  isInverted = true
): TMessage[] {
  const list = Array.isArray(messages) ? messages : [messages]
  return isInverted ? currentMessages.concat(list) : list.concat(currentMessages)
}
