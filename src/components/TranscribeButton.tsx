import React, { useCallback, useEffect, useState } from 'react'
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import {
  TRANSCRIBE_BUTTON_HEIGHT,
  TRANSCRIBE_BUTTON_RADIUS,
  TRANSCRIBE_BUTTON_WIDTH,
} from './voiceWaveform'

// TranscribeButton's `loadingFloat`: the loading outline fades over 250ms,
// eased out-quint.
const LOADING_FADE_MS = 250
const EASE_OUT_QUINT = Easing.bezier(0.23, 1, 0.32, 1)
// While loading, a dashed outline breathes on the beat of a stroke segment
// running round it.
const LOADING_PULSE_MS = 650
// The transcription opens with the bubble's height change
// (`transitionParams.animateChangeProgress`, about 220ms) and fades in with it.
const OPEN_MS = 220
// The button is filled with its color at 0.156 alpha.
const BACKGROUND_ALPHA = 0.156

export type TranscribeTapAction = 'none' | 'request' | 'collapse' | 'expand'

/**
 * What a tap on the transcribe button does. It ignores taps while a
 * transcription is loading, asks for one when there
 * is none yet, and otherwise toggles the text.
 */
export const transcribeTapAction = ({
  hasTranscription,
  isOpen,
  isLoading,
}: {
  hasTranscription: boolean
  isOpen: boolean
  isLoading: boolean
}): TranscribeTapAction => {
  if (isLoading)
    return 'none'
  if (!hasTranscription)
    return 'request'
  return isOpen ? 'collapse' : 'expand'
}

/**
 * Transcription state for one voice note. The button shows when the app can
 * transcribe (`onTranscribe`) or the message already carries a transcription.
 * Asking for one shows the loading outline until `transcription` arrives, and
 * then opens it.
 */
export const useTranscription = <TMessage, >(
  message: TMessage | undefined,
  messageId: string | number | undefined,
  transcription: string | undefined,
  onTranscribe: ((message: TMessage) => void) | undefined
) => {
  const [isOpen, setIsOpen] = useState(false)
  // Keyed by message: a recycled row must not inherit another note's request.
  const [requestedFor, setRequestedFor] = useState<string | number | undefined | null>(null)
  const hasTranscription = !!transcription
  const isRequested = requestedFor != null && requestedFor === messageId
  const isLoading = isRequested && !hasTranscription

  useEffect(() => {
    if (isRequested && hasTranscription) {
      setIsOpen(true)
      setRequestedFor(null)
    }
  }, [isRequested, hasTranscription])

  useEffect(() => {
    setIsOpen(false)
  }, [messageId])

  const onPress = useCallback(() => {
    const action = transcribeTapAction({ hasTranscription, isOpen, isLoading })
    if (action === 'request') {
      if (!message || !onTranscribe || messageId == null)
        return
      setRequestedFor(messageId)
      onTranscribe(message)
    } else if (action !== 'none') {
      setIsOpen(action === 'expand')
    }
  }, [hasTranscription, isOpen, isLoading, message, messageId, onTranscribe])

  return {
    isVisible: !!onTranscribe || hasTranscription,
    isOpen: isOpen && hasTranscription,
    isLoading,
    onPress,
  }
}

/**
 * The transcribe button, drawn as vectors: an arrow
 * into an "A" in a softly filled rounded rect. The arrow turns up once the
 * text is open, so the button reads as "collapse".
 */
export function TranscribeButton ({
  isOpen,
  isLoading,
  onPress,
  color,
}: {
  isOpen: boolean
  isLoading: boolean
  onPress: () => void
  color: string
}) {
  const turn = useSharedValue(isOpen ? 1 : 0)
  const loading = useSharedValue(isLoading ? 1 : 0)
  const pulse = useSharedValue(1)

  useEffect(() => {
    turn.value = withTiming(isOpen ? 1 : 0, { duration: OPEN_MS, easing: EASE_OUT_QUINT })
  }, [isOpen, turn])

  useEffect(() => {
    loading.value = withTiming(isLoading ? 1 : 0, { duration: LOADING_FADE_MS, easing: EASE_OUT_QUINT })
    if (isLoading) {
      pulse.value = 1
      pulse.value = withRepeat(withTiming(0.35, { duration: LOADING_PULSE_MS }), -1, true)
    } else {
      cancelAnimation(pulse)
    }
  }, [isLoading, loading, pulse])

  useEffect(() => () => {
    cancelAnimation(turn)
    cancelAnimation(loading)
    cancelAnimation(pulse)
  }, [turn, loading, pulse])

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-90 * turn.value}deg` }],
  }))
  const outlineStyle = useAnimatedStyle(() => ({
    opacity: loading.value * pulse.value,
  }))

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel='transcribe'
      accessibilityState={{ expanded: isOpen, busy: isLoading }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={buttonStyles.button}
    >
      <View pointerEvents='none' style={[buttonStyles.fill, { backgroundColor: color }]} />
      <Animated.View
        pointerEvents='none'
        testID='transcribe-loading'
        style={[buttonStyles.outline, { borderColor: color }, outlineStyle]}
      />
      <View pointerEvents='none' style={buttonStyles.glyph}>
        <Animated.View style={[buttonStyles.arrow, arrowStyle]}>
          <View style={[buttonStyles.shaft, { backgroundColor: color }]} />
          <View style={[buttonStyles.head, { borderColor: color }]} />
        </Animated.View>
        <Text style={[buttonStyles.letter, { color }]}>A</Text>
      </View>
    </Pressable>
  )
}

/**
 * The transcription under the waveform. It opens by growing to the text's
 * height while fading in, and closes the same way back.
 */
export function TranscriptionText ({
  text,
  isOpen,
  color,
}: {
  text: string | undefined
  isOpen: boolean
  color: string
}) {
  const open = useSharedValue(isOpen ? 1 : 0)
  const textHeight = useSharedValue(0)
  const [isMounted, setIsMounted] = useState(isOpen)

  useEffect(() => {
    if (isOpen)
      setIsMounted(true)
    open.value = withTiming(isOpen ? 1 : 0, { duration: OPEN_MS, easing: EASE_OUT_QUINT })
  }, [isOpen, open])

  useEffect(() => () => cancelAnimation(open), [open])

  const onTextLayout = useCallback((event: LayoutChangeEvent) => {
    textHeight.value = event.nativeEvent.layout.height
  }, [textHeight])

  const style = useAnimatedStyle(() => ({
    height: textHeight.value * open.value,
    opacity: open.value,
  }))

  if (!isMounted || !text)
    return null

  return (
    <Animated.View style={[textStyles.clip, style]}>
      {/* Absolute, so it lays out at its full height whatever the clip's. */}
      <View style={textStyles.measure} onLayout={onTextLayout}>
        <Text style={[textStyles.text, { color }]} selectable>{text}</Text>
      </View>
    </Animated.View>
  )
}

const ARROW_BOX = 9
const STROKE = 1.5
const HEAD = 5

const buttonStyles = StyleSheet.create({
  button: {
    width: TRANSCRIBE_BUTTON_WIDTH,
    height: TRANSCRIBE_BUTTON_HEIGHT,
    borderRadius: TRANSCRIBE_BUTTON_RADIUS,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: TRANSCRIBE_BUTTON_RADIUS,
    opacity: BACKGROUND_ALPHA,
  },
  outline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: TRANSCRIBE_BUTTON_RADIUS,
    borderWidth: STROKE,
    borderStyle: 'dashed',
  },
  glyph: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  arrow: {
    width: ARROW_BOX,
    height: ARROW_BOX,
  },
  shaft: {
    position: 'absolute',
    left: 0,
    top: (ARROW_BOX - STROKE) / 2,
    width: ARROW_BOX - 1,
    height: STROKE,
    borderRadius: STROKE / 2,
  },
  // A square's top and right edges turned 45 degrees make the arrowhead.
  head: {
    position: 'absolute',
    left: ARROW_BOX - HEAD * Math.SQRT2 / 2 - HEAD / 2 - 0.5,
    top: (ARROW_BOX - HEAD) / 2,
    width: HEAD,
    height: HEAD,
    borderTopWidth: STROKE,
    borderRightWidth: STROKE,
    transform: [{ rotate: '45deg' }],
  },
  letter: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
  },
})

const textStyles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  measure: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  text: {
    fontSize: 15,
    lineHeight: 20,
    // Under the row's own bottom padding; this one keeps the same gap below.
    paddingBottom: 6,
  },
})
