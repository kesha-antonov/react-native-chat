import React, { useCallback, useEffect, useState } from 'react'
import {
  StyleSheet,
  TextInputContentSizeChangeEvent,
  TextInputProps,
  View,
} from 'react-native'
import { TextInput } from 'react-native-gesture-handler'
import { useColorScheme } from './hooks/useColorScheme'
import { useLabels } from './hooks/useLabels'
import { useTheme, useThemedStyles } from './hooks/useTheme'
import { ChatTheme } from './Theme'

export interface ComposerProps {
  composerHeight?: number
  text?: string
  textInputProps?: Partial<TextInputProps>
}

// Static text-input metrics. lineHeight matches typography.message.lineHeight
// (21) so composed text and sent bubbles share identical metrics. The vertical
// padding is derived from the bar height (see createStyles) so a single line of
// text is vertically centered in the field.
const TEXT_INPUT_METRICS = {
  fontSize: 16,
  lineHeight: 21,
}

export function Composer ({
  text = '',
  textInputProps,
}: ComposerProps): React.ReactElement {
  const colorScheme = useColorScheme()
  const theme = useTheme()
  const labels = useLabels()
  const styles = useThemedStyles(createStyles)
  const isDark = colorScheme === 'dark'

  const maxHeight = theme.composer.maxHeight
  const placeholder = textInputProps?.placeholder ?? labels.placeholder

  // A single line fills the bar height so its text sits centered (symmetric
  // padding); it grows from there up to maxHeight.
  const ONE_LINE = theme.composer.minHeight

  const [height, setHeight] = useState<number>(ONE_LINE)

  // Grow with content up to maxHeight, then scroll internally. Works on native
  // (previously only web capped growth), so a long paste no longer pushes the
  // whole bar up the screen.
  const handleContentSizeChange = useCallback((e: TextInputContentSizeChangeEvent) => {
    const contentHeight = e.nativeEvent.contentSize.height
    setHeight(Math.min(maxHeight, Math.max(ONE_LINE, contentHeight)))
  }, [maxHeight, ONE_LINE])

  // Reset to a single line once the text is cleared (e.g. after sending), so the
  // field doesn't stay expanded at the height of the previous multiline message.
  useEffect(() => {
    if (text.length === 0)
      setHeight(ONE_LINE)
  }, [text, ONE_LINE])

  const atMax = height >= maxHeight

  return (
    <View style={styles.field}>
      <TextInput
        testID={placeholder}
        accessible
        accessibilityLabel={placeholder}
        placeholderTextColor={textInputProps?.placeholderTextColor ?? theme.colors.placeholder}
        value={text}
        enablesReturnKeyAutomatically
        underlineColorAndroid='transparent'
        keyboardAppearance={isDark ? 'dark' : 'default'}
        multiline
        scrollEnabled={atMax}
        placeholder={placeholder}
        onContentSizeChange={handleContentSizeChange}
        {...textInputProps}
        style={[styles.textInput, stylesWeb.textInput, { height }, textInputProps?.style]}
      />
    </View>
  )
}

const createStyles = (theme: ChatTheme) => {
  // Center a single line vertically: split the leftover space (bar height minus
  // one line of text) into equal top/bottom padding.
  const paddingVertical = Math.max(4, (theme.composer.minHeight - TEXT_INPUT_METRICS.lineHeight) / 2)

  return StyleSheet.create({
    // Transparent slot: the rounded pill is provided by the InputToolbar field
    // group so the inset emoji/attachment buttons share the pill surface.
    field: {
      flex: 1,
      justifyContent: 'center',
      minHeight: theme.composer.minHeight,
    },
    textInput: {
      fontSize: TEXT_INPUT_METRICS.fontSize,
      lineHeight: TEXT_INPUT_METRICS.lineHeight,
      paddingTop: paddingVertical,
      paddingBottom: paddingVertical,
      paddingHorizontal: 0,
      color: theme.colors.inputText,
    },
  })
}

const stylesWeb = StyleSheet.create({
  textInput: {
    /* @ts-expect-error - web-specific styles */
    outlineStyle: 'none',
  },
})
