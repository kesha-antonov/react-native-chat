import React from 'react'
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'

import { withAlpha } from '../colorUtils'
import { useColorScheme } from '../hooks/useColorScheme'
import { getExpoBlur } from '../optional'

export interface GlassSurfaceProps {
  /** The translucent fill; drawn opaque when there is no blur behind it. */
  color: string
  /** The thin light edge around the surface. */
  borderColor?: string
  style?: StyleProp<ViewStyle>
}

// `BlurredBackgroundColorProviderThemed`: a light surface carries a faint drop
// (#20000000, radius 1, dy 0.333); a dark one none.
const LIGHT_SHADOW = [{ offsetX: 0, offsetY: 0.333, blurRadius: 1, color: 'rgba(0, 0, 0, 0.125)' }]

/**
 * Telegram 13's "glass" surface (`BlurredBackgroundDrawable`): a blur of what is behind it
 * under its fill at 85%, with a thin light stroke. Without `expo-blur` the fill is drawn
 * opaque, as Telegram does with blur off. Fills its parent; give the parent the shape.
 */
export const GlassSurface = ({ color, borderColor, style }: GlassSurfaceProps) => {
  const colorScheme = useColorScheme()
  const BlurView = getExpoBlur()?.BlurView
  const isDark = colorScheme === 'dark'

  return (
    <View
      pointerEvents='none'
      style={[
        StyleSheet.absoluteFill,
        styles.clip,
        !isDark && { boxShadow: LIGHT_SHADOW },
        style,
      ]}
    >
      {BlurView && (
        <BlurView
          style={StyleSheet.absoluteFill}
          intensity={isDark ? 40 : 30}
          tint={isDark ? 'dark' : 'light'}
        />
      )}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: BlurView ? color : withAlpha(color, 1) },
          !!borderColor && { borderColor, borderWidth: 0.667 },
          style,
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
})
