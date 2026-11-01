import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useTheme } from '../hooks/useTheme'
import { Icon } from './Icon'

/** `new CheckBoxBase(this, 21)` in `ChatMessageCell.setCheckBoxVisible`. */
export const SELECTION_CHECKBOX_SIZE = 21

/**
 * The round check beside a message in selection mode (`CheckBoxBase`, default style): empty, a
 * white ring over a faint service-colored disc; checked, a filled `checkbox` disc with a white
 * check.
 */
export function SelectionCheckbox ({ isChecked }: { isChecked: boolean }) {
  const theme = useTheme()

  return (
    <View
      style={[
        styles.circle,
        { borderColor: theme.colors.selectionCheckboxCheck },
        isChecked
          ? { backgroundColor: theme.colors.selectionCheckbox, borderColor: theme.colors.selectionCheckbox }
          : styles.empty,
      ]}
      accessibilityRole='checkbox'
      accessibilityState={{ checked: isChecked }}
    >
      {isChecked && (
        <Icon
          name='check'
          size={14}
          color={theme.colors.selectionCheckboxCheck}
          fallback={<Text style={[styles.fallbackCheck, { color: theme.colors.selectionCheckboxCheck }]}>✓</Text>}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  // A 1.2dp ring (`backgroundPaint.setStrokeWidth(dp(1.2f))`).
  circle: {
    width: SELECTION_CHECKBOX_SIZE,
    height: SELECTION_CHECKBOX_SIZE,
    borderRadius: SELECTION_CHECKBOX_SIZE / 2,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // `(serviceMessageColor & 0xffffff) | 0x28000000`: the service color at 16%.
  empty: {
    backgroundColor: 'rgba(0, 0, 0, 0.157)',
  },
  fallbackCheck: {
    fontSize: 13,
    fontWeight: '700',
  },
})
