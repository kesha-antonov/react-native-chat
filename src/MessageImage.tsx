import React, { useCallback, useMemo, useState } from 'react'
import {
  Image,
  StyleSheet,
  View,
  ImageProps,
  ViewStyle,
  StyleProp,
  ImageStyle,
  ImageURISource } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { isRemoteUri } from './components/mediaDownload'
import {
  MEDIA_BUTTON_SIZE,
  MEDIA_LOADER_BACKGROUND,
  MEDIA_LOADER_ICON,
  MediaInfoPill,
  transferLabel,
} from './components/MediaLoader'
import { clampProgress, useMediaTransfer } from './components/mediaTransfer'
import { useMediaGallery } from './components/mediaViewer/gallery'
import { MediaViewer } from './components/mediaViewer/MediaViewer'
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
  const gallery = useMediaGallery()
  // Outside a `Chat` there is no gallery: the viewer opens on this photo alone.
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const mediaTransfer = useMediaTransfer()
  const uri = currentMessage?.image
  const transfer = currentMessage?.transfer
  const isDownloadRequired = !!currentMessage?.isDownloadRequired
  const isRemote = isRemoteUri(uri)
  // The photo button: the cancel ✕ with a ring while it downloads, the download arrow when
  // it is not here or failed, nothing once shown. The app can drive it with `transfer`.
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

  const imageSource = useMemo(() => ({
    ...imageSourceProps,
    uri: currentMessage?.image,
  }), [imageSourceProps, currentMessage?.image])

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
    loadProgress.set(0)
  }, [loadProgress])
  const onLoadProgress = useCallback((event: { nativeEvent: { loaded: number, total: number } }) => {
    const { loaded, total } = event.nativeEvent
    if (!(total > 0))
      return
    loadProgress.set(loaded / total)
    // Re-rendered only when the text changes, not per progress event.
    const label = transferLabel(loaded / total, total)
    setLoadLabel(previous => previous === label ? previous : label)
  }, [loadProgress])
  const onLoad = useCallback(() => {
    setLoadResult({ key: loadKey, state: 'loaded' })
    imageOpacity.set(withTiming(1, { duration: IMAGE_CROSSFADE_MS }))
  }, [loadKey, imageOpacity])
  const onError = useCallback(() => {
    setLoadResult({ key: loadKey, state: 'error' })
  }, [loadKey])

  const handleImagePress = useCallback(() => {
    if (!imageSource.uri || !currentMessage)
      return
    if (gallery)
      gallery.open(currentMessage._id)
    else
      setIsViewerOpen(true)
  }, [imageSource.uri, currentMessage, gallery])

  const closeViewer = useCallback(() => setIsViewerOpen(false), [])

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
        imageOpacity.set(0)
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
    // Always a label: Android keeps the last one when it is cleared, so a shown photo went on
    // announcing "cancel download".
    : buttonIcon === 'download' ? 'download photo' : 'photo'

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
                  onLoadStart={onLoadStart}
                  onProgress={onLoadProgress}
                  onLoad={onLoad}
                  onError={onError}
                  resizeMode='cover'
                />
              </Animated.View>
            )
            : <View style={computedImageStyle} />}
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

      {isViewerOpen && (
        <MediaViewer items={[currentMessage]} initialIndex={0} imageProps={imageProps} onClose={closeViewer} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  // `Bubble` insets the photo by 2 and rounds its corners to follow the bubble's. The width is
  // a minimum, not fixed: a caption wider than the photo widens the bubble, and the photo
  // then widens to fill it rather than
  // leaving a strip of bubble beside it. The source is always a uri, so the image has no
  // intrinsic size of its own to grow to.
  image: {
    minWidth: 240,
    height: 180,
    borderRadius: 15,
  },
})
