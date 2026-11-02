import React, { useCallback, useEffect, useRef, useState } from 'react'
import { BackHandler, ImageProps, NativeScrollEvent, NativeSyntheticEvent, StatusBar, StyleSheet, useWindowDimensions } from 'react-native'
import { FlatList, GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler'
import { OverKeyboardView } from 'react-native-keyboard-controller'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { IMessage } from '../../Models'
import { DECELERATE, EASE_OUT_QUINT } from '../../motion'
import { MediaViewerChrome } from './MediaViewerChrome'
import { MediaViewerPage } from './MediaViewerPage'

// Telegram's viewer keeps 15dp between neighbouring photos, and a release past a third of the
// screen or faster than 650dp/s turns the page (`PhotoViewer.onTouchEvent`); a native paging
// list gives the same feel and the platform's own fling.
const PAGE_GAP = 15
const OPEN = { duration: 250, easing: EASE_OUT_QUINT }
const CLOSE = { duration: 200, easing: DECELERATE }
// Dragged this share of the screen down (or flung), the photo is let go.
const DISMISS_SHARE = 0.15
const DISMISS_VELOCITY = 1000

export interface MediaViewerProps {
  /** The photos to page through, oldest first. */
  items: IMessage[]
  initialIndex: number
  imageProps?: Partial<ImageProps>
  onClose: () => void
}

/**
 * The full-screen photo viewer: every photo in the chat, side by side, swiped through as in
 * Telegram (left for newer, right for older), pinch and double tap to zoom, and a drag up or
 * down to put it away.
 */
export function MediaViewer ({ items, initialIndex, imageProps, onClose }: MediaViewerProps) {
  const { width, height } = useWindowDimensions()
  const pageWidth = width + PAGE_GAP
  const listRef = useRef<React.ComponentRef<typeof FlatList<IMessage>>>(null)
  const [index, setIndex] = useState(initialIndex)
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null)
  const isZoomed = zoomedIndex === index

  const progress = useSharedValue(0)
  const dragY = useSharedValue(0)
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    progress.set(withTiming(1, OPEN))
  }, [progress])

  const close = useCallback(() => {
    if (isClosing)
      return
    setIsClosing(true)
    progress.set(withTiming(0, CLOSE, isFinished => {
      if (isFinished)
        runOnJS(onClose)()
    }))
  }, [isClosing, progress, onClose])

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close()
      return true
    })
    return () => subscription.remove()
  }, [close])

  const onZoomStateChange = useCallback((pageIndex: number, isPageZoomed: boolean) => {
    setZoomedIndex(current => (isPageZoomed ? pageIndex : current === pageIndex ? null : current))
  }, [])

  // The counter and the bottom bar follow the page once it has settled, as Telegram's do.
  const onMomentumScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth)
    setIndex(Math.max(0, Math.min(items.length - 1, next)))
  }, [pageWidth, items.length])

  const dismissPan = usePanGesture({
    enabled: !isZoomed && !isClosing,
    activeOffsetY: [-12, 12],
    failOffsetX: [-12, 12],
    onUpdate: event => {
      dragY.set(event.translationY)
    },
    onDeactivate: event => {
      const y = dragY.get()
      if (Math.abs(y) > height * DISMISS_SHARE || Math.abs(event.velocityY) > DISMISS_VELOCITY) {
        // The photo carries on the way it was thrown while the backdrop fades.
        dragY.set(withTiming(Math.sign(y || event.velocityY) * height, CLOSE))
        runOnJS(close)()
      } else {
        dragY.set(withTiming(0, OPEN))
      }
    },
  })

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.get() * (1 - Math.min(1, Math.abs(dragY.get()) / (height / 2))),
  }))
  const contentStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: dragY.get() }, { scale: 0.9 + 0.1 * progress.get() }],
  }))
  const chromeStyle = useAnimatedStyle(() => ({
    opacity: progress.get() * (dragY.get() === 0 ? 1 : 0),
  }))

  const renderItem = useCallback(({ item, index: pageIndex }: { item: IMessage, index: number }) => (
    <MediaViewerPage
      message={item}
      index={pageIndex}
      width={width}
      height={height}
      pageWidth={pageWidth}
      listRef={listRef}
      imageProps={imageProps}
      onZoomStateChange={onZoomStateChange}
    />
  ), [width, height, pageWidth, imageProps, onZoomStateChange])

  const getItemLayout = useCallback((_: unknown, itemIndex: number) => (
    { length: pageWidth, offset: pageWidth * itemIndex, index: itemIndex }
  ), [pageWidth])

  return (
    <OverKeyboardView visible>
      <SafeAreaProvider>
        {/* White on the black viewer, whatever the app's own bar style. */}
        <StatusBar animated barStyle='light-content' />
        <GestureHandlerRootView style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
          <GestureDetector gesture={dismissPan}>
            <Animated.View style={[StyleSheet.absoluteFill, contentStyle]}>
              <FlatList
                ref={listRef}
                testID='media-viewer-pager'
                data={items}
                keyExtractor={item => String(item._id)}
                renderItem={renderItem}
                getItemLayout={getItemLayout}
                initialScrollIndex={initialIndex}
                horizontal
                pagingEnabled
                scrollEnabled={!isZoomed}
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onMomentumScrollEnd}
                initialNumToRender={1}
                maxToRenderPerBatch={2}
                windowSize={3}
                style={{ width: pageWidth }}
              />
            </Animated.View>
          </GestureDetector>
          <Animated.View style={[StyleSheet.absoluteFill, chromeStyle]} pointerEvents='box-none'>
            <MediaViewerChrome message={items[index]} index={index} count={items.length} onClose={close} />
          </Animated.View>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </OverKeyboardView>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: '#000000',
  },
})

