import React, { useEffect } from 'react'
import { Pressable, Text } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { Icon } from '../../components/Icon'
import { CameraIcon, PinIcon } from '../../components/MediaControls'
import { ChatTheme } from '../../Theme'
import { AttachmentTab } from '../types'
import {
  DECELERATE,
  EASE_BOTH,
  EASE_IN,
  EASE_OUT,
  REDUCE_MOTION,
  TAB_ICON,
  TAB_ICONS,
  TAB_SELECT_MS,
  TAB_STAGGER_MS,
} from './constants'
import { Styles } from './styles'

export const TabButton = ({ tab, index, label, width, isSelected, onPress, styles, theme }: {
  tab: AttachmentTab
  index: number
  label: string
  width: number
  isSelected: boolean
  onPress: (tab: AttachmentTab) => void
  styles: Styles
  theme: ChatTheme
}) => {
  const appear = useSharedValue(0)
  const fade = useSharedValue(0)
  useEffect(() => {
    const delay = 20 + TAB_STAGGER_MS * Math.max(0, 3 - index)
    appear.set(withDelay(delay, withSequence(
      withTiming(1.1, { duration: 200, easing: EASE_OUT, reduceMotion: REDUCE_MOTION }),
      withTiming(1, { duration: 100, easing: EASE_IN, reduceMotion: REDUCE_MOTION })
    ), REDUCE_MOTION))
    fade.set(withDelay(delay, withTiming(1, { duration: 200, easing: EASE_BOTH, reduceMotion: REDUCE_MOTION }), REDUCE_MOTION))
  }, [appear, fade, index])
  const selected = useSharedValue(isSelected ? 1 : 0)
  useEffect(() => {
    selected.set(withTiming(isSelected ? 1 : 0, { duration: TAB_SELECT_MS, easing: DECELERATE, reduceMotion: REDUCE_MOTION }))
  }, [isSelected, selected])
  const appearStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ scale: appear.value }],
  }))
  const capsuleStyle = useAnimatedStyle(() => ({
    opacity: selected.value,
    transform: [{ scale: 0.6 + 0.4 * selected.value }],
  }))
  const color = isSelected ? theme.attachments.tabSelected : theme.attachments.tabText

  return (
    <Pressable
      onPress={() => onPress(tab)}
      style={[styles.tab, { width }]}
      accessibilityRole='tab'
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.tabInner, appearStyle]}>
        <Animated.View style={[styles.tabCapsule, capsuleStyle]} />
        <Icon
          name={TAB_ICONS[tab]}
          color={color}
          size={TAB_ICON}
          fallback={tab === 'location' ? <PinIcon color={color} size={TAB_ICON} /> : <CameraIcon color={color} size={TAB_ICON} />}
        />
        <Text
          style={[styles.tabLabel, { color: isSelected ? theme.attachments.tabSelectedText : theme.attachments.tabText }, isSelected && styles.tabLabelSelected]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  )
}
