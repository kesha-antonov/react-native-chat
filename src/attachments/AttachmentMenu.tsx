import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  ListRenderItemInfo,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { withAlpha } from '../colorUtils'
import { Icon } from '../components/Icon'
import { CameraIcon, PinIcon } from '../components/MediaControls'
import { useWindowInsets } from '../components/windowInsets'
import { useAnimatedPresence } from '../hooks/useAnimatedPresence'
import { useColorScheme } from '../hooks/useColorScheme'
import { useIsRTL } from '../hooks/useIsRTL'
import { useLabels } from '../hooks/useLabels'
import { useTheme, useThemedStyles } from '../hooks/useTheme'
import { formatLabel } from '../i18n'
import { IconName } from '../Icons'
import { getExpoImage, hasImagePicker, hasImagePickerCamera, hasMediaLibrary } from '../optional'
import { ChatTheme } from '../Theme'
import { CurrentLocation, getCurrentLocation, pickDocuments, pickFromSystemGallery, takePhoto } from './buildMessages'
import { GalleryAsset, toPickedAttachment, useAssetThumbnailUri, useGallery } from './gallery'
import { AttachmentTab, PickedAttachment } from './types'

/*
 * Telegram Android 13.x's attachment menu (`ChatAttachAlert`, DrKLO/Telegram 13.1.1). CAA =
 * ui/Components/ChatAttachAlert.java, CAAPL = ChatAttachAlertPhotoLayout.java, GTV =
 * ui/Components/glass/GlassTabView.java, PAPC = ui/Cells/PhotoAttachPhotoCell.java.
 */

const REDUCE_MOTION = ReduceMotion.System
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1)
const EASE_IN = Easing.bezier(0.42, 0, 1, 1)
const EASE_BOTH = Easing.bezier(0.42, 0, 0.58, 1)
const DECELERATE = Easing.out(Easing.quad)
// `OvershootInterpolator(0.7)`, the dim's way in.
const overshoot07 = (t: number) => {
  'worklet'
  const s = t - 1
  return s * s * (1.7 * s + 0.7) + 1
}

// The sheet rises on a spring of damping ratio 0.75 and stiffness 350; the dim fades in over
// 400ms after 20 (`CAA:5375-5395`); both leave over 180ms on EASE_OUT (`BottomSheet:1895`).
const SHEET_SPRING = { stiffness: 350, damping: 2 * 0.75 * Math.sqrt(350), mass: 1, reduceMotion: REDUCE_MOTION }
const DIM_IN = { duration: 400, easing: overshoot07, reduceMotion: REDUCE_MOTION }
const CLOSE = { duration: 180, easing: EASE_OUT, reduceMotion: REDUCE_MOTION }
// Opens to about 2/5 down the screen and scrolls up to full height (`CAAPL:4025-4033`), with
// a 36 x 4 handle and 12 top corners.
const OPEN_FRACTION = 0.4
const SHEET_RADIUS = 12
const HEADER = 22
// The grid: 3 columns, 2 padding and gap, the first row's outer corners at 16 (`CAAPL:131, 3976-4000`).
const COLUMNS = 3
const GRID_GAP = 2
const GRID_RADIUS = 16
// Selection: a 24 disc 4 from the top-right corner, numbered in bold 14; the picked photo
// shrinks to 0.787; both over 200ms (`PAPC:274-282, 612`, `CheckBoxBase:278-620`).
const CHECK_SIZE = 24
const CHECK_INSET = 4
const SELECTED_SCALE = 0.787
const SELECT_MS = 200
// The floating tab pill: 56 tall (radius 28) in a 70 row; tabs `width / min(4.5, count)`, at
// most 84; 24 icons, 11 bold labels; the selected one gets a 9% capsule growing from 0.6 over
// 320ms (`CAA:2760-2770, 1538`, `GTV:67-163, 445-488`).
const TABS_ROW = 70
const TAB_PILL = 56
const TAB_MAX_WIDTH = 84
const TAB_ICON = 24
const TAB_SELECT_MS = 320
// On open the tabs pop in one after another, 32ms apart from the fourth leftwards: 0 -> 1.1 over
// 200ms, then 1.1 -> 1 over 100ms (`CAA:5286-5358`).
const TAB_STAGGER_MS = 32
// The first pick swaps the tabs for the caption and the send button: the tabs drop 36 and fade,
// the send button grows from 0.2, over 180ms (`CAA:5172-5200`).
const CAPTION_SWAP_MS = 180
const TAB_DROP = 36
const SEND_SIZE = 48
// A new tab's content slides up from 78 and springs into place (`CAA:4693-4711`).
const TAB_CONTENT_SHIFT = 78
const TAB_CONTENT_SPRING = { stiffness: 500, damping: 2 * 0.75 * Math.sqrt(500), mass: 1, reduceMotion: REDUCE_MOTION }

const PANEL_HEIGHT = 150

const TAB_ICONS: Record<AttachmentTab, IconName> = {
  gallery: 'gallery',
  camera: 'camera',
  file: 'file',
  location: 'location',
}

export interface AttachmentMenuProps {
  visible: boolean
  tabs: AttachmentTab[]
  onClose: () => void
  /** Called with the picks and the caption; the menu closes itself first. */
  onSend: (attachments: PickedAttachment[], caption: string) => void
}

type Styles = ReturnType<typeof createStyles>
type GridItem = GalleryAsset | 'camera'

const formatDuration = (seconds?: number) => {
  const total = Math.max(0, Math.round(seconds ?? 0))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

const ExpoImage = () => getExpoImage()?.Image ?? null

const Thumbnail = ({ asset, style }: { asset: GalleryAsset, style: object }) => {
  const uri = useAssetThumbnailUri(asset)
  const ExpoImageView = ExpoImage()
  if (!uri)
    return <View style={style} />
  if (ExpoImageView)
    return <ExpoImageView source={{ uri }} style={style} contentFit='cover' recyclingKey={asset.id} transition={0} />
  return <Image source={{ uri }} style={style} resizeMode='cover' />
}

const GalleryCell = memo(({ asset, size, selection, cornerStyle, isRTL, onToggle, styles }: {
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
    progress.value = withTiming(selection ? 1 : 0, { duration: SELECT_MS, easing: EASE_OUT, reduceMotion: REDUCE_MOTION })
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

const TabButton = ({ tab, index, label, width, isSelected, onPress, styles, theme }: {
  tab: AttachmentTab
  index: number
  label: string
  width: number
  isSelected: boolean
  onPress: (tab: AttachmentTab) => void
  styles: Styles
  theme: ChatTheme
}) => {
  const appear = useSharedValue(0)
  const fade = useSharedValue(0)
  useEffect(() => {
    const delay = 20 + TAB_STAGGER_MS * Math.max(0, 3 - index)
    appear.value = withDelay(delay, withSequence(
      withTiming(1.1, { duration: 200, easing: EASE_OUT, reduceMotion: REDUCE_MOTION }),
      withTiming(1, { duration: 100, easing: EASE_IN, reduceMotion: REDUCE_MOTION })
    ), REDUCE_MOTION)
    fade.value = withDelay(delay, withTiming(1, { duration: 200, easing: EASE_BOTH, reduceMotion: REDUCE_MOTION }), REDUCE_MOTION)
  }, [appear, fade, index])
  const selected = useSharedValue(isSelected ? 1 : 0)
  useEffect(() => {
    selected.value = withTiming(isSelected ? 1 : 0, { duration: TAB_SELECT_MS, easing: DECELERATE, reduceMotion: REDUCE_MOTION })
  }, [isSelected, selected])
  const appearStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ scale: appear.value }],
  }))
  const capsuleStyle = useAnimatedStyle(() => ({
    opacity: selected.value,
    transform: [{ scale: 0.6 + 0.4 * selected.value }],
  }))
  const color = isSelected ? theme.attachments.tabSelected : theme.attachments.tabText

  return (
    <Pressable
      onPress={() => onPress(tab)}
      style={[styles.tab, { width }]}
      accessibilityRole='tab'
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.tabInner, appearStyle]}>
        <Animated.View style={[styles.tabCapsule, capsuleStyle]} />
        <Icon
          name={TAB_ICONS[tab]}
          color={color}
          size={TAB_ICON}
          fallback={tab === 'location' ? <PinIcon color={color} size={TAB_ICON} /> : <CameraIcon color={color} size={TAB_ICON} />}
        />
        <Text
          style={[styles.tabLabel, { color: isSelected ? theme.attachments.tabSelectedText : theme.attachments.tabText }, isSelected && styles.tabLabelSelected]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  )
}

/**
 * Telegram Android's attachment menu: a sheet with the newest photos (with `expo-media-library`)
 * over a floating pill of tabs. Picking photos numbers them and swaps the tabs for a caption and
 * a "Send N" button; File, Camera and (without the grid) Gallery hand over to the system pickers.
 */
export function AttachmentMenu ({ visible, tabs, onClose, onSend }: AttachmentMenuProps) {
  const styles = useThemedStyles(createStyles)
  const theme = useTheme()
  const labels = useLabels()
  const isRTL = useIsRTL()
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

  const open = useSharedValue(0)
  const dim = useSharedValue(0)
  const scrollY = useSharedValue(0)
  const gridMode = useSharedValue(1)
  const captionShown = useSharedValue(0)
  const contentShift = useSharedValue(0)

  const animateIn = useCallback(() => {
    open.value = 0
    dim.value = 0
    open.value = withSpring(1, SHEET_SPRING)
    dim.value = withDelay(20, withTiming(1, DIM_IN), REDUCE_MOTION)
  }, [open, dim])
  const animateOut = useCallback((onDone: () => void) => {
    dim.value = withTiming(0, CLOSE)
    open.value = withTiming(0, CLOSE, finished => {
      if (finished)
        runOnJS(onDone)()
    })
  }, [open, dim])
  const { isMounted, close } = useAnimatedPresence(visible, animateIn, animateOut)

  // Every open starts fresh.
  const wasMountedRef = useRef(false)
  if (isMounted && !wasMountedRef.current) {
    wasMountedRef.current = true
    if (activeTab !== initialTab)
      setActiveTab(initialTab)
    if (selected.length)
      setSelected([])
    if (caption)
      setCaption('')
  } else if (!isMounted && wasMountedRef.current) {
    wasMountedRef.current = false
  }

  const isGridTab = activeTab === 'gallery' && hasGrid
  const gallery = useGallery(isMounted && isGridTab)
  const isGridShown = isGridTab && gallery.status !== 'denied' && gallery.status !== 'unavailable' &&
    !(gallery.status === 'ready' && gallery.assets.length === 0)

  useEffect(() => {
    gridMode.value = withTiming(isGridShown ? 1 : 0, CLOSE)
  }, [isGridShown, gridMode])
  useEffect(() => {
    captionShown.value = withTiming(selected.length > 0 ? 1 : 0, { duration: CAPTION_SWAP_MS, easing: DECELERATE, reduceMotion: REDUCE_MOTION })
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

  const runPicker = useCallback((picker: () => Promise<PickedAttachment[]>) => {
    closeThen(() => {
      picker().then(picked => sendPicked(picked)).catch(() => {})
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
    contentShift.value = TAB_CONTENT_SHIFT
    contentShift.value = withSpring(0, TAB_CONTENT_SPRING)
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
    scrollY.value = event.contentOffset.y
  })

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - open.value) * screenHeight }],
  }))
  const dimStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, dim.value) }))
  const backgroundStyle = useAnimatedStyle(() => {
    const gridTop = Math.max(0, spacer - scrollY.value)
    return { transform: [{ translateY: gridTop * gridMode.value + fixedTop * (1 - gridMode.value) }] }
  })
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: contentShift.value }] }))
  const tabsStyle = useAnimatedStyle(() => ({
    opacity: 1 - captionShown.value,
    transform: [{ translateY: TAB_DROP * captionShown.value }],
  }))
  const captionStyle = useAnimatedStyle(() => ({
    opacity: captionShown.value,
    transform: [{ translateY: keyboardHeight.value + insets.bottom * Math.min(1, -keyboardHeight.value / 100) }],
  }))
  const sendStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.2 + 0.8 * captionShown.value }],
  }))

  const gridItems = useMemo<GridItem[]>(
    () => (hasImagePickerCamera() ? ['camera' as const, ...gallery.assets] : gallery.assets),
    [gallery.assets]
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
          onPress={() => runPicker(takePhoto)}
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
        onToggle={toggleAsset}
        styles={styles}
      />
    )
  }, [styles, cellSize, cornerFor, labels, runPicker, selectionIndex, toggleAsset, isRTL])

  const onScrollEndDrag = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    // Pulled down past the top: the sheet goes, as Telegram's does when dragged down.
    if (event.nativeEvent.contentOffset.y < -70)
      dismiss()
  }, [dismiss])

  if (!isMounted)
    return null

  const tabLabel = (tab: AttachmentTab) => ({
    gallery: labels.attachGallery,
    camera: labels.attachCamera,
    file: labels.attachFile,
    location: labels.attachLocation,
  })[tab]

  const renderPanel = () => {
    if (activeTab === 'location') {
      const subtitle = location === 'locating' || location == null
        ? labels.attachLocating
        : location.status === 'located'
          ? (location.accuracy ? formatLabel(labels.attachLocationAccuracy, { meters: Math.round(location.accuracy) }) : '')
          : location.status === 'denied' ? labels.attachLocationDenied : ''
      return (
        <Pressable onPress={sendLocation} style={[styles.locationRow, isRTL && styles.rowReverse]} accessibilityRole='button' accessibilityLabel={labels.attachSendLocation}>
          <View style={styles.locationIcon}>
            <Icon name='location' color='#FFFFFF' size={24} fallback={<PinIcon color='#FFFFFF' size={24} />} />
          </View>
          <View style={styles.locationText}>
            <Text style={[styles.locationTitle, isRTL && styles.textRTL]} numberOfLines={1}>{labels.attachSendLocation}</Text>
            {!!subtitle && <Text style={[styles.locationSubtitle, isRTL && styles.textRTL]} numberOfLines={2}>{subtitle}</Text>}
          </View>
          {location === 'locating' && <ActivityIndicator color={theme.attachments.secondaryText} />}
        </Pressable>
      )
    }

    // The gallery without a grid to show: no library peer, no access, or no photos.
    const message = !hasGrid
      ? null
      : gallery.status === 'denied'
        ? labels.attachPhotosAccess
        : gallery.status === 'ready' ? labels.attachNoPhotos : null
    return (
      <View style={styles.galleryPanel}>
        {!!message && <Text style={styles.panelText}>{message}</Text>}
        {hasImagePicker() && (
          <Pressable onPress={() => runPicker(pickFromSystemGallery)} style={styles.panelButton} accessibilityRole='button'>
            <Text style={styles.panelButtonText}>{labels.attachChooseFromGallery}</Text>
          </Pressable>
        )}
        {gallery.status === 'loading' && <ActivityIndicator color={theme.attachments.secondaryText} />}
      </View>
    )
  }

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
              <Animated.FlatList
                data={gridItems}
                keyExtractor={(item: GridItem) => (item === 'camera' ? 'camera' : item.id)}
                renderItem={renderItem}
                numColumns={COLUMNS}
                columnWrapperStyle={[styles.gridRow, isRTL && styles.rowReverse]}
                ListHeaderComponent={<Pressable style={{ height: spacer + HEADER }} onPress={dismiss} />}
                contentContainerStyle={[styles.grid, { paddingBottom: bottomArea + 16 }]}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                onScrollEndDrag={onScrollEndDrag}
                onEndReached={gallery.loadMore}
                onEndReachedThreshold={1}
                initialNumToRender={12}
                maxToRenderPerBatch={9}
                windowSize={5}
                removeClippedSubviews
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps='handled'
              />
            </Animated.View>
          )
          : (
            <Animated.View style={[styles.panel, { top: fixedTop + HEADER, height: PANEL_HEIGHT }, contentStyle]}>
              {renderPanel()}
            </Animated.View>
          )}

        <Animated.View style={[styles.tabsRow, { bottom: insets.bottom }, tabsStyle]} pointerEvents={selected.length ? 'none' : 'box-none'}>
          <View style={[styles.tabPill, isRTL && styles.rowReverse]}>
            {tabs.map((tab, index) => (
              <TabButton
                key={tab}
                tab={tab}
                index={index}
                label={tabLabel(tab)}
                width={tabWidth}
                isSelected={tab === activeTab}
                onPress={onTabPress}
                styles={styles}
                theme={theme}
              />
            ))}
          </View>
        </Animated.View>

        {selected.length > 0 && (
          <Animated.View style={[styles.captionRow, { bottom: insets.bottom + (TABS_ROW - TAB_PILL) / 2 }, isRTL && styles.rowReverse, captionStyle]}>
            <View style={styles.captionPill}>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder={labels.attachCaption}
                placeholderTextColor={theme.attachments.secondaryText}
                style={[styles.captionInput, isRTL && styles.textRTL]}
                multiline
                keyboardAppearance={isDark ? 'dark' : 'default'}
                accessibilityLabel={labels.attachCaption}
              />
            </View>
            <Animated.View style={sendStyle}>
              <Pressable
                onPress={sendSelection}
                style={styles.sendButton}
                accessibilityRole='button'
                accessibilityLabel={`${labels.send} ${selected.length}`}
              >
                <Icon name='send' color={theme.attachments.sendButtonIcon} size={22} fallback={<Text style={styles.sendFallback}>{'➤'}</Text>} />
                <View style={styles.sendBadge}>
                  <Text style={styles.sendBadgeText} allowFontScaling={false}>{selected.length}</Text>
                </View>
              </Pressable>
            </Animated.View>
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  )
}

const createStyles = (theme: ChatTheme) => {
  const colors = theme.attachments
  return StyleSheet.create({
    dim: {
      backgroundColor: colors.dim,
    },
    background: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      borderTopLeftRadius: SHEET_RADIUS,
      borderTopRightRadius: SHEET_RADIUS,
      backgroundColor: colors.background,
      alignItems: 'center',
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      marginTop: 8,
      backgroundColor: colors.handle,
    },
    grid: {
      paddingHorizontal: GRID_GAP,
    },
    gridRow: {
      gap: GRID_GAP,
      marginBottom: GRID_GAP,
    },
    rowReverse: {
      flexDirection: 'row-reverse',
    },
    textRTL: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    cell: {
      overflow: 'hidden',
      backgroundColor: colors.cellBackground,
    },
    cornerTopLeft: {
      borderTopLeftRadius: GRID_RADIUS,
    },
    cornerTopRight: {
      borderTopRightRadius: GRID_RADIUS,
    },
    cameraCell: {
      backgroundColor: '#1F1F1F',
      alignItems: 'center',
      justifyContent: 'center',
    },
    duration: {
      position: 'absolute',
      left: 4,
      bottom: 4,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
      backgroundColor: theme.colors.mediaTimeBackground,
    },
    durationText: {
      fontSize: 12,
      color: '#FFFFFF',
    },
    checkRing: {
      position: 'absolute',
      top: CHECK_INSET,
      right: CHECK_INSET,
      width: CHECK_SIZE,
      height: CHECK_SIZE,
      borderRadius: CHECK_SIZE / 2,
      borderWidth: 1.5,
      borderColor: '#FFFFFF',
      backgroundColor: 'rgba(0, 0, 0, 0.18)',
    },
    checkDisc: {
      position: 'absolute',
      top: CHECK_INSET,
      right: CHECK_INSET,
      width: CHECK_SIZE,
      height: CHECK_SIZE,
      borderRadius: CHECK_SIZE / 2,
      borderWidth: 1.5,
      borderColor: '#FFFFFF',
      backgroundColor: colors.checkbox,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkStart: {
      right: undefined,
      left: CHECK_INSET,
    },
    checkNumber: {
      fontSize: 14,
      lineHeight: 17,
      fontWeight: '700',
      color: colors.checkboxCheck,
    },
    checkNumberSmall: {
      fontSize: 10,
    },
    panel: {
      position: 'absolute',
      left: 0,
      right: 0,
      paddingHorizontal: 16,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 10,
    },
    locationIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    locationText: {
      flex: 1,
      gap: 2,
    },
    locationTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.tabSelectedText,
    },
    locationSubtitle: {
      fontSize: 13,
      color: colors.secondaryText,
    },
    galleryPanel: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
    },
    panelText: {
      fontSize: 15,
      textAlign: 'center',
      color: colors.secondaryText,
    },
    panelButton: {
      paddingHorizontal: 18,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      backgroundColor: colors.sendButton,
    },
    panelButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.sendButtonIcon,
    },
    tabsRow: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: TABS_ROW,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabPill: {
      height: TAB_PILL,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 4,
      borderRadius: TAB_PILL / 2,
      backgroundColor: colors.tabBackground,
      borderWidth: StyleSheet.hairlineWidth,
      // A stroke rather than a shadow: a shadow on a translucent fill is drawn the slow way.
      borderColor: 'rgba(0, 0, 0, 0.08)',
    },
    tab: {
      height: TAB_PILL - 8,
    },
    tabInner: {
      flex: 1,
      alignItems: 'center',
      paddingTop: 4,
    },
    tabCapsule: {
      ...StyleSheet.absoluteFill,
      borderRadius: (TAB_PILL - 8) / 2,
      backgroundColor: withAlpha(colors.tabSelected, 0.09),
    },
    tabLabel: {
      marginTop: 1,
      fontSize: 11,
      fontWeight: '700',
    },
    tabLabelSelected: {
      fontWeight: '800',
    },
    captionRow: {
      position: 'absolute',
      left: 8,
      right: 8,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
    },
    captionPill: {
      flex: 1,
      minHeight: SEND_SIZE,
      maxHeight: 120,
      borderRadius: SEND_SIZE / 2,
      paddingHorizontal: 16,
      justifyContent: 'center',
      // The tab pill's fill and stroke: it floats over the grid, so a faint cell tint let the
      // photo under it show through the text.
      backgroundColor: colors.tabBackground,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(0, 0, 0, 0.08)',
    },
    captionInput: {
      fontSize: 16,
      paddingTop: 13,
      paddingBottom: 13,
      color: colors.text,
    },
    sendButton: {
      width: SEND_SIZE,
      height: SEND_SIZE,
      borderRadius: SEND_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.sendButton,
    },
    sendFallback: {
      fontSize: 20,
      color: colors.sendButtonIcon,
    },
    sendBadge: {
      position: 'absolute',
      top: -4,
      left: -4,
      minWidth: 22,
      height: 22,
      paddingHorizontal: 5,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.background,
      backgroundColor: colors.sendButton,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.sendButtonIcon,
    },
  })
}
