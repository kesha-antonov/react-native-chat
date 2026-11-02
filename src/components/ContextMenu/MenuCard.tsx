import React, { useEffect } from 'react'
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native'
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

import { MessageMenuItem } from '../../Models'
import { ChatTheme } from '../../Theme'
import {
  DECELERATE,
  ICON_SIZE,
  REDUCE_MOTION,
  ROW_IN_MS,
  ROW_SHIFT,
  timing,
} from './constants'
import { Styles } from './styles'

const MenuRow = ({
  item,
  index,
  revealMs,
  rowCount,
  hasIcons,
  onPress,
  styles,
  theme,
}: {
  item: MessageMenuItem
  index: number
  revealMs: number
  rowCount: number
  hasIcons: boolean
  onPress: (onPress: () => void) => void
  styles: Styles
  theme: ChatTheme
}) => {
  // Each row comes in as the unrolling card reaches it.
  const appear = useSharedValue(0)
  useEffect(() => {
    appear.set(withDelay(revealMs * index / Math.max(1, rowCount), withTiming(1, timing(ROW_IN_MS, DECELERATE)), REDUCE_MOTION))
  }, [appear, revealMs, index, rowCount])
  const appearStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ translateY: -ROW_SHIFT * (1 - appear.value) }],
  }))
  const color = item.destructive ? theme.contextMenu.destructive : theme.contextMenu.icon
  const textColor = item.destructive ? theme.contextMenu.destructive : theme.contextMenu.text

  return (
    <Animated.View style={appearStyle}>
      <Pressable
        onPress={() => onPress(item.onPress)}
        accessibilityRole='button'
        accessibilityLabel={item.label}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        {item.icon && (
          <View style={styles.iconSlot} pointerEvents='none'>
            {item.icon({ color, size: ICON_SIZE })}
          </View>
        )}
        <Text
          style={[styles.rowLabel, hasIcons && styles.rowLabelWithIcon, { color: textColor }]}
          numberOfLines={1}
        >
          {item.label}
        </Text>
      </Pressable>
    </Animated.View>
  )
}

/** The action card: unrolls from the top, and fades away while the reactions panel is open. */
export const MenuCard = ({
  items,
  revealMs,
  top,
  left,
  isExpanded,
  reveal,
  menuFade,
  onLayout,
  onPress,
  styles,
  theme,
}: {
  items: MessageMenuItem[]
  revealMs: number
  top: number
  left: number
  isExpanded: boolean
  reveal: SharedValue<number>
  menuFade: SharedValue<number>
  onLayout: (event: LayoutChangeEvent) => void
  onPress: (onPress: () => void) => void
  styles: Styles
  theme: ChatTheme
}) => {
  const rowCount = items.length
  const menuBackgroundStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: Math.max(0.0001, reveal.value) }],
    opacity: Math.min(1, reveal.value * 2),
  }))
  const menuFadeStyle = useAnimatedStyle(() => ({ opacity: menuFade.value }))
  const hasIcons = items.some(item => !!item.icon)

  return (
    <Animated.View
      style={[styles.menu, { top, left }, menuFadeStyle]}
      pointerEvents={isExpanded ? 'none' : 'box-none'}
    >
      <Animated.View style={[styles.menuBackground, { transformOrigin: 'center top' }, menuBackgroundStyle]} />
      <View style={styles.menuClip} onLayout={onLayout}>
        {items.map((item, index) => (
          <MenuRow
            key={`${item.key ?? item.label}-${index}`}
            item={item}
            index={index}
            revealMs={revealMs}
            rowCount={rowCount}
            hasIcons={hasIcons}
            onPress={onPress}
            styles={styles}
            theme={theme}
          />
        ))}
      </View>
    </Animated.View>
  )
}
