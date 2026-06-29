import React, { useMemo, useCallback } from 'react'
import {
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
  View } from 'react-native'

import { Icon } from './components/Icon'
import { SendIcon } from './components/SendIcon'
import { TouchableOpacity, TouchableOpacityProps } from './components/TouchableOpacity'
import { TEST_ID } from './Constant'
import { useTheme, useThemedStyles } from './hooks/useTheme'
import { IMessage } from './Models'
import { ChatTheme } from './Theme'

export interface SendProps<TMessage extends IMessage> {
  text?: string
  label?: string
  containerStyle?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  children?: React.ReactNode
  /** Kept for API compatibility; the send button is always visible now. */
  isSendButtonAlwaysVisible?: boolean
  /** Text is optional, allow sending empty messages (useful for media-only messages) */
  isTextOptional?: boolean
  sendButtonProps?: Partial<TouchableOpacityProps>
  onSend?(
    messages: Partial<TMessage> | Partial<TMessage>[],
    shouldResetInputToolbar: boolean,
  ): void
}

export const Send = <TMessage extends IMessage = IMessage>({
  text,
  containerStyle,
  children,
  isTextOptional = false,
  sendButtonProps,
  onSend,
}: SendProps<TMessage>) => {
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)

  // The button is always visible. It's "active" (accent) when there's something
  // to send, and "inactive" (gray, non-functional) otherwise - so the right
  // slot is never empty when no voice/video/stop control takes its place.
  const canSend = useMemo(
    () => !!text?.trim().length || isTextOptional,
    [text, isTextOptional]
  )

  const handleOnPress = useCallback(() => {
    const trimmedText = text?.trim() ?? ''
    const message = { text: trimmedText } as Partial<TMessage>

    if (onSend && (trimmedText.length || isTextOptional))
      onSend(message, true)
  }, [text, onSend, isTextOptional])

  const { size } = theme.sendButton

  return (
    <View style={[styles.container, containerStyle]}>
      <TouchableOpacity
        testID={TEST_ID.SEND_TOUCHABLE}
        style={styles.touchable}
        onPress={handleOnPress}
        enabled={canSend}
        accessible
        accessibilityLabel='send'
        accessibilityRole='button'
        accessibilityState={{ disabled: !canSend }}
        {...sendButtonProps}
      >
        {
          children ||
          <View style={[styles.circle, !canSend && styles.circleInactive]}>
            <Icon name='send' color='#fff' size={size * 0.5} fallback={<SendIcon color='#fff' size={size * 0.5} />} />
          </View>
        }
      </TouchableOpacity>
    </View>
  )
}

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  // Center the button against the single-line field height. The toolbar row is
  // bottom-aligned, so giving the button the field's min-height keeps it centered
  // when the field is one line and aligned with the last line when it grows.
  container: {
    minHeight: theme.composer.minHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  touchable: {
    justifyContent: 'center',
  },
  circle: {
    width: theme.sendButton.size,
    height: theme.sendButton.size,
    borderRadius: theme.radii.sendButton,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Muted, non-functional state shown when there's nothing to send.
  circleInactive: {
    backgroundColor: theme.colors.incomingMeta,
  },
})
