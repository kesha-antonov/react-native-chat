import React from 'react'
import { View } from 'react-native'
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated'

import { useIsRTL } from '../../hooks/useIsRTL'
import { useLabels } from '../../hooks/useLabels'
import { useTheme, useThemedStyles } from '../../hooks/useTheme'
import { AttachmentTab } from '../types'
import { TAB_DROP } from './constants'
import { createStyles } from './styles'
import { TabButton } from './TabButton'

/** The floating pill of tabs; it drops away while picks show the caption row in its place. */
export function TabBar ({ tabs, activeTab, tabWidth, bottomInset, hasSelection, captionShown, onTabPress }: {
  tabs: AttachmentTab[]
  activeTab: AttachmentTab
  tabWidth: number
  bottomInset: number
  hasSelection: boolean
  captionShown: SharedValue<number>
  onTabPress: (tab: AttachmentTab) => void
}) {
  const styles = useThemedStyles(createStyles)
  const theme = useTheme()
  const labels = useLabels()
  const isRTL = useIsRTL()

  const tabsStyle = useAnimatedStyle(() => ({
    opacity: 1 - captionShown.value,
    transform: [{ translateY: TAB_DROP * captionShown.value }],
  }))

  const tabLabel = (tab: AttachmentTab) => ({
    gallery: labels.attachGallery,
    camera: labels.attachCamera,
    file: labels.attachFile,
    location: labels.attachLocation,
  })[tab]

  return (
    <Animated.View style={[styles.tabsRow, { bottom: bottomInset }, tabsStyle]} pointerEvents={hasSelection ? 'none' : 'box-none'}>
      <View style={[styles.tabPill, isRTL && styles.rowReverse]}>
        {tabs.map((tab, index) => (
          <TabButton
            key={tab}
            tab={tab}
            index={index}
            label={tabLabel(tab)}
            width={tabWidth}
            isSelected={tab === activeTab}
            onPress={onTabPress}
            styles={styles}
            theme={theme}
          />
        ))}
      </View>
    </Animated.View>
  )
}
