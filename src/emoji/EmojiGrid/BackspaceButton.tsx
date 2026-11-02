import React, { useCallback, useEffect, useRef } from 'react'
import { Pressable, Text } from 'react-native'

import { selectionHaptic } from '../../components/haptics'
import { Icon } from '../../components/Icon'
import { BACKSPACE_REPEAT_DELAY, BACKSPACE_REPEAT_MS } from './constants'
import { Styles } from './styles'

/** Repeats while held, like a keyboard's backspace. */
export const BackspaceButton = ({ onBackspace, styles, color, label, isRTL }: {
  onBackspace: () => void
  isRTL: boolean
  styles: Styles
  color: string
  label: string
}) => {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stop = useCallback(() => {
    if (timer.current)
      clearTimeout(timer.current)
    timer.current = null
  }, [])
  useEffect(() => stop, [stop])

  const start = useCallback(() => {
    onBackspace()
    const repeat = () => {
      onBackspace()
      selectionHaptic()
      timer.current = setTimeout(repeat, BACKSPACE_REPEAT_MS)
    }
    timer.current = setTimeout(repeat, BACKSPACE_REPEAT_DELAY)
  }, [onBackspace])

  return (
    <Pressable
      onPressIn={start}
      onPressOut={stop}
      style={[styles.backspace, isRTL && styles.backspaceRTL]}
      accessibilityRole='button'
      accessibilityLabel={label}
      hitSlop={6}
    >
      <Icon name='backspace' color={color} size={24} fallback={<Text style={[styles.backspaceFallback, { color }]}>{'⌫'}</Text>} />
    </Pressable>
  )
}
