import React, { useEffect } from 'react'
import { View } from 'react-native'
import Animated, { SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { roundTranscribePosition } from '../components/roundNoteChrome'
import { TranscribeButton, TranscriptionText } from '../components/TranscribeButton'
import { useTheme } from '../hooks/useTheme'
import { TRANSCRIPTION_GAP, TRANSCRIPTION_OPEN_MS, TRANSCRIPTION_PADDING_TOP } from './constants'
import { styles } from './styles'

/**
 * The transcribe button beside a round note (closed: a
 * 32dp circle on the service background, out of the bubble since a round note
 * has none). It follows the note's grow on the UI thread.
 */
export const RoundTranscribeButton = ({
  size,
  grow,
  isIncoming,
  isOpen,
  isLoading,
  onPress,
}: {
  size: SharedValue<number>
  grow: SharedValue<number>
  isIncoming: boolean
  isOpen: boolean
  isLoading: boolean
  onPress: () => void
}) => {
  const theme = useTheme()
  const positionStyle = useAnimatedStyle(() => roundTranscribePosition(isIncoming, size.value, grow.value))

  return (
    <Animated.View style={[styles.transcribe, positionStyle]}>
      <View pointerEvents='none' style={[styles.transcribeBackground, { backgroundColor: theme.colors.dayPillBackground }]} />
      <TranscribeButton
        isOpen={isOpen}
        isLoading={isLoading}
        onPress={onPress}
        color={theme.colors.dayPillText}
      />
    </Animated.View>
  )
}

/**
 * The transcription of a round note, in a bubble of the sender's color under
 * the circle. The bubble grows and fades with the text.
 */
export const RoundTranscription = ({
  text,
  isOpen,
  isIncoming,
  width,
}: {
  text: string | undefined
  isOpen: boolean
  isIncoming: boolean
  /** The note's resting width. The text is measured off-flow, so the bubble needs one. */
  width: number
}) => {
  const theme = useTheme()
  const open = useSharedValue(isOpen ? 1 : 0)
  useEffect(() => {
    open.set(withTiming(isOpen ? 1 : 0, { duration: TRANSCRIPTION_OPEN_MS }))
  }, [isOpen, open])
  // Padding follows the opening too, so a closed transcription leaves no
  // empty bubble behind.
  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: open.get(),
    marginTop: TRANSCRIPTION_GAP * open.get(),
    paddingTop: TRANSCRIPTION_PADDING_TOP * open.get(),
  }))

  return (
    <Animated.View
      style={[
        styles.transcription,
        { width, backgroundColor: isIncoming ? theme.colors.incomingBubble : theme.colors.outgoingBubble },
        bubbleStyle,
      ]}
    >
      <TranscriptionText
        text={text}
        isOpen={isOpen}
        color={isIncoming ? theme.colors.incomingText : theme.colors.outgoingText}
      />
    </Animated.View>
  )
}
