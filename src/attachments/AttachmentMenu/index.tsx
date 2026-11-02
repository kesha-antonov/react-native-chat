import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { useWindowInsets } from '../../components/windowInsets'
import { useColorScheme } from '../../hooks/useColorScheme'
import { useThemedStyles } from '../../hooks/useTheme'
import { warning } from '../../logging'
import { hasMediaLibrary } from '../../optional'
import { CurrentLocation, getCurrentLocation, pickDocuments, pickFromSystemGallery, takePhoto } from '../buildMessages'
import { GalleryAsset, toPickedAttachment, useGallery } from '../gallery'
import { AttachmentTab, PickedAttachment } from '../types'
import { CaptionBar } from './CaptionBar'
import {
  CAPTION_SWAP_MS,
  CLOSE,
  COLUMNS,
  DECELERATE,
  GRID_GAP,
  HEADER,
  OPEN_FRACTION,
  PANEL_HEIGHT,
  REDUCE_MOTION,
  TAB_CONTENT_SHIFT,
  TAB_CONTENT_SPRING,
  TAB_MAX_WIDTH,
  TABS_ROW,
} from './constants'
import { GalleryGrid } from './GalleryGrid'
import { createStyles } from './styles'
import { TabBar } from './TabBar'
import { TabPanel } from './TabPanel'
import { useSheetPresence } from './useSheetPresence'

export interface AttachmentMenuProps {
  visible: boolean
  tabs: AttachmentTab[]
  onClose: () => void
  /** Called with the picks and the caption; the menu closes itself first. */
  onSend: (attachments: PickedAttachment[], caption: string) => void
}

/**
 * The attachment menu: a sheet with the newest photos (with `expo-media-library`)
 * over a floating pill of tabs. Picking photos numbers them and swaps the tabs for a caption and
 * a "Send N" button; File, Camera and (without the grid) Gallery hand over to the system pickers.
 */
export function AttachmentMenu ({ visible, tabs, onClose, onSend }: AttachmentMenuProps) {
  const styles = useThemedStyles(createStyles)
  const isDark = useColorScheme() === 'dark'
  const insets = useWindowInsets()
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()

  const hasGrid = tabs.includes('gallery') && hasMediaLibrary()
  const contentTabs = useMemo(() => tabs.filter(tab => (tab === 'gallery' && hasGrid) || tab === 'location' || tab === 'gallery'), [tabs, hasGrid])
  const initialTab: AttachmentTab = contentTabs[0] ?? tabs[0] ?? 'gallery'
  const [activeTab, setActiveTab] = useState<AttachmentTab>(initialTab)
  const [selected, setSelected] = useState<GalleryAsset[]>([])
  const [caption, setCaption] = useState('')
  const [location, setLocation] = useState<CurrentLocation | 'locating' | null>(null)

  const scrollY = useSharedValue(0)
  const gridMode = useSharedValue(1)
  const captionShown = useSharedValue(0)
  const contentShift = useSharedValue(0)

  const { isMounted, close, sheetStyle, dimStyle } = useSheetPresence(visible, screenHeight)

  // Every open starts fresh.
  const [wasMounted, setWasMounted] = useState(false)
  if (isMounted !== wasMounted) {
    setWasMounted(isMounted)
    if (isMounted) {
      if (activeTab !== initialTab)
        setActiveTab(initialTab)
      if (selected.length)
        setSelected([])
      if (caption)
        setCaption('')
    }
  }

  const isGridTab = activeTab === 'gallery' && hasGrid
  const gallery = useGallery(isMounted && isGridTab)
  const isGridShown = isGridTab && gallery.status !== 'denied' && gallery.status !== 'unavailable' &&
    !(gallery.status === 'ready' && gallery.assets.length === 0)

  useEffect(() => {
    gridMode.set(withTiming(isGridShown ? 1 : 0, CLOSE))
  }, [isGridShown, gridMode])
  useEffect(() => {
    captionShown.set(withTiming(selected.length > 0 ? 1 : 0, { duration: CAPTION_SWAP_MS, easing: DECELERATE, reduceMotion: REDUCE_MOTION }))
  }, [selected.length, captionShown])

  const dismiss = useCallback(() => close(onClose), [close, onClose])
  // Closes the sheet, then runs `action` (a system picker must not present over the sheet).
  const closeThen = useCallback((action: () => void) => {
    close(() => {
      onClose()
      action()
    })
  }, [close, onClose])

  const sendPicked = useCallback((attachments: PickedAttachment[], withCaption = '') => {
    if (attachments.length)
      onSend(attachments, withCaption)
  }, [onSend])

  // The system picker opens over the sheet, and the sheet closes only once something was
  // picked. Closing first unmounted the sheet's Modal in the same tick as the picker was
  // presented, and iOS refuses to present while a controller is being dismissed - so the File
  // tab just closed the sheet. Cancelling the picker also leaves the sheet open.
  const isPickingRef = useRef(false)
  const runPicker = useCallback((picker: () => Promise<PickedAttachment[]>) => {
    if (isPickingRef.current)
      return

    isPickingRef.current = true
    picker()
      .then(picked => {
        if (picked.length)
          closeThen(() => sendPicked(picked))
      })
      .catch(reason => warning('The attachment picker failed:', reason))
      .finally(() => {
        isPickingRef.current = false
      })
  }, [closeThen, sendPicked])

  const fetchLocation = useCallback(() => {
    setLocation('locating')
    getCurrentLocation().then(setLocation).catch(() => setLocation({ status: 'failed' }))
  }, [])

  const onTabPress = useCallback((tab: AttachmentTab) => {
    if (tab === 'file')
      return runPicker(pickDocuments)
    if (tab === 'camera')
      return runPicker(takePhoto)
    if (tab === 'gallery' && !hasGrid && activeTab === 'gallery')
      return runPicker(pickFromSystemGallery)
    if (tab === activeTab)
      return
    setActiveTab(tab)
    contentShift.set(TAB_CONTENT_SHIFT)
    contentShift.set(withSpring(0, TAB_CONTENT_SPRING))
    if (tab === 'location' && (location == null || (typeof location === 'object' && location.status !== 'located')))
      fetchLocation()
  }, [runPicker, hasGrid, activeTab, contentShift, location, fetchLocation])

  // The location tab finds the position as soon as it opens.
  useEffect(() => {
    if (isMounted && activeTab === 'location' && location == null)
      fetchLocation()
  }, [isMounted, activeTab, location, fetchLocation])

  const sendLocation = useCallback(() => {
    if (location && typeof location === 'object' && location.status === 'located') {
      const picked: PickedAttachment = { type: 'location', latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy }
      closeThen(() => sendPicked([picked]))
      return
    }
    if (location !== 'locating')
      fetchLocation()
  }, [location, closeThen, sendPicked, fetchLocation])

  const toggleAsset = useCallback((asset: GalleryAsset) => {
    setSelected(previous => previous.some(item => item.id === asset.id)
      ? previous.filter(item => item.id !== asset.id)
      : [...previous, asset])
  }, [])

  const sendSelection = useCallback(() => {
    const picks = selected
    const text = caption
    closeThen(() => {
      Promise.all(picks.map(toPickedAttachment))
        .then(attachments => sendPicked(attachments, text))
        .catch(() => {})
    })
  }, [selected, caption, closeThen, sendPicked])

  const keyboard = useReanimatedKeyboardAnimation()
  const fallbackKeyboard = useSharedValue(0)
  const keyboardHeight = keyboard?.height ?? fallbackKeyboard

  // Geometry.
  const spacer = Math.round(screenHeight * OPEN_FRACTION)
  const bottomArea = TABS_ROW + insets.bottom
  const fixedTop = screenHeight - bottomArea - PANEL_HEIGHT - HEADER
  const cellSize = Math.floor((screenWidth - GRID_GAP * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS)
  const tabWidth = Math.min(TAB_MAX_WIDTH, Math.floor((screenWidth - 40) / Math.min(4.5, Math.max(1, tabs.length))))

  const scrollHandler = useAnimatedScrollHandler(event => {
    scrollY.set(event.contentOffset.y)
  })

  const backgroundStyle = useAnimatedStyle(() => {
    const gridTop = Math.max(0, spacer - scrollY.value)
    return { transform: [{ translateY: gridTop * gridMode.value + fixedTop * (1 - gridMode.value) }] }
  })
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: contentShift.value }] }))

  if (!isMounted)
    return null

  return (
    <Modal transparent visible animationType='none' onRequestClose={dismiss} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, styles.dim, dimStyle]} pointerEvents='none' />
      <Animated.View style={[StyleSheet.absoluteFill, sheetStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel='dismiss' />
        <Animated.View style={[styles.background, { height: screenHeight + 100 }, backgroundStyle]} pointerEvents='none'>
          <View style={styles.handle} />
        </Animated.View>

        {isGridShown
          ? (
            <Animated.View style={[StyleSheet.absoluteFill, contentStyle]} pointerEvents='box-none'>
              <GalleryGrid
                assets={gallery.assets}
                selected={selected}
                cellSize={cellSize}
                spacer={spacer}
                bottomArea={bottomArea}
                onScroll={scrollHandler}
                onEndReached={gallery.loadMore}
                onDismiss={dismiss}
                onToggle={toggleAsset}
                runPicker={runPicker}
              />
            </Animated.View>
          )
          : (
            <Animated.View style={[styles.panel, { top: fixedTop + HEADER, height: PANEL_HEIGHT }, contentStyle]}>
              <TabPanel
                activeTab={activeTab}
                location={location}
                onSendLocation={sendLocation}
                hasGrid={hasGrid}
                galleryStatus={gallery.status}
                runPicker={runPicker}
              />
            </Animated.View>
          )}

        <TabBar
          tabs={tabs}
          activeTab={activeTab}
          tabWidth={tabWidth}
          bottomInset={insets.bottom}
          hasSelection={selected.length > 0}
          captionShown={captionShown}
          onTabPress={onTabPress}
        />

        {selected.length > 0 && (
          <CaptionBar
            count={selected.length}
            caption={caption}
            onChangeCaption={setCaption}
            onSend={sendSelection}
            captionShown={captionShown}
            keyboardHeight={keyboardHeight}
            bottomInset={insets.bottom}
            isDark={isDark}
          />
        )}
      </Animated.View>
    </Modal>
  )
}
