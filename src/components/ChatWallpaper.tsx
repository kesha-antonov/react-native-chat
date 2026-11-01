import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Image, ImageSourcePropType, ImageStyle, StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { averageBrightness } from '../colorUtils'
import { useTheme } from '../hooks/useTheme'
import { IMessage } from '../Models'
import { getWallpaperUri, WALLPAPER_PHASES } from './wallpaperGradient'

// `MotionBackgroundDrawable.switchToNextPosition()`: 500ms on bezier(0.33, 0, 0, 1).
const STEP = { duration: 500, easing: Easing.bezier(0.33, 0, 0, 1) }

export interface ChatWallpaperProps {
  /** Three or four gradient colors; defaults to the theme's `wallpaper.colors`. */
  colors?: string[]
  /**
   * How many steps the gradient has turned. Telegram turns it one step back per outgoing
   * message; any change animates to the new position.
   */
  step?: number
  /** Animate step changes; defaults to the theme's `wallpaper.isAnimated`. */
  isAnimated?: boolean
  /** An image tiled over the gradient; defaults to the theme's `wallpaper.pattern`. */
  pattern?: ImageSourcePropType | null
  patternOpacity?: number
  patternColor?: string
  style?: StyleProp<ViewStyle>
}

const toPhase = (step: number) =>
  ((-step % WALLPAPER_PHASES) + WALLPAPER_PHASES) % WALLPAPER_PHASES

/**
 * Telegram Android's default chat background (`MotionBackgroundDrawable`): a four-color
 * swirl gradient that turns one step, with a 500ms crossfade, every time you send a message.
 * Fills its parent. The doodle pattern Telegram lays over it is GPL artwork and is not
 * bundled; pass your own tile as `pattern` (drawn soft-light, black over a light gradient and
 * white over a dark one, as Telegram blends its own).
 */
export function ChatWallpaper ({
  colors: colorsProp,
  step = 0,
  isAnimated: isAnimatedProp,
  pattern: patternProp,
  patternOpacity: patternOpacityProp,
  patternColor: patternColorProp,
  style,
}: ChatWallpaperProps) {
  const theme = useTheme()
  const colors = colorsProp ?? theme.wallpaper.colors
  const isAnimated = isAnimatedProp ?? theme.wallpaper.isAnimated
  const pattern = patternProp === undefined ? theme.wallpaper.pattern : patternProp
  const patternOpacity = patternOpacityProp ?? theme.wallpaper.patternOpacity
  const colorsKey = colors.join(',')

  const phase = toPhase(step)
  // The phase under the fading one, and the one fading in.
  const [layers, setLayers] = useState({ base: phase, top: phase })
  const topOpacity = useSharedValue(1)

  useEffect(() => {
    setLayers(previous => {
      if (previous.top === phase)
        return previous

      return isAnimated ? { base: previous.top, top: phase } : { base: phase, top: phase }
    })
  }, [phase, isAnimated])

  const settle = useCallback((settledPhase: number) => {
    setLayers(previous => previous.top === settledPhase ? { base: settledPhase, top: settledPhase } : previous)
  }, [])

  useEffect(() => {
    if (layers.base === layers.top) {
      topOpacity.value = 1
      return
    }

    const target = layers.top
    topOpacity.value = 0
    topOpacity.value = withTiming(1, STEP, isFinished => {
      if (isFinished)
        runOnJS(settle)(target)
    })
  }, [layers, topOpacity, settle])

  const topStyle = useAnimatedStyle(() => ({ opacity: topOpacity.value }))

  // Memoized sources keep their identity, so an unrelated render does not reload the image.
  const baseSource = useMemo(() => ({ uri: getWallpaperUri(colorsKey.split(','), layers.base) }), [colorsKey, layers.base])
  const topSource = useMemo(() => ({ uri: getWallpaperUri(colorsKey.split(','), layers.top) }), [colorsKey, layers.top])

  // Telegram tints its pattern black over a light gradient and white over a dark one (average
  // HSB brightness under 0.3, `MotionBackgroundDrawable:440`).
  const patternColor = patternColorProp ?? theme.wallpaper.patternColor ??
    (averageBrightness(colors) < 0.3 ? '#FFFFFF' : '#000000')

  return (
    <View pointerEvents='none' style={[StyleSheet.absoluteFill, style]} testID='chat-wallpaper'>
      <Image
        source={baseSource}
        style={StyleSheet.absoluteFill}
        resizeMode='stretch'
        fadeDuration={0}
      />
      {layers.base !== layers.top && (
        <Animated.Image
          source={topSource}
          style={[StyleSheet.absoluteFill, topStyle]}
          resizeMode='stretch'
          fadeDuration={0}
        />
      )}
      {!!pattern && (
        <Image
          source={pattern}
          resizeMode='repeat'
          style={[
            StyleSheet.absoluteFill,
            { opacity: patternOpacity, tintColor: patternColor, mixBlendMode: 'soft-light' } as ImageStyle,
          ]}
        />
      )}
    </View>
  )
}

/**
 * How many outgoing messages have arrived since mount - the wallpaper's step. A message the
 * current user sent becoming the newest one turns it, wherever it came from.
 */
export function useOutgoingStep (messages: IMessage[], userId: string | number | undefined, isInverted: boolean): number {
  const newest = messages.length ? (isInverted ? messages[0] : messages[messages.length - 1]) : undefined
  const newestId = newest?._id
  const isNewestOutgoing = !!newest && userId != null && newest.user?._id === userId && !newest.system
  const [step, setStep] = useState(0)
  const previousNewestRef = useRef(newestId)

  useEffect(() => {
    const previous = previousNewestRef.current
    previousNewestRef.current = newestId
    if (previous !== undefined && newestId !== undefined && newestId !== previous && isNewestOutgoing)
      setStep(value => value + 1)
  }, [newestId, isNewestOutgoing])

  return step
}
