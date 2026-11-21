import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BackHandler, ImageProps, NativeScrollEvent, NativeSyntheticEvent, StatusBar, StyleSheet, View, useWindowDimensions } from 'react-native'
import { FlatList, GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler'
import { OverKeyboardView } from 'react-native-keyboard-controller'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { IMessage } from '../../Models'
import { DECELERATE, EASE_OUT_QUINT } from '../../motion'
import { MediaViewerChrome } from './MediaViewerChrome'
import { MediaViewerPage, MediaViewerPageProps } from './MediaViewerPage'

// Telegram's viewer keeps 15dp between neighbouring photos, and a release past a third of the
// screen or faster than 650dp/s turns the page (`PhotoViewer.onTouchEvent`); a native paging
// list gives the same feel and the platform's own fling.
const PAGE_GAP = 15
const OPEN = { duration: 250, easing: EASE_OUT_QUINT }
const CLOSE = { duration: 200, easing: DECELERATE }
// Dragged this share of the screen down (or flung), the photo is let go.
const DISMISS_SHARE = 0.15
const DISMISS_VELOCITY = 1000
const pageKey = (item: IMessage) => JSON.stringify([item._id, item.image])

export interface MediaViewerProps<TMessage extends IMessage = IMessage> {
  /** The photos to page through, oldest first. */
  items: readonly TMessage[]
  initialIndex: number
  imageProps?: Partial<ImageProps>
  renderPage?: (props: MediaViewerPageProps<TMessage>) => React.ReactNode
  onClose: () => void
}

/**
 * The full-screen photo viewer: every photo in the chat, side by side, swiped through as in
 * Telegram (left for newer, right for older), pinch and double tap to zoom, and a drag up or
 * down to put it away.
 */
export function MediaViewer<TMessage extends IMessage = IMessage> ({ items, initialIndex, imageProps, renderPage, onClose }: MediaViewerProps<TMessage>) {
  const { width, height } = useWindowDimensions()
  const pageWidth = width + PAGE_GAP
  const listRef = useRef<React.ComponentRef<typeof FlatList<TMessage>>>(null)
  const [initialPage] = useState(() => Math.max(0, Math.min(items.length - 1, initialIndex)))
  const [settledIndex, setIndex] = useState(initialPage)
  const index = Math.min(settledIndex, Math.max(0, items.length - 1))
  const [zoomedPage, setZoomedPage] = useState<string | null>(null)
  const item = items[index]
  const isZoomed = !!item && zoomedPage === pageKey(item)
  const itemsRef = useRef(items)
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => {
    itemsRef.current = items
    onCloseRef.current = onClose
  })

  const progress = useSharedValue(0)
  const dragY = useSharedValue(0)
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    progress.set(withTiming(1, OPEN))
  }, [progress])

  const notifyClose = useCallback(() => onCloseRef.current(), [])
  const close = useCallback(() => {
    if (isClosing)
      return
    setIsClosing(true)
    progress.set(withTiming(0, CLOSE, isFinished => {
      if (isFinished)
        runOnJS(notifyClose)()
    }))
  }, [isClosing, progress, notifyClose])

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close()
      return true
    })
    return () => subscription.remove()
  }, [close])

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

  const renderItem = useCallback(({ item, index: pageIndex }: { item: TMessage, index: number }) => {
    const key = pageKey(item)
    const page: MediaViewerPageProps<TMessage> = {
      message: item,
      index: pageIndex,
      width,
      height,
      pageWidth,
      listRef,
      imageProps,
      onZoomStateChange: (zoomIndex, isPageZoomed) => {
        const currentItem = itemsRef.current[pageIndex]
        if (zoomIndex !== pageIndex || !currentItem || pageKey(currentItem) !== key)
          return
        setZoomedPage(current => (isPageZoomed ? key : current === key ? null : current))
      },
    }
    return renderPage
      ? <View style={{ width: pageWidth, height }}>{renderPage(page)}</View>
      : <MediaViewerPage {...page} />
  }, [width, height, pageWidth, imageProps, renderPage])

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
                keyExtractor={pageKey}
                renderItem={renderItem}
                getItemLayout={getItemLayout}
                initialScrollIndex={items.length ? initialPage : undefined}
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
            <MediaViewerChrome message={item} index={index} count={items.length} onClose={close} />
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

