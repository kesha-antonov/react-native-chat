import React, { useMemo, useCallback, useEffect } from 'react'
import {
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
  View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { Icon } from './components/Icon'
import { SendIcon } from './components/SendIcon'
import { TouchableOpacity, TouchableOpacityProps } from './components/TouchableOpacity'
import { TEST_ID } from './Constant'
import { useIcons } from './hooks/useIcons'
import { useTheme, useThemedStyles } from './hooks/useTheme'
import { IMessage } from './Models'
import { getSvg } from './optional'
import { ChatTheme } from './Theme'

const svg = getSvg()
const Svg: any = svg ? svg.default ?? svg.Svg : null
const Path: any = svg?.Path

// A solid paper plane pointing right.
const PLANE = 'M3.4 20.3 L21.2 12.6 a0.65 0.65 0 0 0 0 -1.2 L3.4 3.7 a0.7 0.7 0 0 0 -1 0.75 L3.9 10.6 L14.5 12 L3.9 13.4 L2.4 19.55 a0.7 0.7 0 0 0 1 0.75 Z'

// The send button grows in from 0.1 as text appears and shrinks away with it, over 220ms
// on EASE_OUT_QUINT.
const MORPH = { duration: 220, easing: Easing.bezier(0.23, 1, 0.32, 1) }

const PlaneIcon = ({ color, size }: { color: string, size: number }) => {
  const icons = useIcons()

  if (icons.send || !(Svg && Path))
    return <Icon name='send' color={color} size={size} fallback={<SendIcon color={color} size={size} />} />

  return (
    <Svg width={size} height={size} viewBox='0 0 24 24'>
      <Path d={PLANE} fill={color} />
    </Svg>
  )
}

export interface SendProps<TMessage extends IMessage> {
  text?: string
  label?: string
  containerStyle?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  children?: React.ReactNode
  /** Keep the send button showing even when there is nothing to send. */
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
  isSendButtonAlwaysVisible = false,
  sendButtonProps,
  onSend,
}: SendProps<TMessage>) => {
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)

  const canSend = useMemo(
    () => !!text?.trim().length || isTextOptional,
    [text, isTextOptional]
  )

  // No greyed-out send button: it is only there while there is something to send.
  const isShown = canSend || isSendButtonAlwaysVisible
  const shown = useSharedValue(isShown ? 1 : 0)
  useEffect(() => {
    shown.value = withTiming(isShown ? 1 : 0, MORPH)
  }, [isShown, shown])
  const circleStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ scale: 0.1 + 0.9 * shown.value }],
  }))

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
          <Animated.View style={[styles.circle, !canSend && styles.circleInactive, circleStyle]}>
            <PlaneIcon color='#fff' size={Math.round(size * 0.62)} />
          </Animated.View>
        }
      </TouchableOpacity>
    </View>
  )
}

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  // A 44 cell at the island's end; the button is bottom-aligned with the last line of text.
  container: {
    minHeight: theme.composer.minHeight,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  touchable: {
    justifyContent: 'center',
  },
  // A solid 36 circle in the accent color.
  circle: {
    width: theme.sendButton.size,
    height: theme.sendButton.size,
    borderRadius: theme.radii.sendButton,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Shown (by `isSendButtonAlwaysVisible`) with nothing to send.
  circleInactive: {
    backgroundColor: theme.colors.placeholder,
  },
})
