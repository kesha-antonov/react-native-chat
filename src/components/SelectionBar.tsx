import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useLabels } from '../hooks/useLabels'
import { useTheme, useThemedStyles } from '../hooks/useTheme'
import { IconName } from '../Icons'
import { ChatTheme } from '../Theme'
import { GlassSurface } from './GlassSurface'
import { Icon } from './Icon'
import { CloseIcon, TrashIcon } from './MediaControls'

export interface SelectionBarAction {
  key: 'copy' | 'forward' | 'delete'
  onPress: () => void
}

export interface SelectionBarProps {
  count: number
  onClose: () => void
  actions: SelectionBarAction[]
}

const ICONS: Record<SelectionBarAction['key'], IconName> = {
  copy: 'copy',
  forward: 'forward',
  delete: 'trash',
}

/**
 * Telegram Android's selection mode bar (`actionBar.createActionMode`): a close button, the
 * number of checked messages, and Copy / Forward / Delete. It takes the composer's place, in the
 * same floating island.
 */
export function SelectionBar ({ count, onClose, actions }: SelectionBarProps) {
  const styles = useThemedStyles(createStyles)
  const theme = useTheme()
  const labels = useLabels()
  const insets = useSafeAreaInsets()
  const iconColor = theme.colors.composerIcon

  const labelFor: Record<SelectionBarAction['key'], string> = {
    copy: labels.actionCopy,
    forward: labels.actionForward,
    delete: labels.actionDelete,
  }

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      style={[styles.container, { paddingBottom: theme.spacing.inputToolbarPaddingV + insets.bottom }]}
      testID='selection-bar'
    >
      <View style={styles.island}>
        <GlassSurface color={theme.colors.inputBackground} borderColor={theme.colors.inputFieldBorder} style={styles.islandSurface} />
        <Pressable
          onPress={onClose}
          style={styles.button}
          hitSlop={4}
          accessibilityRole='button'
          accessibilityLabel={labels.cancelSelection}
        >
          <Icon name='close' size={24} color={iconColor} fallback={<CloseIcon color={iconColor} size={20} />} />
        </Pressable>
        <Text style={styles.count} numberOfLines={1} accessibilityLiveRegion='polite'>{count}</Text>
        {actions.map(action => (
          <Pressable
            key={action.key}
            onPress={action.onPress}
            style={styles.button}
            hitSlop={4}
            accessibilityRole='button'
            accessibilityLabel={labelFor[action.key]}
          >
            <Icon
              name={ICONS[action.key]}
              size={24}
              color={iconColor}
              fallback={action.key === 'delete'
                ? <TrashIcon color={iconColor} size={22} />
                : <Text style={[styles.fallbackLabel, { color: iconColor }]}>{labelFor[action.key]}</Text>}
            />
          </Pressable>
        ))}
      </View>
    </Animated.View>
  )
}

// The composer island's frame (44 tall, radius 22, 7 from the sides, 9 above the inset); the
// action mode's count is 18dp medium (`selectedMessagesCountTextView`), its buttons 48 wide.
const createStyles = (theme: ChatTheme) => StyleSheet.create({
  container: {
    paddingTop: 4,
    paddingLeft: theme.spacing.screenEdge.left,
    paddingRight: theme.spacing.screenEdge.right,
  },
  island: {
    minHeight: theme.composer.minHeight,
    borderRadius: theme.radii.inputField,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  islandSurface: {
    borderRadius: theme.radii.inputField,
  },
  button: {
    width: 48,
    height: theme.composer.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    flex: 1,
    marginLeft: 4,
    fontSize: 18,
    fontWeight: '500',
    color: theme.colors.inputText,
    textAlign: 'left',
  },
  fallbackLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
})
