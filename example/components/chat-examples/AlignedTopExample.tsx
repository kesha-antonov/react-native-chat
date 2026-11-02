import React, { useCallback, useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import { Bubble, BubbleProps, Chat, IMessage } from '@kesha-antonov/react-native-chat'

import { OptionChips } from './OptionChips'
import { useDemoSend } from './useDemoSend'

type AlignMode = 'bottom' | 'top' | 'auto'

const ALIGN_MODES: Array<{ id: AlignMode, label: string }> = [
  { id: 'bottom', label: 'false' },
  { id: 'top', label: 'true' },
  { id: 'auto', label: '\'auto\'' },
]

const USER = { _id: 1, name: 'Developer' }
const BOT = { _id: 2, name: 'Bot' }

const INITIAL_MESSAGES: IMessage[] = [
  {
    _id: 3,
    text: 'Open the keyboard: with `auto` the conversation re-anchors to the bottom, and drops back to the top when you dismiss it.',
    createdAt: new Date(),
    user: BOT,
  },
  {
    _id: 2,
    text: 'A short conversation like this one does not fill the screen.',
    createdAt: new Date(),
    user: BOT,
  },
  {
    _id: 1,
    text: 'Hi! How can I help you?',
    createdAt: new Date(),
    user: BOT,
  },
]

export default function AlignedTopExample () {
  const [messages, setMessages] = useState<IMessage[]>(INITIAL_MESSAGES)
  const [alignMode, setAlignMode] = useState<AlignMode>('auto')
  const [isTallBubbleEnabled, setIsTallBubbleEnabled] = useState(false)
  const [isCustomToolbarEnabled, setIsCustomToolbarEnabled] = useState(false)

  const onSend = useDemoSend(setMessages)

  // Reproduces the bubble padding from
  // https://github.com/FaridSafi/react-native-gifted-chat/issues/2617 - three messages
  // are then taller than the list once the keyboard takes half the screen.
  const renderBubble = useCallback((props: BubbleProps<IMessage>) => (
    <Bubble {...props} wrapperStyle={{ left: styles.tallBubble, right: styles.tallBubble }} />
  ), [])

  // A toolbar that replaces Chat's own, exactly as reported in
  // https://github.com/FaridSafi/react-native-gifted-chat/issues/2617 - its TextInput is
  // the app's, not the Composer, so it never reports its height back to the chat.
  const renderInputToolbar = useCallback(() => (
    <View style={styles.customToolbar}>
      <TextInput placeholder='Custom toolbar...' placeholderTextColor='#888' style={styles.customInput} />
    </View>
  ), [])

  const isAlignedTop = alignMode === 'auto' ? 'auto' : alignMode === 'top'

  return (
    <View style={styles.container}>
      <OptionChips
        title='isAlignedTop'
        options={[
          ...ALIGN_MODES.map(mode => ({ id: mode.id, label: mode.label, isActive: mode.id === alignMode })),
          { id: 'tall', label: 'tall', isActive: isTallBubbleEnabled },
          { id: 'custom-bar', label: 'custom bar', isActive: isCustomToolbarEnabled },
        ]}
        onPress={id => {
          if (id === 'tall')
            setIsTallBubbleEnabled(value => !value)
          else if (id === 'custom-bar')
            setIsCustomToolbarEnabled(value => !value)
          else
            setAlignMode(id as AlignMode)
        }}
      />

      <Chat
        messages={messages}
        onSend={onSend}
        user={USER}
        isAlignedTop={isAlignedTop}
        renderBubble={isTallBubbleEnabled ? renderBubble : undefined}
        renderInputToolbar={isCustomToolbarEnabled ? renderInputToolbar : undefined}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tallBubble: {
    paddingVertical: 64,
  },
  customToolbar: {
    padding: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#888',
  },
  customInput: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 22,
    backgroundColor: '#8883',
    color: '#888',
  },
})
