import React from 'react'
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native'
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated'

import { ChatTheme } from '../../Theme'
import { Icon } from '../Icon'
import {
  BAR_CLIP,
  BAR_HEIGHT,
  BAR_PIVOT,
  ITEM_DELAY_SPREAD,
  PANEL_RADIUS,
  TAIL_BIG,
  TAIL_OFFSET,
  TAIL_SMALL,
} from './constants'
import { cellCenter } from './placement'
import { ReactionButton } from './ReactionButton'
import { Styles } from './styles'
import { ContextMenuReactions } from './types'

/** A drawn chevron for when react-native-svg (and so the built-in icon) is missing. */
const ChevronFallback = ({ color }: { color: string }) => (
  <View style={[chevronStyles.chevron, { borderColor: color }]} />
)

const chevronStyles = StyleSheet.create({
  chevron: {
    width: 8,
    height: 8,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    marginTop: -4,
    transform: [{ rotate: '45deg' }],
  },
})

/**
 * The reactions pill with its "thought bubble" tail, and the panel the expand button grows it
 * into.
 */
export const ReactionsBar = ({
  reactions,
  quickEmojis,
  flyingEmoji,
  hasExpand,
  isExpanded,
  isRTL,
  barLeft,
  barWidth,
  pillTop,
  panelLeft,
  panelTop,
  panelWidth,
  panelHeight,
  barIn,
  expand,
  onReaction,
  onExpand,
  onExpandedSelect,
  onAccessoryLayout,
  styles,
  theme,
}: {
  reactions?: ContextMenuReactions
  quickEmojis: string[]
  /** The emoji flying to the message, if any; its cell is left empty. */
  flyingEmoji?: string
  hasExpand: boolean
  isExpanded: boolean
  isRTL: boolean
  barLeft: number
  barWidth: number
  pillTop: number
  panelLeft: number
  panelTop: number
  panelWidth: number
  panelHeight: number
  barIn: SharedValue<number>
  expand: SharedValue<number>
  onReaction: (emoji: string, index: number) => void
  onExpand: () => void
  onExpandedSelect: (emoji: string) => void
  onAccessoryLayout: (event: LayoutChangeEvent) => void
  styles: Styles
  theme: ChatTheme
}) => {
  const selected = reactions?.selected

  // The bar grows from 87.5% across (12.5% in RTL) and is clipped from the far side.
  const barStyle = useAnimatedStyle(() => {
    const t = expand.value
    return {
      left: barLeft + (panelLeft - barLeft) * t,
      top: pillTop + (panelTop - pillTop) * t,
      width: barWidth + (panelWidth - barWidth) * t,
      height: BAR_HEIGHT + (panelHeight - BAR_HEIGHT) * t,
      transform: [{ scale: barIn.value }],
    }
  })
  const barClipStyle = useAnimatedStyle(() => {
    const visible = Math.min(1, Math.max(BAR_CLIP, barIn.value))
    return { width: `${100 * (visible + (1 - visible) * expand.value)}%` }
  })
  const barBackgroundStyle = useAnimatedStyle(() => ({
    borderRadius: BAR_HEIGHT / 2 + (PANEL_RADIUS - BAR_HEIGHT / 2) * expand.value,
  }))
  const barItemsStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, expand.value * 2) }))
  const tailStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, barIn.value) * (1 - expand.value) }))
  const panelContentStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, (expand.value - 0.25) / 0.75),
  }))

  const barOrigin = `${100 * (isRTL ? 1 - BAR_PIVOT : BAR_PIVOT)}% 50%`
  const tailX = isRTL ? barLeft + TAIL_OFFSET : barLeft + barWidth - TAIL_OFFSET
  const smallTailX = isRTL ? tailX - TAIL_BIG : tailX + TAIL_BIG

  return (
    <>
      <Animated.View style={[styles.tail, tailStyle]} pointerEvents='none'>
        <View style={[styles.tailBig, { left: tailX - TAIL_BIG, top: pillTop + BAR_HEIGHT - TAIL_BIG }]} />
        <View style={[styles.tailSmall, { left: smallTailX - TAIL_SMALL, top: pillTop + BAR_HEIGHT + 15 - TAIL_SMALL }]} />
      </Animated.View>
      <Animated.View style={[styles.bar, { transformOrigin: barOrigin }, barStyle]}>
        <Animated.View style={[styles.barClip, isRTL ? styles.alignStart : styles.alignEnd, barClipStyle]}>
          <Animated.View style={[styles.barBackground, reactions?.containerStyle, barBackgroundStyle]} />
          <Animated.View
            style={[styles.barItems, isRTL ? styles.barItemsRTL : styles.barItemsLTR, { width: barWidth }, barItemsStyle]}
            pointerEvents={isExpanded ? 'none' : 'box-none'}
          >
            {quickEmojis.map((emoji, index) => {
              const center = cellCenter(index, barLeft, barWidth, isRTL) - barLeft
              return (
                <ReactionButton
                  key={emoji}
                  emoji={emoji}
                  index={index}
                  delay={ITEM_DELAY_SPREAD * Math.abs(center / Math.max(1, barWidth) - (isRTL ? 0.2 : 0.8)) + 30 * index}
                  isSelected={!!selected?.includes(emoji)}
                  isHidden={flyingEmoji === emoji}
                  onPress={onReaction}
                  emojiStyle={reactions?.emojiStyle}
                  styles={styles}
                />
              )
            })}
            {reactions?.renderAccessory && (
              <View onLayout={onAccessoryLayout}>{reactions.renderAccessory()}</View>
            )}
            {hasExpand && (
              <Pressable
                onPress={onExpand}
                accessibilityRole='button'
                accessibilityLabel='more reactions'
                hitSlop={4}
                style={styles.reactionCell}
              >
                <Icon
                  name='chevronDown'
                  color={theme.contextMenu.icon}
                  size={22}
                  fallback={<ChevronFallback color={theme.contextMenu.icon} />}
                />
              </Pressable>
            )}
          </Animated.View>
          {/* Mounted from the start: a view that attaches to an animated style after its
            animation has finished keeps the style's first value, here invisible. */}
          {hasExpand && (
            <Animated.View style={[styles.panelContent, panelContentStyle]} pointerEvents={isExpanded ? 'auto' : 'none'}>
              {/* Laid out once at the panel's final size and revealed by the growing,
                clipped panel, which masks it. Filling the panel instead resized the
                content on every frame of the expand, so a grid re-laid out its cells
                each frame. */}
              <View style={[styles.panelContentInner, isRTL ? styles.panelInnerStart : styles.panelInnerEnd, { width: panelWidth, height: panelHeight }]}>
                {isExpanded && reactions?.renderExpandedPicker?.({ onSelect: onExpandedSelect })}
              </View>
            </Animated.View>
          )}
        </Animated.View>
      </Animated.View>
    </>
  )
}
