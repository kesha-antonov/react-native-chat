import React from 'react'

import { ChatLabels } from '../i18n'
import { IconName, IconRenderer } from '../Icons'
import { devHint } from '../logging'
import { IMessage, MessageActionKey, MessageMenuItem, User } from '../Models'
import { ClipboardAdapter } from '../optional'
import { Icon } from './Icon'
import { PencilIcon, ReplyArrowIcon, TrashIcon } from './MediaControls'

/**
 * The order of the actions the library can offer by itself, as a messenger lists them for a
 * regular message: Reply, Copy, Forward, Pin / Unpin, Edit, Delete - with Select before
 * Delete.
 */
export const DEFAULT_MESSAGE_ACTION_KEYS: MessageActionKey[] = ['reply', 'copy', 'forward', 'pin', 'edit', 'select', 'delete']

type DrawnIcon = (props: { color?: string, size?: number }) => React.ReactNode

const iconRenderer = (name: IconName, Fallback?: DrawnIcon): IconRenderer => {
  const render: IconRenderer = ({ color, size }) => (
    <Icon
      name={name}
      color={color}
      size={size}
      fallback={Fallback ? <Fallback color={color} size={size} /> : null}
    />
  )
  return render
}

// Built once: a fresh renderer per menu would be a fresh prop per row.
const ICONS: Record<MessageActionKey | 'unpin', IconRenderer> = {
  reply: iconRenderer('reply', ReplyArrowIcon),
  copy: iconRenderer('copy'),
  forward: iconRenderer('forward'),
  pin: iconRenderer('pin'),
  unpin: iconRenderer('pinOff'),
  edit: iconRenderer('pencil', PencilIcon),
  select: iconRenderer('checkCircle'),
  delete: iconRenderer('trash', TrashIcon),
}

export interface DefaultMessageActionsOptions<TMessage extends IMessage> {
  message: TMessage
  user?: User
  labels: ChatLabels
  /** Which actions to build, in this order. */
  keys: MessageActionKey[]
  clipboard: ClipboardAdapter | null
  onReply?: (message: TMessage) => void
  onEdit?: (message: TMessage) => void
  onForward?: (message: TMessage) => void
  onPin?: (message: TMessage) => void
  onSelect?: (message: TMessage) => void
  onDelete?: (message: TMessage) => void
}

/**
 * The actions that can work for this message: Reply when replying is on, Copy for text when a
 * clipboard resolves, Edit for your own text when the app handles edits, and Forward, Pin and
 * Delete when the app handles them.
 */
export function buildDefaultMessageActions<TMessage extends IMessage> ({
  message,
  user,
  labels,
  keys,
  clipboard,
  onReply,
  onEdit,
  onForward,
  onPin,
  onSelect,
  onDelete,
}: DefaultMessageActionsOptions<TMessage>): MessageMenuItem[] {
  if (message.system)
    return []

  const isOwn = user?._id != null && message.user?._id === user._id
  const text = message.text

  const items: MessageMenuItem[] = []
  for (const key of keys)
    switch (key) {
      case 'reply':
        if (onReply)
          items.push({ key, label: labels.actionReply, icon: ICONS.reply, onPress: () => onReply(message) })
        break
      case 'copy':
        if (!text)
          break
        if (!clipboard) {
          devHint(
            'copy-no-clipboard',
            'Chat: the "Copy" message action is hidden - install `expo-clipboard` or `@react-native-clipboard/clipboard` to show it'
          )
          break
        }
        items.push({ key, label: labels.actionCopy, icon: ICONS.copy, onPress: () => clipboard.setString(text) })
        break
      case 'edit':
        if (onEdit && isOwn && !!text)
          items.push({ key, label: labels.actionEdit, icon: ICONS.edit, onPress: () => onEdit(message) })
        break
      case 'forward':
        if (onForward)
          items.push({ key, label: labels.actionForward, icon: ICONS.forward, onPress: () => onForward(message) })
        break
      case 'pin':
        if (onPin)
          items.push(message.isPinned
            ? { key, label: labels.actionUnpin, icon: ICONS.unpin, onPress: () => onPin(message) }
            : { key, label: labels.actionPin, icon: ICONS.pin, onPress: () => onPin(message) })
        break
      case 'select':
        if (onSelect)
          items.push({ key, label: labels.actionSelect, icon: ICONS.select, onPress: () => onSelect(message) })
        break
      case 'delete':
        if (onDelete)
          items.push({
            key,
            label: labels.actionDelete,
            icon: ICONS.delete,
            // Not red: the message menu draws Delete like any other row.
            onPress: () => onDelete(message),
          })
        break
    }

  return items
}
