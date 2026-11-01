import { useSyncExternalStore } from 'react'
import { Chat, ChatListItem, IMessage, TypingAction, User } from '@kesha-antonov/react-native-chat'

import { BOT_SUGGESTIONS, botAnswer, CANNED_REPLIES, Dialog, DIALOGS, INITIAL_MESSAGES, ME, SAMPLE_AUDIO } from './data'

/**
 * The demo's whole "backend": dialogs, their messages and who is typing, in one module with
 * listeners. Screens read slices through `useSyncExternalStore`; nothing leaves the device.
 */
interface State {
  dialogs: Record<string, Dialog>
  messages: Record<string, IMessage[]>
  typing: Record<string, User | undefined>
  /** What the typing user is doing, when not typing (recording a note, sending a photo). */
  typingAction: Record<string, TypingAction | undefined>
  /** The chat on screen, so incoming messages there do not count as unread. */
  openChatId?: string
  /** Pin order: pinned chats keep the order they were pinned in, until dragged. */
  pinOrder: string[]
}

let state: State = {
  dialogs: Object.fromEntries(DIALOGS.map(dialog => [dialog.id, dialog])),
  messages: INITIAL_MESSAGES,
  typing: {},
  typingAction: {},
  pinOrder: DIALOGS.filter(dialog => dialog.isPinned).map(dialog => dialog.id),
}

const listeners = new Set<() => void>()

function setState (update: (previous: State) => State) {
  state = update(state)
  listeners.forEach(listener => listener())
}

function subscribe (listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function useStore<T> (selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state))
}

function patchDialog (id: string, patch: Partial<Dialog>) {
  setState(s => ({ ...s, dialogs: { ...s.dialogs, [id]: { ...s.dialogs[id], ...patch } } }))
}

/** What the library's `ChatList` draws for a dialog, with the dialog itself alongside. */
export type DialogItem = ChatListItem & { dialog: Dialog }

// Items are reused while their dialog, newest message and typing user stay the same, so a
// change to one chat re-renders only that chat's row.
const itemCache = new Map<string, { dialog: Dialog, lastMessage?: IMessage, typing?: User, action?: TypingAction, item: DialogItem }>()

function toItem (s: State, dialog: Dialog): DialogItem {
  const lastMessage = s.messages[dialog.id]?.[0]
  const typing = s.typing[dialog.id]
  const action = s.typingAction[dialog.id]
  const cached = itemCache.get(dialog.id)
  if (cached && cached.dialog === dialog && cached.lastMessage === lastMessage && cached.typing === typing && cached.action === action)
    return cached.item
  const item: DialogItem = {
    id: dialog.id,
    title: dialog.title,
    kind: dialog.kind === 'user' ? 'private' : dialog.kind,
    avatar: dialog.avatar,
    lastMessage,
    unreadCount: dialog.unreadCount,
    isPinned: dialog.isPinned,
    isMuted: dialog.isMuted,
    isArchived: dialog.isArchived,
    isVerified: dialog.isVerified,
    isOnline: dialog.isOnline,
    draft: dialog.draft,
    typingUsers: typing ? [typing] : undefined,
    typingAction: action,
    dialog,
  }
  itemCache.set(dialog.id, { dialog, lastMessage, typing, action, item })
  return item
}

/** The dialogs as list items, pinned ones first in pin order (the list sorts the rest itself). */
function toItems (s: State): DialogItem[] {
  const pinned = s.pinOrder.map(id => s.dialogs[id]).filter(Boolean)
  const rest = Object.values(s.dialogs).filter(dialog => !pinned.includes(dialog))
  return [...pinned, ...rest].map(dialog => toItem(s, dialog))
}

// `useSyncExternalStore` needs a stable snapshot, so the items are cached per state.
let itemsCache: { state?: State, items: DialogItem[] } = { items: [] }
function getItems (s: State) {
  if (itemsCache.state !== s)
    itemsCache = { state: s, items: toItems(s) }
  return itemsCache.items
}

export const useChatListItems = () => useStore(getItems)
export const useDialog = (id: string): Dialog | undefined => useStore(s => s.dialogs[id])
export const useMessages = (id: string): IMessage[] => useStore(s => s.messages[id] ?? EMPTY)
export const useLastMessage = (id: string): IMessage | undefined => useStore(s => s.messages[id]?.[0])
export const useTyping = (id: string): User | undefined => useStore(s => s.typing[id])
export const useTypingAction = (id: string): TypingAction | undefined => useStore(s => s.typingAction[id])

const EMPTY: IMessage[] = []

function setMessages (id: string, update: (messages: IMessage[]) => IMessage[]) {
  setState(s => ({ ...s, messages: { ...s.messages, [id]: update(s.messages[id] ?? EMPTY) } }))
}

function setTyping (id: string, user: User | undefined, action?: TypingAction) {
  setState(s => ({ ...s, typing: { ...s.typing, [id]: user }, typingAction: { ...s.typingAction, [id]: user ? action : undefined } }))
}

/** Adds an incoming message; it counts as unread unless the chat is open. */
function receive (id: string, message: IMessage) {
  setMessages(id, messages => Chat.append(messages, [message]))
  const dialog = state.dialogs[id]
  if (state.openChatId !== id)
    patchDialog(id, { unreadCount: dialog.unreadCount + 1, isArchived: dialog.isMuted ? dialog.isArchived : false })
}

let replyIndex = 0
const timers = new Map<string, ReturnType<typeof setTimeout>[]>()

function schedule (id: string, delay: number, run: () => void) {
  const handle = setTimeout(run, delay)
  timers.set(id, [...(timers.get(id) ?? []), handle])
}

/** How long a text message shows its clock, and an upload takes. */
const SEND_MS = 700
const UPLOAD_MS = 3000
const UPLOAD_STEP_MS = 200
/** The demo's photos are about 1.4 MB, for the "0.7 MB / 1.4 MB" pill. */
const PHOTO_BYTES = 1_450_000
const uploads = new Map<IMessage['_id'], ReturnType<typeof setTimeout>[]>()

function markSent (id: string, messageId: IMessage['_id']) {
  setMessages(id, messages => messages.map(m => (m._id === messageId && !m.isFailed ? { ...m, pending: false, sent: true, transfer: undefined } : m)))
}

/** Steps an upload's progress unevenly, as a real network does; returns when it ends. */
function simulateUpload (id: string, messageId: IMessage['_id']) {
  const steps = UPLOAD_MS / UPLOAD_STEP_MS
  const handles: ReturnType<typeof setTimeout>[] = []
  let progress = 0
  for (let step = 1; step <= steps; step++) {
    progress = step === steps ? 1 : Math.min(0.97, progress + (0.4 + Math.random() * 1.2) / steps)
    const value = progress
    handles.push(setTimeout(() => {
      setMessages(id, messages => messages.map(m => (m._id === messageId && m.transfer ? { ...m, transfer: { ...m.transfer, progress: value } } : m)))
    }, step * UPLOAD_STEP_MS))
  }
  const doneAt = UPLOAD_MS + UPLOAD_STEP_MS
  handles.push(setTimeout(() => {
    uploads.delete(messageId)
    markSent(id, messageId)
  }, doneAt))
  uploads.set(messageId, handles)
  return doneAt
}

/** Someone types for a moment, then answers - and reads everything you sent. */
/** How many words each streamed chunk adds, and how often one arrives. */
const STREAM_WORDS = 2
const STREAM_MS = 60

/**
 * A bot reply, the way an AI bot answers: "typing" while it thinks, then one message that grows
 * a few words at a time (`streaming: true` draws the cursor) until it is final.
 */
function streamBotReply (id: string, bot: User, prompt: string, after: number) {
  const answer = botAnswer(prompt.trim())
  const tokens = answer.split(/(\s+)/)
  const messageId = `${id}-bot-${Date.now()}`
  schedule(id, after, () => {
    setMessages(id, messages => messages.map(m => (m.user._id === ME._id && m.sent && !m.received ? { ...m, received: true } : m)))
    setTyping(id, bot)
  })
  schedule(id, after + 900, () => {
    setTyping(id, undefined)
    receive(id, { _id: messageId, text: '', streaming: true, createdAt: new Date(), user: bot })
    let count = 0
    const step = () => {
      count = Math.min(tokens.length, count + STREAM_WORDS * 2)
      const isDone = count >= tokens.length
      const text = tokens.slice(0, count).join('')
      setMessages(id, messages => messages.map(m => (m._id === messageId
        ? { ...m, text, streaming: !isDone, quickReplies: isDone ? BOT_SUGGESTIONS : undefined }
        : m)))
      if (!isDone)
        schedule(id, STREAM_MS, step)
    }
    schedule(id, STREAM_MS, step)
  })
}

function simulateReply (id: string, from: User, text: string, typingAfter = 900, typingFor = 2200) {
  schedule(id, typingAfter, () => {
    setMessages(id, messages => messages.map(m => (m.user._id === ME._id && m.sent && !m.received ? { ...m, received: true } : m)))
    setTyping(id, from)
  })
  schedule(id, typingAfter + typingFor, () => {
    setTyping(id, undefined)
    receive(id, { _id: `${id}-reply-${Date.now()}`, text, createdAt: new Date(), user: from })
  })
}

export const chatStore = {
  getDialog: (id: string) => state.dialogs[id],

  send (id: string, newMessages: IMessage[]) {
    const dialog = state.dialogs[id]
    // A new message shows the sending clock until the server has it; media uploads first, with
    // the progress ring on it, and only then gets its check.
    const isMedia = (m: IMessage) => !!(m.image || m.video || m.file || m.audio)
    setMessages(id, messages => Chat.append(messages, newMessages.map(m => ({
      ...m,
      pending: true,
      sent: false,
      received: false,
      transfer: isMedia(m) ? { type: 'upload' as const, progress: 0, totalBytes: m.file?.size ?? PHOTO_BYTES } : undefined,
    }))))
    patchDialog(id, { draft: undefined, isArchived: false })

    let doneAt = SEND_MS
    newMessages.forEach(message => {
      if (isMedia(message))
        doneAt = Math.max(doneAt, simulateUpload(id, message._id))
      else
        schedule(id, SEND_MS, () => markSent(id, message._id))
    })

    if (dialog.isBot && dialog.peer) {
      const prompt = newMessages.map(m => m.text).filter(Boolean).join('\n')
      if (prompt)
        streamBotReply(id, dialog.peer, prompt, doneAt + 200)
      return
    }

    // Pick someone to answer: the other person, or a group member in turn.
    const responder = dialog.peer ?? dialog.members?.[replyIndex % dialog.members.length]
    if (!responder || dialog.kind === 'channel')
      return
    simulateReply(id, responder, CANNED_REPLIES[replyIndex++ % CANNED_REPLIES.length], doneAt + 600)
  },

  /** The cancel ✕ on an upload: the message is left failed, with the red badge. */
  cancelUpload (id: string, message: IMessage) {
    uploads.get(message._id)?.forEach(clearTimeout)
    uploads.delete(message._id)
    setMessages(id, messages => messages.map(m => (m._id === message._id ? { ...m, transfer: undefined, pending: false, isFailed: true } : m)))
  },

  editMessage (id: string, message: IMessage, text: string) {
    setMessages(id, messages => messages.map(m => (m._id === message._id ? { ...m, text, isEdited: true, editedAt: new Date() } : m)))
  },

  deleteMessage (id: string, message: IMessage) {
    setMessages(id, messages => messages.filter(m => m._id !== message._id))
  },

  toggleReaction (id: string, message: IMessage, emoji: string) {
    setMessages(id, messages => Chat.toggleReaction(messages, message._id, emoji, ME._id))
  },

  open (id: string) {
    setState(s => ({ ...s, openChatId: id }))
    patchDialog(id, { unreadCount: 0 })
  },

  close (id: string) {
    if (state.openChatId === id)
      setState(s => ({ ...s, openChatId: undefined }))
  },

  togglePin (id: string) {
    const isPinned = !state.dialogs[id].isPinned
    setState(s => ({
      ...s,
      pinOrder: isPinned ? [id, ...s.pinOrder] : s.pinOrder.filter(other => other !== id),
    }))
    patchDialog(id, { isPinned })
  },

  /** The pinned chats in a new order (dragged in the list). */
  setPinOrder (ids: string[]) {
    setState(s => ({ ...s, pinOrder: [...ids, ...s.pinOrder.filter(id => !ids.includes(id))] }))
  },

  toggleMute (id: string) {
    patchDialog(id, { isMuted: !state.dialogs[id].isMuted })
  },

  toggleArchive (id: string) {
    const isArchived = !state.dialogs[id].isArchived
    // Archiving unpins.
    if (isArchived && state.dialogs[id].isPinned)
      chatStore.togglePin(id)
    patchDialog(id, { isArchived })
  },

  /** An unsent message left in the composer, shown in the list as "Draft:". */
  setDraft (id: string, text: string) {
    const draft = text.trim() ? text : undefined
    if (state.dialogs[id] && state.dialogs[id].draft !== draft)
      patchDialog(id, { draft })
  },

  /** Empties a chat (the bot's then shows its intro card and START). */
  clearHistory (id: string) {
    timers.get(id)?.forEach(clearTimeout)
    timers.delete(id)
    setTyping(id, undefined)
    setMessages(id, () => [])
  },

  markRead (id: string) {
    patchDialog(id, { unreadCount: 0 })
  },

  /** Opens (or starts) a one-to-one chat with someone, for the new-message screen. */
  ensureDialog (user: User): string {
    const id = String(user._id)
    if (!state.dialogs[id])
      setState(s => ({
        ...s,
        dialogs: { ...s.dialogs, [id]: { id, title: user.name ?? id, kind: 'user', peer: user, avatar: typeof user.avatar === 'string' ? user.avatar : undefined, lastSeen: 'last seen recently', unreadCount: 0 } },
      }))
    else if (state.dialogs[id].isArchived)
      patchDialog(id, { isArchived: false })
    return id
  },

  deleteDialog (id: string) {
    timers.get(id)?.forEach(clearTimeout)
    timers.delete(id)
    setState(s => {
      const dialogs = { ...s.dialogs }
      delete dialogs[id]
      return { ...s, dialogs, pinOrder: s.pinOrder.filter(other => other !== id) }
    })
  },
}

// A little life on first open: Max starts typing and then writes, so the list shows "typing…",
// the row jumping to the top and its badge appearing without any input.
let hasStartedDemo = false
export function startChatListDemo () {
  if (hasStartedDemo)
    return
  hasStartedDemo = true
  const max = state.dialogs.max?.peer
  if (max)
    simulateReply('max', max, 'Are you coming to the meetup tomorrow? 🍕', 2500, 3000)
  // Anna records a voice note, so the list shows that status too.
  const anna = state.dialogs.anna?.peer
  if (anna) {
    schedule('anna', 4000, () => setTyping('anna', anna, 'recordingVoice'))
    schedule('anna', 9000, () => {
      setTyping('anna', undefined)
      receive('anna', { _id: `anna-voice-${Date.now()}`, text: '', audio: SAMPLE_AUDIO, duration: 6, createdAt: new Date(), user: anna })
    })
  }
}
