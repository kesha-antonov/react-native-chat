import React from 'react'
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native'

import { ReactionIconPlace, RenderReactionIcon } from './types'

/**
 * One reaction's picture, wherever a reaction is drawn (a pill, the reactions bar, the pick
 * flying to the message): what `reactions.renderReactionIcon` returns, or the key as text when
 * there is no renderer or it returns nothing. One component, so every place asks the app the
 * same way.
 */
export const ReactionIcon = ({
  emoji,
  place,
  size,
  color,
  isChosen,
  renderReactionIcon,
  style,
  textStyle,
  allowFontScaling,
}: {
  emoji: string
  place: ReactionIconPlace
  /** The emoji's font size there: an icon of this size stands in for the emoji. */
  size: number
  color: string
  isChosen: boolean
  renderReactionIcon?: RenderReactionIcon
  /** For the icon's box: centers it, and carries a transform such as the bar's smaller chosen look. */
  style?: StyleProp<ViewStyle>
  /** For the text fallback. */
  textStyle?: StyleProp<TextStyle>
  allowFontScaling?: boolean
}) => {
  const icon = renderReactionIcon?.({ emoji, place, size, color, isChosen })

  if (icon == null)
    return <Text style={textStyle} allowFontScaling={allowFontScaling}>{emoji}</Text>

  // The pill, button or flight around it already names the reaction for screen readers.
  return (
    <View
      style={[styles.box, style]}
      accessibilityElementsHidden
      importantForAccessibility='no-hide-descendants'
      pointerEvents='none'
    >
      {icon}
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
