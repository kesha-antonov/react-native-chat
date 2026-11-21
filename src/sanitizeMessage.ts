import { warning } from './logging'
import type { IMessage, User } from './Models'

/**
 * Messages come from a server, and through it from other people, so a field can arrive in any
 * shape whatever the types say. One with the wrong type (a number for `text`, a string for
 * `location.latitude`, an object for `reactions`) used to throw while rendering and take the
 * whole chat down for everyone reading it.
 *
 * `sanitizeMessage` returns the message itself when it is well-formed, so a normal chat pays
 * one pass of type checks and keeps every object identity. A malformed message comes back as
 * a copy with each bad field dropped, or turned into a string where it reads as one.
 */

type Loose = Record<string, unknown>

const isObject = (value: unknown): value is Loose =>
  value != null && typeof value === 'object' && !Array.isArray(value)
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const isId = (value: unknown): value is string | number =>
  typeof value === 'string' || isFiniteNumber(value)

/** A string, a number shown as one, or `undefined`. */
const asText = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : isFiniteNumber(value) ? String(value) : undefined

const OPTIONAL_STRINGS = ['image', 'imagePlaceholder', 'video', 'audio', 'transcription'] as const

export function cleanUser (user: unknown): User | undefined {
  if (!isObject(user))
    return undefined

  const name = user.name
  const avatar = user.avatar
  const isNameOk = name === undefined || typeof name === 'string'
  const isAvatarOk = avatar === undefined || typeof avatar === 'string' || typeof avatar === 'function' ||
    isFiniteNumber(avatar)
  const isIdOk = isId(user._id)
  if (isNameOk && isAvatarOk && isIdOk)
    return user as unknown as User

  const clean: Loose = { ...user, _id: isIdOk ? user._id : String(user._id ?? '') }
  if (!isNameOk)
    clean.name = asText(name)
  if (!isAvatarOk)
    delete clean.avatar
  return clean as unknown as User
}

function cleanLocation (location: Loose) {
  const latitude = typeof location.latitude === 'string' ? Number(location.latitude) : location.latitude
  const longitude = typeof location.longitude === 'string' ? Number(location.longitude) : location.longitude
  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)
    return undefined
  return latitude === location.latitude && longitude === location.longitude
    ? location
    : { ...location, latitude, longitude }
}

function cleanFile (file: Loose) {
  const isOk = (file.uri === undefined || typeof file.uri === 'string') && typeof file.name === 'string' &&
    (file.size === undefined || isFiniteNumber(file.size)) &&
    (file.mimeType === undefined || typeof file.mimeType === 'string')
  if (isOk)
    return file

  return {
    ...file,
    uri: typeof file.uri === 'string' ? file.uri : undefined,
    name: asText(file.name) ?? '',
    size: isFiniteNumber(file.size) ? file.size : undefined,
    mimeType: typeof file.mimeType === 'string' ? file.mimeType : undefined,
  }
}

function cleanReactions (reactions: unknown[]) {
  const isReactionOk = (reaction: unknown) =>
    isObject(reaction) && typeof reaction.emoji === 'string' && Array.isArray(reaction.userIds) &&
    reaction.userIds.every(isId)
  if (reactions.every(isReactionOk))
    return reactions

  return reactions
    .filter((reaction): reaction is Loose => isObject(reaction) && typeof reaction.emoji === 'string')
    .map(reaction => ({
      ...reaction,
      userIds: Array.isArray(reaction.userIds) ? reaction.userIds.filter(isId) : [],
    }))
}

function cleanQuickReplies (quickReplies: Loose) {
  if (!Array.isArray(quickReplies.values))
    return undefined

  const isReplyOk = (reply: unknown) =>
    isObject(reply) && typeof reply.title === 'string' && (typeof reply.value === 'string' || reply.value === undefined)
  const isTypeOk = quickReplies.type === 'radio' || quickReplies.type === 'checkbox'
  if (isTypeOk && quickReplies.values.every(isReplyOk))
    return quickReplies

  return {
    ...quickReplies,
    type: isTypeOk ? quickReplies.type : 'radio',
    values: quickReplies.values
      .filter((reply): reply is Loose => isObject(reply) && asText(reply.title) !== undefined)
      .map(reply => ({ ...reply, title: asText(reply.title)!, value: asText(reply.value) ?? asText(reply.title)! })),
  }
}

function cleanLinkPreview (preview: Loose) {
  const strings = ['url', 'siteName', 'title', 'description', 'image']
  const numbers = ['imageWidth', 'imageHeight']
  const isOk = strings.every(key => preview[key] === undefined || typeof preview[key] === 'string') &&
    numbers.every(key => preview[key] === undefined || isFiniteNumber(preview[key])) &&
    (preview.imageSize === undefined || preview.imageSize === 'large' || preview.imageSize === 'small')
  if (isOk)
    return preview

  const clean: Loose = { ...preview }
  for (const key of strings)
    if (clean[key] !== undefined && typeof clean[key] !== 'string')
      delete clean[key]
  for (const key of numbers)
    if (clean[key] !== undefined && !isFiniteNumber(clean[key]))
      delete clean[key]
  if (clean.imageSize !== 'large' && clean.imageSize !== 'small')
    delete clean.imageSize
  return clean
}

function cleanReplyMessage (reply: Loose) {
  const user = cleanUser(reply.user)
  const text = reply.text === undefined ? undefined : asText(reply.text)
  const isOk = user === reply.user && text === reply.text &&
    (reply.image === undefined || typeof reply.image === 'string') &&
    (reply.audio === undefined || typeof reply.audio === 'string')
  if (isOk)
    return reply

  return {
    ...reply,
    text: text ?? '',
    user: user ?? { _id: 0 },
    image: typeof reply.image === 'string' ? reply.image : undefined,
    audio: typeof reply.audio === 'string' ? reply.audio : undefined,
  }
}

/** The message itself when it is well-formed, otherwise a copy without the malformed fields. */
export function sanitizeMessage<TMessage extends IMessage> (message: TMessage): TMessage {
  if (!isObject(message))
    return { _id: '', text: '', createdAt: 0, user: { _id: 0 }, system: true } as unknown as TMessage

  const source = message as unknown as Loose
  let copy: Loose | null = null
  const set = (key: string, value: unknown) => {
    if (copy === null)
      copy = { ...source }
    if (value === undefined)
      delete copy[key]
    else
      copy[key] = value
  }

  if (typeof source.text !== 'string')
    set('text', asText(source.text) ?? '')

  if (source.user !== undefined) {
    const user = cleanUser(source.user)
    if (user !== source.user)
      set('user', user)
  }

  for (const key of OPTIONAL_STRINGS)
    if (source[key] !== undefined && typeof source[key] !== 'string')
      set(key, undefined)

  if (source.duration !== undefined && !isFiniteNumber(source.duration))
    set('duration', undefined)

  if (source.waveform !== undefined)
    if (!Array.isArray(source.waveform))
      set('waveform', undefined)
    else if (!source.waveform.every(isFiniteNumber))
      set('waveform', source.waveform.filter(isFiniteNumber))

  if (source.location !== undefined) {
    const location = isObject(source.location) ? cleanLocation(source.location) : undefined
    if (location !== source.location)
      set('location', location)
  }

  if (source.file !== undefined) {
    const file = isObject(source.file) ? cleanFile(source.file) : undefined
    if (file !== source.file)
      set('file', file)
  }

  if (source.reactions !== undefined) {
    const reactions = Array.isArray(source.reactions) ? cleanReactions(source.reactions) : undefined
    if (reactions !== source.reactions)
      set('reactions', reactions)
  }

  if (source.quickReplies !== undefined) {
    const quickReplies = isObject(source.quickReplies) ? cleanQuickReplies(source.quickReplies) : undefined
    if (quickReplies !== source.quickReplies)
      set('quickReplies', quickReplies)
  }

  if (source.replyMessage !== undefined) {
    const replyMessage = isObject(source.replyMessage) ? cleanReplyMessage(source.replyMessage) : undefined
    if (replyMessage !== source.replyMessage)
      set('replyMessage', replyMessage)
  }

  // `null` is a valid value: it hides the preview for this message.
  if (source.linkPreview != null) {
    const linkPreview = isObject(source.linkPreview) ? cleanLinkPreview(source.linkPreview) : undefined
    if (linkPreview !== source.linkPreview)
      set('linkPreview', linkPreview)
  }

  if (source.transfer !== undefined && !(isObject(source.transfer) &&
    (source.transfer.type === 'upload' || source.transfer.type === 'download') &&
    (source.transfer.progress === undefined || isFiniteNumber(source.transfer.progress))))
    set('transfer', undefined)

  return (copy ?? message) as TMessage
}

/**
 * `messages` itself when every message is well-formed and every id is used once, otherwise a
 * copy with each one cleaned. A message without a string or number id is dropped, and so is a
 * later one with an id already seen: the rows are keyed by id, so it would show in place of the
 * first one and that one would show twice.
 */
export function sanitizeMessages<TMessage extends IMessage> (messages: TMessage[]): TMessage[] {
  if (!Array.isArray(messages))
    return []

  let result: TMessage[] | null = null
  const seen = new Set<string>()
  for (let i = 0; i < messages.length; i++) {
    const clean = sanitizeMessage(messages[i])
    const hasId = isId(clean._id)
    const id = String(clean._id)
    const isDuplicate = hasId && seen.has(id)
    seen.add(id)
    if (clean !== messages[i] || isDuplicate || !hasId) {
      if (result === null)
        result = messages.slice(0, i)
      if (!hasId)
        // Without an id a message cannot be keyed, kept apart from the others or updated.
        warning(`Chat: dropped the message at index ${i}: \`_id\` must be a string or a number.`)
      else if (isDuplicate)
        warning(`Chat: dropped a second message with the id ${id}; message ids must be unique.`)
      else
        result.push(clean)
    } else if (result !== null) {
      result.push(clean)
    }
  }
  return result ?? messages
}

/**
 * A chat for `ChatList`, the same way: itself when well-formed, otherwise a copy without the
 * malformed fields. Its title, preview and typing users are other people's content too.
 */
export function sanitizeChat<TChat extends object> (chat: TChat): TChat | null {
  if (!isObject(chat))
    return null

  const source = chat as unknown as Loose
  let copy: Loose | null = null
  const set = (key: string, value: unknown) => {
    if (copy === null)
      copy = { ...source }
    if (value === undefined)
      delete copy[key]
    else
      copy[key] = value
  }

  if (!isId(source.id))
    set('id', String(source.id ?? ''))
  if (typeof source.title !== 'string')
    set('title', asText(source.title) ?? '')
  for (const key of ['avatar', 'draft'])
    if (source[key] !== undefined && typeof source[key] !== 'string')
      set(key, undefined)
  if (source.unreadCount !== undefined && !isFiniteNumber(source.unreadCount))
    set('unreadCount', undefined)
  if (source.typingUsers !== undefined) 
    if (!Array.isArray(source.typingUsers)) {
      set('typingUsers', undefined)
    } else {
      const users = source.typingUsers.map(cleanUser)
      if (users.some((user, i) => user !== (source.typingUsers as unknown[])[i]))
        set('typingUsers', users.filter((user): user is User => user !== undefined))
    }
  
  if (source.lastMessage !== undefined) {
    const lastMessage = isObject(source.lastMessage) ? sanitizeMessage(source.lastMessage as unknown as IMessage) : undefined
    if (lastMessage !== source.lastMessage)
      set('lastMessage', lastMessage)
  }

  return (copy ?? chat) as TChat
}

/** `chats` itself when every chat is well-formed, otherwise a copy with each one cleaned. */
export function sanitizeChats<TChat extends object> (chats: TChat[]): TChat[] {
  if (!Array.isArray(chats))
    return []

  let result: TChat[] | null = null
  for (let i = 0; i < chats.length; i++) {
    const clean = sanitizeChat(chats[i])
    if (clean !== chats[i]) {
      if (result === null)
        result = chats.slice(0, i)
      if (clean !== null)
        result.push(clean)
    } else if (result !== null) {
      result.push(chats[i])
    }
  }
  return result ?? chats
}
