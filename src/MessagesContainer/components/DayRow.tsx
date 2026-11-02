import React, { useContext, useMemo } from 'react'
import { StyleSheet } from 'react-native'
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated'

import { Day, DayProps } from '../../Day'
import { DayItem } from '../dayItems'
import { MessageRowConfigContext } from '../rowConfig'

interface DayRowConfig {
  renderDay?: (props: DayProps) => React.ReactNode
  dateFormat?: string
  dateFormatCalendar?: object
  isDayAnimationEnabled?: boolean
  scrolledY?: SharedValue<number>
  /** The pinned date's fade: 1 while scrolling, 0 once the list rests. */
  floatingDayOpacity?: SharedValue<number>
  /** Which sticky item the list has pinned, by list index (-1 for none). */
  activeStickyIndex?: SharedValue<number>
  cellLayout?: (id: string) => SharedValue<{ y: number, height: number } | undefined>
}

/**
 * A day's date pill, its own row of the list. With day animation on, the list pins it at the top
 * while its day scrolls under it and the next day's pushes it off (`stickyHeaderIndices`); the
 * pinned one shows only while the list moves, as Telegram's floating date does, and fades out
 * when it rests. Unpinned, it is an ordinary separator between days.
 */
export function DayRow ({ item, index }: { item: DayItem, index: number }) {
  const config = useContext(MessageRowConfigContext) as unknown as DayRowConfig
  const { renderDay, dateFormat, dateFormatCalendar, isDayAnimationEnabled, scrolledY, floatingDayOpacity, activeStickyIndex, cellLayout } = config

  const layout = useMemo(
    () => (isDayAnimationEnabled && cellLayout ? cellLayout(item._id) : undefined),
    [isDayAnimationEnabled, cellLayout, item._id]
  )

  const style = useAnimatedStyle(() => {
    if (!layout || !scrolledY || !floatingDayOpacity || !activeStickyIndex || activeStickyIndex.get() !== index)
      return { opacity: 1 }
    // Pinned only once the list has scrolled past where the pill really is: at the top of the
    // history the first day's pill is the active one but still in place, and stays shown.
    const position = layout.get()
    const isStuck = !!position && scrolledY.get() > position.y + 1
    return { opacity: isStuck ? floatingDayOpacity.get() : 1 }
  })

  const dayProps: DayProps = { createdAt: item.createdAt, dateFormat, dateFormatCalendar, isAnimated: false }

  return (
    <Animated.View style={[styles.row, style]} pointerEvents='box-none'>
      {renderDay
        ? renderDay(dayProps)
        : <Day {...dayProps} />}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'stretch',
  },
})

