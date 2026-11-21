import React, { useState } from 'react'
import { I18nManager, Pressable, View } from 'react-native'
import { useIsRTL } from '../../hooks/useIsRTL'
import { clampProgress } from '../mediaTransfer'
import { barCountForWidth, barHeight, levelsFromWaveform } from '../voiceWaveform'
import { Bars } from './Bars'
import { barStyles } from './styles'

export interface VoiceWaveformProps {
  waveform?: ArrayLike<number>
  color: string
  playedColor?: string
  progress?: number
  onSeek?: (fraction: number) => void
  accessibilityLabel?: string
}

export function VoiceWaveform ({
  waveform,
  color,
  playedColor,
  progress,
  onSeek,
  accessibilityLabel = 'seek',
}: VoiceWaveformProps) {
  const [width, setWidth] = useState(0)
  const isRTL = useIsRTL() || I18nManager.isRTL
  const direction = isRTL ? 'rtl' : 'ltr'
  const fraction = clampProgress(progress)
  const heights = levelsFromWaveform(waveform, barCountForWidth(width)).map(barHeight)
  const track = (
    <View pointerEvents='none' style={{ direction }}>
      <Bars heights={heights} color={color} />
      {playedColor && width > 0 && fraction > 0 && (
        <View style={[barStyles.clip, { left: undefined, start: 0, width: width * fraction }]}>
          <View style={[barStyles.clipContent, { start: 0, width }]}>
            <Bars heights={heights} color={playedColor} />
          </View>
        </View>
      )}
    </View>
  )

  if (!onSeek)
    return <View onLayout={event => setWidth(event.nativeEvent.layout.width)}>{track}</View>

  return (
    <Pressable
      accessibilityRole='adjustable'
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      onPress={event => {
        if (width > 0) {
          const tapped = clampProgress(event.nativeEvent.locationX / width)
          onSeek(isRTL ? 1 - tapped : tapped)
        }
      }}
      onAccessibilityAction={event => {
        const { actionName } = event.nativeEvent
        if (actionName === 'increment' || actionName === 'decrement')
          onSeek(clampProgress(fraction + (actionName === 'increment' ? 0.05 : -0.05)))
      }}
    >
      {track}
    </Pressable>
  )
}
