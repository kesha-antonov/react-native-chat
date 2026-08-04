import React from 'react'
import { KeyboardAvoidingView, KeyboardAvoidingViewProps } from 'react-native-keyboard-controller'
import { useKeyboardVerticalOffset } from '../hooks/useKeyboardVerticalOffset'
import stylesCommon from '../styles'

interface ChatKeyboardAvoidingViewProps {
  children: React.ReactNode
  /** Consumer overrides, applied last so `keyboardVerticalOffset` can be replaced. */
  keyboardAvoidingViewProps?: KeyboardAvoidingViewProps
}

/**
 * Keeps the input toolbar above the keyboard.
 *
 * Split out of `Chat` so the frame subscription behind `keyboardVerticalOffset` lives
 * in a leaf: only this wrapper re-renders when the chat is re-measured.
 */
export function ChatKeyboardAvoidingView ({
  children,
  keyboardAvoidingViewProps,
}: ChatKeyboardAvoidingViewProps) {
  const keyboardVerticalOffset = useKeyboardVerticalOffset()

  return (
    <KeyboardAvoidingView
      behavior='translate-with-padding'
      keyboardVerticalOffset={keyboardVerticalOffset}
      style={stylesCommon.fill}
      {...keyboardAvoidingViewProps}
    >
      {children}
    </KeyboardAvoidingView>
  )
}
