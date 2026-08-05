import React from 'react'
import { KeyboardAvoidingView, KeyboardAvoidingViewProps } from 'react-native-keyboard-controller'
import stylesCommon from '../styles'

interface ChatKeyboardAvoidingViewProps {
  children: React.ReactNode
  /**
   * How far down the window the chat starts, measured by the container above us
   * (see `useKeyboardVerticalOffset`).
   */
  keyboardVerticalOffset: number
  /** Consumer overrides, applied last so `keyboardVerticalOffset` can be replaced. */
  keyboardAvoidingViewProps?: KeyboardAvoidingViewProps
}

/**
 * Keeps the input toolbar above the keyboard.
 *
 * Split out of `Chat` so the offset can be measured on the container and handed
 * down, keeping the subscription out of the chat's own render path.
 */
export function ChatKeyboardAvoidingView ({
  children,
  keyboardVerticalOffset,
  keyboardAvoidingViewProps,
}: ChatKeyboardAvoidingViewProps) {
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
