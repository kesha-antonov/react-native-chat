import React, { useCallback, useMemo } from 'react'

import { Actions } from '../Actions'
import { AttachmentButton, resolveAttachments } from '../attachments/AttachmentButton'
import { getAttachmentTabs } from '../attachments/buildMessages'
import { AttachmentTab } from '../attachments/types'
import { IMessage } from '../Models'
import { renderComponentOrElement } from '../utils'
import { InputToolbarProps, OnSend } from './types'

/** The control behind the paperclip: custom actions, the legacy sheet, or the attachment menu. */
export function useActionsFragment<TMessage extends IMessage> (
  props: InputToolbarProps<TMessage>,
  closeEmoji: () => void
) {
  const {
    renderActions,
    onPressActionButton,
    actions,
    actionSheetOptionTintColor,
    icon,
    wrapperStyle,
    containerStyle,
  } = props

  // The built-in attachment menu, behind the paperclip when no legacy `actions` are given.
  const attachmentsProp = props.attachments
  const attachmentsConfig = useMemo(() => resolveAttachments<TMessage>(attachmentsProp), [attachmentsProp])
  const requestedTabs = attachmentsConfig?.tabs
  const hasAttachments = !!attachmentsConfig
  // Keyed by the tab list, not its identity: an inline array would rebuild the menu every render.
  const requestedTabsId = requestedTabs?.join(',')
  // Which tabs have the app's own picker, as a key for the same reason.
  const pickers = attachmentsConfig?.pickers
  const customPickersId = (['gallery', 'camera', 'file'] as const).filter(tab => !!pickers?.[tab]).join(',')
  const isGalleryGridEnabled = attachmentsConfig?.isGalleryGridEnabled !== false
  const attachmentTabs = useMemo(() => {
    if (!hasAttachments)
      return []
    const custom = Object.fromEntries(customPickersId.split(',').filter(Boolean).map(tab => [tab, true]))
    return getAttachmentTabs(requestedTabsId === undefined
      ? undefined
      : requestedTabsId.split(',').filter(Boolean) as AttachmentTab[], custom, isGalleryGridEnabled)
  }, [hasAttachments, requestedTabsId, customPickersId, isGalleryGridEnabled])
  const onSendProp = (props as { onSend?: OnSend<TMessage> }).onSend
  const onSendForAttachments = useCallback((messages: Partial<TMessage>[], shouldReset: boolean) => {
    onSendProp?.(messages, shouldReset)
  }, [onSendProp])

  return useMemo(() => {
    const actionsProps = {
      onPressActionButton,
      actions,
      actionSheetOptionTintColor,
      icon,
      wrapperStyle,
      containerStyle,
    }

    if (renderActions)
      return renderComponentOrElement(renderActions, actionsProps)

    if (onPressActionButton || actions?.length)
      return <Actions {...actionsProps} />

    if (attachmentsConfig && attachmentTabs.length > 0)
      return (
        <AttachmentButton<TMessage>
          tabs={attachmentTabs}
          config={attachmentsConfig}
          onSend={onSendForAttachments}
          onOpen={closeEmoji}
          icon={icon}
          wrapperStyle={wrapperStyle}
        />
      )

    return null
  }, [
    renderActions,
    onPressActionButton,
    actions,
    actionSheetOptionTintColor,
    icon,
    wrapperStyle,
    containerStyle,
    attachmentsConfig,
    attachmentTabs,
    onSendForAttachments,
    closeEmoji,
  ])
}
