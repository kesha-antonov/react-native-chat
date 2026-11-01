import React from 'react'
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'

import { useThemedStyles } from '../hooks/useTheme'
import { ChatTheme } from '../Theme'
import { Spinner } from './Spinner'

/** The service circle: 36 across, radius 18. */
export const SERVICE_SPINNER_SIZE = 36
/** The spinner inside it: a 28 arc. */
const ARC_SIZE = 28

export interface ServiceSpinnerProps {
  style?: StyleProp<ViewStyle>
  /** Arc color; defaults to the date pill's text color. */
  color?: string
  /** Circle color; defaults to the date pill's background. */
  backgroundColor?: string
}

/**
 * The loading spinner on the wallpaper: a `Spinner` in the chat's service color circle. Drawn
 * while history loads and at the top of the list while earlier messages load.
 */
export function ServiceSpinner ({ style, color, backgroundColor }: ServiceSpinnerProps) {
  const styles = useThemedStyles(createStyles)

  return (
    <View
      testID='service-spinner'
      accessibilityRole='progressbar'
      accessibilityLabel='loading'
      style={[styles.circle, backgroundColor != null && { backgroundColor }, style]}
    >
      <Spinner size={ARC_SIZE} strokeWidth={3} color={color ?? styles.arc.color} />
    </View>
  )
}

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  circle: {
    width: SERVICE_SPINNER_SIZE,
    height: SERVICE_SPINNER_SIZE,
    borderRadius: SERVICE_SPINNER_SIZE / 2,
    backgroundColor: theme.colors.dayPillBackground,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  arc: {
    color: theme.colors.dayPillText,
  },
})
