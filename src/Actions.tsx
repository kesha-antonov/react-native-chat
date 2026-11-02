import React, { ReactNode, useCallback, useState } from 'react'
import {
  StyleSheet,
  View,
  StyleProp,
  ViewStyle,
  TextStyle } from 'react-native'
import { AttachmentAction, AttachmentSheet } from './components/AttachmentSheet'
import { Icon } from './components/Icon'
import { PaperclipIcon } from './components/MediaControls'
import { TouchableOpacity } from './components/TouchableOpacity'
import { useLabels } from './hooks/useLabels'
import { useThemedStyles } from './hooks/useTheme'
import stylesCommon from './styles'
import { ChatTheme } from './Theme'

export interface ActionsProps {
  /** Actions shown in the attachment sheet. Add `icon`/`color` for a grid layout. */
  actions?: AttachmentAction[]
  /** Tint color for the action labels in the sheet (defaults to the theme accent). */
  actionSheetOptionTintColor?: string
  icon?: () => ReactNode
  wrapperStyle?: StyleProp<ViewStyle>
  iconTextStyle?: StyleProp<TextStyle>
  buttonStyle?: StyleProp<ViewStyle>
  onPressActionButton?(): void
}

export function Actions ({
  actions,
  actionSheetOptionTintColor,
  icon,
  wrapperStyle,
  onPressActionButton,
  buttonStyle,
}: ActionsProps) {
  const styles = useThemedStyles(createStyles)
  const labels = useLabels()
  const [isSheetVisible, setIsSheetVisible] = useState(false)

  const handlePress = useCallback(() => {
    if (onPressActionButton) {
      onPressActionButton()
      return
    }

    if (actions?.length)
      setIsSheetVisible(true)
  }, [actions, onPressActionButton])

  const renderIcon = useCallback(() => {
    if (icon)
      return icon()

    const size = styles.iconText.fontSize
    return (
      <View style={[stylesCommon.centerItems, wrapperStyle]}>
        <Icon name='paperclip' color={styles.iconText.color} size={size} fallback={<PaperclipIcon color={styles.iconText.color} size={size} />} />
      </View>
    )
  }, [icon, wrapperStyle, styles])

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={handlePress}
        hitSlop={8}
        accessibilityRole='button'
        accessibilityLabel={labels.attachButton}
        style={[styles.button, buttonStyle]}
      >
        {renderIcon()}
      </TouchableOpacity>
      {/* The sheet only serves `actions`. With a press handler (the built-in attachment menu) it
        can never open, and a native sheet mounted in every composer for nothing slowed each
        chat opening. */}
      {!onPressActionButton && !!actions?.length && (
        <AttachmentSheet
          visible={isSheetVisible}
          actions={actions}
          onClose={() => setIsSheetVisible(false)}
          tintColor={actionSheetOptionTintColor}
        />
      )}
    </View>
  )
}

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The paperclip takes a 44 cell inside the composer island.
  button: {
    width: 44,
    height: theme.composer.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Inset attachment icon: borderless, in the island's icon color (`glass_defaultIcon`).
  iconText: {
    color: theme.colors.composerIcon,
    fontWeight: 'bold',
    fontSize: 24,
    lineHeight: 24,
  },
})
