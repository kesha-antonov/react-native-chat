import React, { ReactNode, useCallback, useState } from 'react'
import { Keyboard, StyleProp, ViewStyle } from 'react-native'

import { Actions } from '../Actions'
import { IMessage } from '../Models'
import { renderComponentOrElement } from '../utils'
import { AttachmentMenu } from './AttachmentMenu'
import { resolveAttachmentMessages } from './buildMessages'
import { AttachmentTab, AttachmentsProps, PickedAttachment } from './types'

export const resolveAttachments = <TMessage extends IMessage>(
  value: boolean | AttachmentsProps<TMessage> | undefined
): AttachmentsProps<TMessage> | null => {
  if (value === false)
    return null
  if (value === true || value === undefined)
    return {}
  return value.isEnabled === false ? null : value
}

interface AttachmentButtonProps<TMessage extends IMessage> {
  tabs: AttachmentTab[]
  config: AttachmentsProps<TMessage>
  onSend?: (messages: Partial<TMessage>[], shouldResetInputToolbar: boolean) => void
  /** Called as the menu opens: the emoji keyboard and the system keyboard make way. */
  onOpen?: () => void
  icon?: () => ReactNode
  wrapperStyle?: StyleProp<ViewStyle>
}

/** The composer's paperclip with the built-in attachment menu behind it. */
export function AttachmentButton<TMessage extends IMessage = IMessage> ({
  tabs,
  config,
  onSend,
  onOpen,
  icon,
  wrapperStyle,
}: AttachmentButtonProps<TMessage>) {
  const [isVisible, setIsVisible] = useState(false)
  // The built-in menu mounts on the first open and stays: mounting it with every composer cost
  // each chat opening a few milliseconds for a sheet most visits never open.
  const [hasOpened, setHasOpened] = useState(false)

  const open = useCallback(() => {
    Keyboard.dismiss()
    onOpen?.()
    if (hasOpened) {
      setIsVisible(true)
      return
    }
    // Mounted already open, the sheet's first close left its picture on screen: it mounts
    // closed and opens on the next frame, the path every later open takes.
    setHasOpened(true)
    requestAnimationFrame(() => setIsVisible(true))
  }, [onOpen, hasOpened])
  const close = useCallback(() => setIsVisible(false), [])

  const onPick = config.onPick
  const send = useCallback((attachments: PickedAttachment[], caption = '') => {
    resolveAttachmentMessages<TMessage>(attachments, caption, onPick)
      .then(messages => {
        if (messages.length)
          onSend?.(messages, false)
      })
      .catch(() => {})
  }, [onPick, onSend])

  return (
    <>
      <Actions onPressActionButton={open} icon={icon} wrapperStyle={wrapperStyle} />
      {config.renderAttachmentMenu
        ? renderComponentOrElement(config.renderAttachmentMenu, { visible: isVisible, onClose: close, tabs, onSend: send })
        : hasOpened && <AttachmentMenu visible={isVisible} tabs={tabs} onClose={close} onSend={send} />}
    </>
  )
}
