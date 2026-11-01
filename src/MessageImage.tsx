import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Image,
  StyleSheet,
  View,
  ImageProps,
  ViewStyle,
  StyleProp,
  ImageStyle,
  ImageURISource,
  LayoutChangeEvent,
  useWindowDimensions,
  StatusBar } from 'react-native'
import { GestureHandlerRootView, Touchable } from 'react-native-gesture-handler'
import { OverKeyboardView } from 'react-native-keyboard-controller'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import Zoom from 'react-native-zoom-reanimated'
import { Icon } from './components/Icon'
import { CloseIcon } from './components/MediaControls'
import { isRemoteUri } from './components/mediaDownload'
import {
  MEDIA_BUTTON_SIZE,
  MEDIA_LOADER_BACKGROUND,
  MEDIA_LOADER_ICON,
  MediaInfoPill,
  transferLabel,
} from './components/MediaLoader'
import { clampProgress, useMediaTransfer } from './components/mediaTransfer'
import { suppressPressAfterHold } from './components/messagePress'
import { MediaActionIcon, RadialProgress } from './components/RadialProgress'
import { TouchableOpacity } from './components/TouchableOpacity'
import { useThemedStyles } from './hooks/useTheme'
import { IMessage } from './Models'
import { getExpoImage } from './optional'
import commonStyles from './styles'
import { ChatTheme } from './Theme'

const expoImage = getExpoImage()
const ExpoImage: any = expoImage?.Image ?? null

/** `ImageReceiver`'s crossfade when a photo arrives (`setCrossfadeDuration`, 150ms). */
export const IMAGE_CROSSFADE_MS = 150

type LoadState = 'loading' | 'loaded' | 'error'

/**
 * What sits under a photo until it has loaded: its blurred thumbnail when the message has one,
 * else a plain fill in the bubble's track color.
 */
const ImagePlaceholder = ({ placeholder, style }: { placeholder?: string, style: StyleProp<ImageStyle> }) => {
  const fill = useThemedStyles(createPlaceholderStyles)
  if (placeholder && isRemoteUri(placeholder) || placeholder?.startsWith('file:') || placeholder?.startsWith('data:'))
    return <Image style={[style, StyleSheet.absoluteFill]} source={{ uri: placeholder }} blurRadius={8} resizeMode='cover' />
  if (placeholder && ExpoImage)
    return <ExpoImage style={[style, StyleSheet.absoluteFill]} placeholder={{ blurhash: placeholder }} contentFit='cover' />
  return <View testID='message-image-placeholder' style={[style, StyleSheet.absoluteFill, fill.fill]} />
}

const createPlaceholderStyles = (theme: ChatTheme) => StyleSheet.create({
  fill: {
    backgroundColor: theme.colors.incomingVoiceTrack,
  },
})

interface ModalContentProps {
  isVisible: boolean
  imageSource: ImageURISource
  modalImageDimensions: { width: number, height: number } | undefined
  imageProps?: Partial<ImageProps>
  onClose: () => void
}

function ModalContent({ isVisible, imageSource, modalImageDimensions, imageProps, onClose }: ModalContentProps) {
  const insets = useSafeAreaInsets()

  // Animation values
  const modalOpacity = useSharedValue(0)
  const modalScale = useSharedValue(0.9)
  const modalBorderRadius = useSharedValue(40)

  const handleModalClose = useCallback(() => {
    modalOpacity.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) })
    modalScale.value = withTiming(0.9, { duration: 200, easing: Easing.in(Easing.ease) }, () => {
      runOnJS(onClose)()
    })
    modalBorderRadius.value = withTiming(40, { duration: 200, easing: Easing.in(Easing.ease) })
  }, [onClose, modalOpacity, modalScale, modalBorderRadius])

  // Animate on visibility change
  useEffect(() => {
    if (isVisible) {
      modalOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) })
      modalScale.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) })
      modalBorderRadius.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.ease) })
    }
  }, [isVisible, modalOpacity, modalScale, modalBorderRadius])

  const modalAnimatedStyle = useAnimatedStyle(() => ({
    opacity: modalOpacity.value,
    transform: [{ scale: modalScale.value }],
  }))

  const modalBorderRadiusStyle = useAnimatedStyle(() => ({
    borderRadius: modalBorderRadius.value,
  }))

  return (
    <>
      {/* White on the black viewer, whatever the app's own bar style. */}
      <StatusBar animated barStyle='light-content' />
      <Animated.View style={[styles.modalOverlay, modalAnimatedStyle, modalBorderRadiusStyle]}>
        <GestureHandlerRootView style={commonStyles.fill}>
          <Animated.View style={[commonStyles.fill, styles.modalContent, modalBorderRadiusStyle, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

            {/* close button */}
            <View style={styles.closeButtonContainer}>
              <Touchable onPress={handleModalClose}>
                <View style={styles.closeButtonContent} accessibilityRole='button' accessibilityLabel='Close'>
                  <Icon name='close' color='#fff' size={24} fallback={<CloseIcon color='#fff' size={24} />} />
                </View>
              </Touchable>
            </View>

            <View style={[commonStyles.fill, commonStyles.centerItems]}>
              <Zoom>
                <Image
                  style={modalImageDimensions}
                  source={imageSource}
                  resizeMode='contain'
                  {...imageProps}
                />
              </Zoom>
            </View>
          </Animated.View>
        </GestureHandlerRootView>
      </Animated.View>
    </>
  )
}

export interface MessageImageProps<TMessage extends IMessage> {
  currentMessage: TMessage
  containerStyle?: StyleProp<ViewStyle>
  imageSourceProps?: Partial<ImageURISource>
  imageStyle?: StyleProp<ImageStyle>
  imageProps?: Partial<ImageProps>
}

export function MessageImage<TMessage extends IMessage = IMessage> ({
  containerStyle,
  imageProps,
  imageSourceProps,
  imageStyle,
  currentMessage,
}: MessageImageProps<TMessage>) {
  const [isModalVisible, setIsModalVisible] = useState(false)
  const mediaTransfer = useMediaTransfer()
  const uri = currentMessage?.image
  const transfer = currentMessage?.transfer
  const isDownloadRequired = !!currentMessage?.isDownloadRequired
  const isRemote = isRemoteUri(uri)
  // Telegram's photo button (`ChatMessageCell.updateButtonState`, photos): the cancel ✕ with
  // a ring while it downloads (`buttonState 1`), the download arrow when it is not here or
  // failed (`buttonState 0`), nothing once shown. The app can drive it with `transfer`.
  const [attempt, setAttempt] = useState(0)
  const [isCancelled, setIsCancelled] = useState(false)
  const [isRequested, setIsRequested] = useState(false)
  const loadKey = `${uri}#${attempt}`
  const [loadResult, setLoadResult] = useState<{ key: string, state: LoadState }>()
  const loadState: LoadState = loadResult?.key === loadKey ? loadResult.state : isRemote ? 'loading' : 'loaded'
  const shouldLoad = transfer?.type !== 'download' && !isCancelled && (!isDownloadRequired || isRequested)
  const loadProgress = useSharedValue(0)
  const [loadLabel, setLoadLabel] = useState<string | null>(null)
  // A remote photo fades in over its placeholder; a local one is there at once.
  const imageOpacity = useSharedValue(isRemote ? 0 : 1)
  const imageFadeStyle = useAnimatedStyle(() => ({ opacity: imageOpacity.value }))
  const [imageDimensions, setImageDimensions] = useState<{ width: number, height: number }>()
  const windowDimensions = useWindowDimensions()

  const imageSource = useMemo(() => ({
    ...imageSourceProps,
    uri: currentMessage?.image,
  }), [imageSourceProps, currentMessage?.image])

  const isImageSourceChanged = useRef(true)

  const computedImageStyle = useMemo(() => [
    styles.image,
    imageStyle,
  ], [imageStyle])

  let buttonIcon: MediaActionIcon = 'none'
  if (transfer)
    buttonIcon = 'cancel'
  else if (!shouldLoad || loadState === 'error')
    buttonIcon = 'download'
  else if (loadState === 'loading')
    buttonIcon = 'cancel'

  // Mounted the first time it is needed, then kept so it can fade out (cancel -> none).
  const [hasShownButton, setHasShownButton] = useState(buttonIcon !== 'none')
  if (!hasShownButton && buttonIcon !== 'none')
    setHasShownButton(true)

  const onLoadStart = useCallback(() => {
    loadProgress.value = 0
  }, [loadProgress])
  const onLoadProgress = useCallback((event: { nativeEvent: { loaded: number, total: number } }) => {
    const { loaded, total } = event.nativeEvent
    if (!(total > 0))
      return
    loadProgress.value = loaded / total
    // Re-rendered only when the text changes, not per progress event.
    const label = transferLabel(loaded / total, total)
    setLoadLabel(previous => previous === label ? previous : label)
  }, [loadProgress])
  const onLoad = useCallback(() => {
    setLoadResult({ key: loadKey, state: 'loaded' })
    imageOpacity.value = withTiming(1, { duration: IMAGE_CROSSFADE_MS })
  }, [loadKey, imageOpacity])
  const onError = useCallback(() => {
    setLoadResult({ key: loadKey, state: 'error' })
  }, [loadKey])

  const handleImagePress = useCallback(() => {
    if (!imageSource.uri)
      return

    setIsModalVisible(true)

    if (isImageSourceChanged.current || !imageDimensions)
      Image.getSize(imageSource.uri, (width, height) => {
        setImageDimensions({ width, height })
      })
  }, [imageSource.uri, imageDimensions])

  const handleModalClose = useCallback(() => {
    setIsModalVisible(false)
  }, [])

  const handleImageLayout = useCallback((e: LayoutChangeEvent) => {
    setImageDimensions({
      width: e.nativeEvent.layout.width,
      height: e.nativeEvent.layout.height,
    })
  }, [])

  const modalImageDimensions = useMemo(() => {
    if (!imageDimensions)
      return undefined

    const aspectRatio = imageDimensions.width / imageDimensions.height

    let width = windowDimensions.width
    let height = width / aspectRatio

    if (height > windowDimensions.height) {
      height = windowDimensions.height
      width = height * aspectRatio
    }

    return {
      width,
      height,
    }
  }, [imageDimensions, windowDimensions.height, windowDimensions.width])

  useEffect(() => {
    isImageSourceChanged.current = true
  }, [imageSource.uri])

  if (currentMessage == null)
    return null

  // While the photo is not shown, a tap anywhere on it is the button's.
  const onPress = () => {
    if (transfer) {
      mediaTransfer.onCancel(currentMessage)
      return
    }
    if (buttonIcon === 'download') {
      setIsCancelled(false)
      if (loadState === 'error') {
        imageOpacity.value = 0
        setAttempt(value => value + 1)
      } else if (isDownloadRequired && mediaTransfer.hasDownloadHandler()) {
        mediaTransfer.onDownload(currentMessage)
      } else {
        setIsRequested(true)
      }
      return
    }
    if (buttonIcon === 'cancel') {
      setIsCancelled(true)
      return
    }
    handleImagePress()
  }

  const transferText = transfer
    ? transferLabel(clampProgress(transfer.progress), transfer.totalBytes)
    : buttonIcon === 'cancel' ? loadLabel : null
  const buttonLabel = buttonIcon === 'cancel'
    ? transfer?.type === 'upload' ? 'cancel upload' : 'cancel download'
    : buttonIcon === 'download' ? 'download photo' : undefined

  return (
    <View style={containerStyle}>
      <TouchableOpacity
        onPress={onPress}
        {...suppressPressAfterHold}
        testID='message-image-touchable'
        accessibilityLabel={buttonLabel}
      >
        <View>
          {loadState !== 'loaded' || buttonIcon !== 'none'
            ? <ImagePlaceholder placeholder={currentMessage.imagePlaceholder} style={computedImageStyle} />
            : null}
          {shouldLoad || transfer?.type === 'upload'
            ? (
              <Animated.View style={imageFadeStyle}>
                <Image
                  key={loadKey}
                  testID='message-image'
                  {...imageProps}
                  style={computedImageStyle}
                  source={imageSource}
                  onLayout={handleImageLayout}
                  onLoadStart={onLoadStart}
                  onProgress={onLoadProgress}
                  onLoad={onLoad}
                  onError={onError}
                  resizeMode='cover'
                />
              </Animated.View>
            )
            : <View style={computedImageStyle} onLayout={handleImageLayout} />}
          {hasShownButton && (
            <View style={[StyleSheet.absoluteFill, commonStyles.centerItems]} pointerEvents='none'>
              <RadialProgress
                icon={buttonIcon}
                progress={transfer ? clampProgress(transfer.progress) : loadProgress}
                size={MEDIA_BUTTON_SIZE}
                color={MEDIA_LOADER_ICON}
                backgroundColor={MEDIA_LOADER_BACKGROUND}
              />
            </View>
          )}
          {transferText != null && <MediaInfoPill label={transferText} />}
        </View>
      </TouchableOpacity>

      {/* Mounted only once opened. `ModalContent` holds three shared values and the animated
          styles over them, and `SafeAreaProvider` is a context provider of its own, so leaving
          this in the tree put all of it on every image message in the conversation for a viewer
          almost none of them will ever show. It mounts already-visible, and its open animation
          runs from the same effect that used to react to `isVisible` flipping. */}
      {isModalVisible && (
        <OverKeyboardView visible>
          <SafeAreaProvider>
            <ModalContent
              isVisible
              imageSource={imageSource}
              modalImageDimensions={modalImageDimensions}
              imageProps={imageProps}
              onClose={handleModalClose}
            />
          </SafeAreaProvider>
        </OverKeyboardView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  // `Bubble` insets the photo by 2 and rounds its corners to follow the bubble's. The width is
  // a minimum, not fixed: a caption wider than the photo widens the bubble, and Telegram
  // then widens the photo to fill it (`fixPhotoWidth`, `ChatMessageCell:10268`) rather than
  // leaving a strip of bubble beside it. The source is always a uri, so the image has no
  // intrinsic size of its own to grow to.
  image: {
    minWidth: 240,
    height: 180,
    borderRadius: 15,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  modalImageContainer: {
    width: '100%',
    height: '100%',
  },

  closeButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  closeButtonContent: {
    padding: 20,
  },
})
