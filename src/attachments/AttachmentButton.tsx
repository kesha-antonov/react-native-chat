import React, { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Keyboard, Platform, StyleProp, ViewStyle } from 'react-native'
import { KeyboardEvents } from 'react-native-keyboard-controller'

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

// Longer than the keyboard takes to close, in case it never says it did.
const KEYBOARD_HIDE_TIMEOUT = 500

/**
 * Hides the keyboard and calls `then` once it is down. Returns a cancel.
 *
 * On Android a window opened over the keyboard (the menu is a `Modal`) cuts its way down short,
 * and the list and the composer each learn of that at a different frame, so the chat jumped
 * behind the opening menu. Closing the keyboard first takes the path every close takes. The wait
 * is for keyboard-controller's own event, at the end of its animation: React Native's comes as
 * the keyboard starts to go, and a menu opened then still moved the list.
 */
function afterKeyboardHides (then: () => void) {
  if (Platform.OS !== 'android' || !Keyboard.isVisible()) {
    Keyboard.dismiss()
    then()
    return () => {}
  }
  let isDone = false
  const finish = () => {
    if (isDone)
      return
    isDone = true
    subscription.remove()
    clearTimeout(timeout)
    then()
  }
  const subscription = KeyboardEvents.addListener('keyboardDidHide', finish)
  const timeout = setTimeout(finish, KEYBOARD_HIDE_TIMEOUT)
  Keyboard.dismiss()
  return () => {
    isDone = true
    subscription.remove()
    clearTimeout(timeout)
  }
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
  const cancelWaitRef = useRef<(() => void) | null>(null)
  useEffect(() => () => cancelWaitRef.current?.(), [])

  const show = useCallback(() => {
    cancelWaitRef.current = null
    if (hasOpened) {
      setIsVisible(true)
      return
    }
    // Mounted already open, the sheet's first close left its picture on screen: it mounts
    // closed and opens on the next frame, the path every later open takes.
    setHasOpened(true)
    requestAnimationFrame(() => setIsVisible(true))
  }, [hasOpened])
  const open = useCallback(() => {
    onOpen?.()
    cancelWaitRef.current?.()
    cancelWaitRef.current = afterKeyboardHides(show)
  }, [onOpen, show])
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
        : hasOpened && <AttachmentMenu visible={isVisible} tabs={tabs} pickers={config.pickers} isGalleryGridEnabled={config.isGalleryGridEnabled} onClose={close} onSend={send} />}
    </>
  )
}
