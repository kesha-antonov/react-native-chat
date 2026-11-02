import React, { memo, useEffect } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { getExpoImage } from '../../optional'
import { GalleryAsset, useAssetThumbnailUri } from '../gallery'
import { EASE_OUT, REDUCE_MOTION, SELECT_MS, SELECTED_SCALE } from './constants'
import { Styles } from './styles'

const formatDuration = (seconds?: number) => {
  const total = Math.max(0, Math.round(seconds ?? 0))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

// Resolved once, like MessageImage does: a component type looked up in render is one the
// compiler cannot prove stable.
const ExpoImageView = getExpoImage()?.Image ?? null

const Thumbnail = ({ asset, style }: { asset: GalleryAsset, style: object }) => {
  const uri = useAssetThumbnailUri(asset)
  if (!uri)
    return <View style={style} />
  if (ExpoImageView)
    return <ExpoImageView source={{ uri }} style={style} contentFit='cover' recyclingKey={asset.id} transition={0} />
  return <Image source={{ uri }} style={style} resizeMode='cover' />
}

export const GalleryCell = memo(({ asset, size, selection, cornerStyle, isRTL, onToggle, styles }: {
  asset: GalleryAsset
  isRTL: boolean
  size: number
  /** 1-based pick order, or 0. */
  selection: number
  cornerStyle: object | null
  onToggle: (asset: GalleryAsset) => void
  styles: Styles
}) => {
  const progress = useSharedValue(selection ? 1 : 0)
  useEffect(() => {
    progress.set(withTiming(selection ? 1 : 0, { duration: SELECT_MS, easing: EASE_OUT, reduceMotion: REDUCE_MOTION }))
  }, [selection, progress])
  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (1 - SELECTED_SCALE) * progress.value }],
  }))
  const checkStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.6 + 0.4 * progress.value }],
  }))

  return (
    <Pressable
      onPress={() => onToggle(asset)}
      style={[styles.cell, { width: size, height: size }, cornerStyle]}
      accessibilityRole='checkbox'
      accessibilityState={{ checked: selection > 0 }}
      accessibilityLabel={asset.filename ?? asset.mediaType}
    >
      <Animated.View style={[StyleSheet.absoluteFill, imageStyle]}>
        <Thumbnail asset={asset} style={StyleSheet.absoluteFill} />
        {asset.mediaType === 'video' && (
          <View style={styles.duration} pointerEvents='none'>
            <Text style={styles.durationText}>{formatDuration(asset.duration)}</Text>
          </View>
        )}
      </Animated.View>
      <View style={[styles.checkRing, isRTL && styles.checkStart]} pointerEvents='none' />
      <Animated.View style={[styles.checkDisc, isRTL && styles.checkStart, checkStyle]} pointerEvents='none'>
        <Text style={[styles.checkNumber, selection > 99 && styles.checkNumberSmall]} allowFontScaling={false}>
          {selection > 0 ? String(selection) : ''}
        </Text>
      </Animated.View>
    </Pressable>
  )
})
GalleryCell.displayName = 'GalleryCell'
