import React, { useEffect } from 'react'
import { LayoutChangeEvent, StyleProp, View, ViewStyle } from 'react-native'
import { GestureDetector, useCompetingGestures } from 'react-native-gesture-handler'
import Animated, { SharedValue, useAnimatedStyle, useSharedValue } from 'react-native-reanimated'

import { AppearingBar, Bars, SweepBand } from './Bars'
import { barStyles } from './styles'

/*
 * How far a view-once waveform has burnt away: it is clipped to
 * `width * (1 - progress)` while it plays, and the note is gone once
 * it has played.
 */
const BURN_NONE = 0
const BURNING = 1
const BURNT = 2

interface WaveformTrackProps {
  gesture: ReturnType<typeof useCompetingGestures>
  style: StyleProp<ViewStyle>
  onLayout: (event: LayoutChangeEvent) => void
  shownProgress: number
  heights: number[]
  /** Unplayed bars. */
  trackColor: string
  /** Played bars, the shimmer and the unread fill. */
  playedColor: string
  trackWidth: number
  trackWidthSV: SharedValue<number>
  progress: SharedValue<number>
  isAppearing: boolean
  appear: SharedValue<number>
  isSweepMounted: boolean
  sweep: SharedValue<number>
  loading: SharedValue<number>
  isUnread: boolean
  isViewOnce: boolean
  isViewOnceSpent: boolean
  hasViewOnceStarted: boolean
}

/** The seekable waveform: the bars, the played part clipped over them, the burn and the shimmer. */
export function WaveformTrack ({
  gesture,
  style,
  onLayout,
  shownProgress,
  heights,
  trackColor,
  playedColor,
  trackWidth,
  trackWidthSV,
  progress,
  isAppearing,
  appear,
  isSweepMounted,
  sweep,
  loading,
  isUnread,
  isViewOnce,
  isViewOnceSpent,
  hasViewOnceStarted,
}: WaveformTrackProps) {
  const fillAll = useSharedValue(false)

  // An unheard incoming note is painted entirely in the played
  // color, until it has any progress. A view-once note stays that way: it
  // burns away instead of filling in.
  const isFilledAlways = useSharedValue(isViewOnce)
  const burn = useSharedValue(BURN_NONE)
  useEffect(() => {
    fillAll.set(isUnread)
    isFilledAlways.set(isViewOnce)
  }, [fillAll, isUnread, isFilledAlways, isViewOnce])

  useEffect(() => {
    burn.set(isViewOnceSpent ? BURNT : hasViewOnceStarted ? BURNING : BURN_NONE)
  }, [burn, isViewOnceSpent, hasViewOnceStarted])

  // All bars in the track color, with the played color clipped at the exact
  // progress pixel on top, so a bar can be half filled.
  const playedStyle = useAnimatedStyle(() => ({
    width: ((fillAll.get() && progress.get() <= 0) || isFilledAlways.get() ? 1 : progress.get())
      * trackWidthSV.get(),
    opacity: 1 - loading.get(),
  }))

  // A view-once waveform burns away from its end as it plays.
  const burnStyle = useAnimatedStyle(() => ({
    width: burn.get() === BURNT
      ? 0
      : burn.get() === BURNING
        ? (1 - progress.get()) * trackWidthSV.get()
        : '100%',
  }))

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={style}
        onLayout={onLayout}
        accessibilityRole='adjustable'
        accessibilityLabel='seek'
        accessibilityValue={{ min: 0, max: 100, now: Math.round(shownProgress * 100) }}
      >
        <Animated.View style={[barStyles.burn, burnStyle]}>
          {isAppearing
            ? (
              <View style={barStyles.row}>
                {heights.map((height, index) => (
                  <AppearingBar
                    key={index}
                    index={index}
                    count={heights.length}
                    height={height}
                    color={trackColor}
                    appear={appear}
                  />
                ))}
              </View>
            )
            : <Bars heights={heights} color={trackColor} />}

          <Animated.View pointerEvents='none' style={[barStyles.clip, playedStyle]}>
            <Bars heights={heights} color={playedColor} width={trackWidth} />
          </Animated.View>

          {isSweepMounted && trackWidth > 0 && (
            <>
              <SweepBand
                heights={heights}
                color={playedColor}
                width={trackWidth}
                sweep={sweep}
                loading={loading}
                bandFraction={0.4}
                opacity={0.5}
              />
              <SweepBand
                heights={heights}
                color={playedColor}
                width={trackWidth}
                sweep={sweep}
                loading={loading}
                bandFraction={0.2}
                opacity={1}
              />
            </>
          )}
        </Animated.View>
      </View>
    </GestureDetector>
  )
}
