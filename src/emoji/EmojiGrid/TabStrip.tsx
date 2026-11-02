import React, { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { GestureDetector, GestureStateManager, usePanGesture } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { selectionHaptic } from '../../components/haptics'
import { Icon } from '../../components/Icon'
import { ChatTheme } from '../../Theme'
import { INDICATOR_MOVE, TAB_FALLBACK, TAB_GAP, TAB_ICON, TAB_ICONS, TAB_SIZE } from './constants'
import { Styles } from './styles'
import { Tab } from './types'

/** The tab strip with its sliding indicator; owns the active tab so a scroll re-renders only it. */
export const TabStrip = memo(({ tabs, activeRef, onPress, onScrubEnd, styles, theme, isRTL }: {
  tabs: Tab[]
  activeRef: React.MutableRefObject<(index: number) => void>
  /** A tab was touched (`isScrub` false) or the finger slid onto it along the strip. */
  onPress: (index: number, isScrub: boolean) => void
  onScrubEnd: () => void
  styles: Styles
  theme: ChatTheme
  isRTL: boolean
}) => {
  const [active, setActive] = useState(0)
  const activeIndexRef = useRef(0)
  const position = useSharedValue(0)
  const select = useCallback((index: number) => {
    if (activeIndexRef.current === index)
      return
    activeIndexRef.current = index
    position.set(withTiming(index, INDICATOR_MOVE))
    setActive(index)
  }, [position])
  useEffect(() => {
    activeRef.current = select
  }, [activeRef, select])

  const step = TAB_SIZE + TAB_GAP
  const direction = isRTL ? -1 : 1
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * step * direction }],
  }))

  // One native gesture over the whole strip, not a pressable per tab: React Native's responder
  // system lets a moving list claim the next touch to stop itself, so inside the reactions panel
  // a tab tapped mid-fling only stopped the fling. A gesture-handler pan is recognised natively
  // and fires either way. It activates on touch-down, so a touch picks the tab under the finger,
  // and sliding along the strip moves through the categories, a haptic tick on each.
  const lastTouchedRef = useRef(-1)
  const touchAt = useCallback((x: number, isFirst: boolean) => {
    const slot = Math.min(tabs.length - 1, Math.max(0, Math.floor(x / step)))
    const index = isRTL ? tabs.length - 1 - slot : slot
    if (!isFirst && index === lastTouchedRef.current)
      return
    if (!isFirst)
      selectionHaptic()
    lastTouchedRef.current = index
    select(index)
    onPress(index, !isFirst)
  }, [tabs.length, step, isRTL, select, onPress])
  const endTouch = useCallback(() => {
    lastTouchedRef.current = -1
    onScrubEnd()
  }, [onScrubEnd])
  const gesture = usePanGesture({
    manualActivation: true,
    onTouchesDown: event => {
      GestureStateManager.activate(event.handlerTag)
      runOnJS(touchAt)(event.changedTouches[0].x, true)
    },
    onUpdate: event => {
      runOnJS(touchAt)(event.x, false)
    },
    onFinalize: () => {
      runOnJS(endTouch)()
    },
  })

  return (
    <View style={styles.tabs}>
      <GestureDetector gesture={gesture}>
        <View style={[styles.tabRow, isRTL && styles.rowReverse]}>
          <Animated.View style={[styles.indicator, isRTL ? styles.indicatorRTL : null, indicatorStyle]} />
          {tabs.map((tab, index) => {
            const color = index === active ? theme.emojiKeyboard.iconSelected : theme.emojiKeyboard.icon
            const activate = () => {
              select(index)
              onPress(index, false)
            }
            return (
              <View
                key={tab.key}
                style={styles.tab}
                accessible
                accessibilityRole='tab'
                accessibilityState={{ selected: index === active }}
                accessibilityLabel={tab.label}
                accessibilityActions={TAB_ACCESSIBILITY_ACTIONS}
                onAccessibilityAction={activate}
                onAccessibilityTap={activate}
              >
                <Icon
                  name={TAB_ICONS[tab.key]}
                  color={color}
                  size={TAB_ICON}
                  fallback={<Text style={[styles.tabFallback, index !== active && styles.tabFallbackIdle]}>{TAB_FALLBACK[tab.key]}</Text>}
                />
              </View>
            )
          })}
        </View>
      </GestureDetector>
    </View>
  )
})
TabStrip.displayName = 'TabStrip'

const TAB_ACCESSIBILITY_ACTIONS = [{ name: 'activate' }]
