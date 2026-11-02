import React from 'react'
import { StyleSheet } from 'react-native'
import Animated from 'react-native-reanimated'

import { useStore } from '../../store'
import { sameNumber } from '../recordingMeter'
import { RING_STROKE } from './constants'
import { Svg, SvgCircle } from './optional'
import { RingProgress } from './types'

/**
 * The elapsed arc around the camera. Its own component, so a tick of the running time
 * re-renders the arc and not the camera view.
 */
export function ProgressRing ({ progress, ringBox, ringRadius, ringCircumference, color, ringStyle }: {
  progress: RingProgress
  ringBox: number
  ringRadius: number
  ringCircumference: number
  color: string
  ringStyle: React.ComponentProps<typeof Animated.View>['style']
}) {
  const live = typeof progress === 'object' ? progress : undefined
  const elapsed = useStore(live?.elapsed, sameNumber, 0)
  const share = live ? Math.min(1, elapsed / live.maxMs) : (progress as number)
  if (!SvgCircle || share <= 0)
    return null

  return (
    <Animated.View style={[StyleSheet.absoluteFill, ringStyle]} pointerEvents='none'>
      <Svg width={ringBox} height={ringBox} style={StyleSheet.absoluteFill} pointerEvents='none'>
        {/* Only the elapsed arc, no track. */}
        <SvgCircle
          cx={ringBox / 2}
          cy={ringBox / 2}
          r={ringRadius}
          stroke={color}
          strokeWidth={RING_STROKE}
          fill='none'
          strokeLinecap='round'
          strokeDasharray={ringCircumference}
          strokeDashoffset={ringCircumference * (1 - share)}
          transform={`rotate(-90 ${ringBox / 2} ${ringBox / 2})`}
        />
      </Svg>
    </Animated.View>
  )
}
