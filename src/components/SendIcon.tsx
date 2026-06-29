import React, { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

export interface SendIconProps {
  color?: string
  /** Overall icon box size; the glyph scales to fit. Defaults to 20. */
  size?: number
}

/**
 * Dependency-free fallback send glyph (used when react-native-svg is not
 * installed; otherwise the Lucide "send" icon is rendered via the Icon
 * resolver). A triangle tilted to point up-and-to-the-right.
 */
export const SendIcon = ({ color = '#fff', size = 20 }: SendIconProps) => {
  const styles = useMemo(() => createStyles(color, size), [color, size])

  return (
    <View style={styles.container}>
      <View style={styles.triangle} />
    </View>
  )
}

const createStyles = (color: string, size: number) => {
  const side = size * 0.82

  return StyleSheet.create({
    container: {
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
      transform: [{ rotate: '-45deg' }],
    },
    triangle: {
      width: 0,
      height: 0,
      borderTopWidth: side / 2,
      borderBottomWidth: side / 2,
      borderLeftWidth: side,
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
      borderLeftColor: color,
      marginLeft: size * 0.16,
    },
  })
}
