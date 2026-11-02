import React from 'react'
import { InputToolbar, InputToolbarProps } from '../InputToolbar'
import { IMessage, ReplyMessage } from '../Models'
import { Store, useStore } from '../store'
import { renderComponentOrElement } from '../utils'

// Memoized: the composer re-renders on its own state, not because the chat around it did.
const MemoInputToolbar = React.memo(InputToolbar) as typeof InputToolbar

/**
 * An app's `renderInputToolbar`, called from a component of its own. Its props carry the
 * composer's ref and ref-backed handlers, which must not be handed to a function called while
 * `Chat` renders.
 */
function CustomInputToolbar<TProps extends Record<string, any>> ({ render, props }: {
  render: Parameters<typeof renderComponentOrElement<TProps>>[0]
  props: TProps
}) {
  return <>{renderComponentOrElement(render, props)}</>
}

const sameText = (text: string) => text
const sameValue = <T, >(value: T) => value

/**
 * The composer, and the only part of the chat a keystroke re-renders: the typed text lives in a
 * store this host reads, not in `Chat`'s state, so typing leaves `Chat`, the keyboard-avoiding
 * view and the overlay provider alone. A controlled `text` prop still wins over the store.
 */
export function ComposerHost<TProps extends Record<string, any>> ({
  textStore,
  controlledText,
  replyStore,
  controlledReply,
  editStore,
  render,
  props,
}: {
  textStore: Store<string>
  controlledText: string | undefined
  replyStore: Store<ReplyMessage | null>
  /** The app's `reply.message`; `undefined` leaves the reply to the store. */
  controlledReply: ReplyMessage | null | undefined
  editStore: Store<IMessage | null>
  render: Parameters<typeof renderComponentOrElement<TProps>>[0] | undefined
  props: TProps
}) {
  const storedText = useStore(textStore, sameText, '')
  const text = controlledText === undefined ? storedText : controlledText
  const storedReply = useStore(replyStore, sameValue, null)
  const replyMessage = controlledReply === undefined ? storedReply : controlledReply
  const editMessage = useStore(editStore, sameValue, null)

  if (render)
    return <CustomInputToolbar render={render} props={{ ...props, text, replyMessage, editMessage }} />

  // The built-in composer has no use for the messages, and leaving them out lets its memo
  // skip the render a new message would otherwise cost it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { messages: _messages, ...composerProps } = props
  return (
    <MemoInputToolbar
      {...(composerProps as unknown as InputToolbarProps<IMessage>)}
      text={text}
      replyMessage={replyMessage}
      editMessage={editMessage}
    />
  )
}
