import React, { useCallback, useMemo } from 'react'
import { ListRenderItemInfo, Pressable } from 'react-native'
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated'

import { Icon } from '../../components/Icon'
import { CameraIcon } from '../../components/MediaControls'
import { useIsRTL } from '../../hooks/useIsRTL'
import { useLabels } from '../../hooks/useLabels'
import { useThemedStyles } from '../../hooks/useTheme'
import { GalleryAsset } from '../gallery'
import { PickedAttachment } from '../types'
import { COLUMNS, HEADER } from './constants'
import { GalleryCell } from './GalleryCell'
import { createStyles } from './styles'

type GridItem = GalleryAsset | 'camera'

/** The photo grid: a camera cell, then the newest photos, under a spacer that lets the sheet rise. */
export function GalleryGrid ({
  assets,
  selected,
  cellSize,
  spacer,
  bottomArea,
  onScroll,
  onEndReached,
  onDismiss,
  onToggle,
  runPicker,
  pickCamera,
}: {
  assets: GalleryAsset[]
  selected: GalleryAsset[]
  cellSize: number
  spacer: number
  bottomArea: number
  onScroll: ReturnType<typeof useAnimatedScrollHandler>
  onEndReached: () => void
  onDismiss: () => void
  onToggle: (asset: GalleryAsset) => void
  runPicker: (picker: () => Promise<PickedAttachment[]>) => void
  /** Takes a photo from the grid's first cell; no camera cell without it. */
  pickCamera?: () => Promise<PickedAttachment[]>
}) {
  const styles = useThemedStyles(createStyles)
  const labels = useLabels()
  const isRTL = useIsRTL()

  const gridItems = useMemo<GridItem[]>(
    () => (pickCamera ? ['camera' as const, ...assets] : assets),
    [assets, pickCamera]
  )
  const selectionIndex = useMemo(() => new Map(selected.map((asset, index) => [asset.id, index + 1])), [selected])

  const cornerFor = useCallback((index: number) => {
    if (index === 0)
      return isRTL ? styles.cornerTopRight : styles.cornerTopLeft
    if (index === COLUMNS - 1)
      return isRTL ? styles.cornerTopLeft : styles.cornerTopRight
    return null
  }, [styles, isRTL])

  const renderItem = useCallback(({ item, index }: ListRenderItemInfo<GridItem>) => {
    if (item === 'camera')
      return (
        <Pressable
          onPress={() => pickCamera && runPicker(pickCamera)}
          style={[styles.cell, styles.cameraCell, { width: cellSize, height: cellSize }, cornerFor(index)]}
          accessibilityRole='button'
          accessibilityLabel={labels.attachCamera}
        >
          <Icon name='camera' color='#FFFFFF' size={30} fallback={<CameraIcon color='#FFFFFF' size={30} />} />
        </Pressable>
      )
    return (
      <GalleryCell
        asset={item}
        size={cellSize}
        selection={selectionIndex.get(item.id) ?? 0}
        cornerStyle={cornerFor(index)}
        isRTL={isRTL}
        onToggle={onToggle}
        styles={styles}
      />
    )
  }, [styles, cellSize, cornerFor, labels, runPicker, pickCamera, selectionIndex, onToggle, isRTL])

  const onScrollEndDrag = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    // Pulled down past the top: the sheet goes.
    if (event.nativeEvent.contentOffset.y < -70)
      onDismiss()
  }, [onDismiss])

  return (
    <Animated.FlatList
      data={gridItems}
      keyExtractor={(item: GridItem) => (item === 'camera' ? 'camera' : item.id)}
      renderItem={renderItem}
      numColumns={COLUMNS}
      columnWrapperStyle={[styles.gridRow, isRTL && styles.rowReverse]}
      ListHeaderComponent={<Pressable style={{ height: spacer + HEADER }} onPress={onDismiss} />}
      contentContainerStyle={[styles.grid, { paddingBottom: bottomArea + 16 }]}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onScrollEndDrag={onScrollEndDrag}
      onEndReached={onEndReached}
      onEndReachedThreshold={1}
      initialNumToRender={12}
      maxToRenderPerBatch={9}
      windowSize={5}
      removeClippedSubviews
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps='handled'
    />
  )
}
