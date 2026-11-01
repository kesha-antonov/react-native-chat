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
import { suppressPressAfterHold } from './components/messagePress'
import { TouchableOpacity } from './components/TouchableOpacity'
import { IMessage } from './Models'
import commonStyles from './styles'

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

  return (
    <View style={containerStyle}>
      <TouchableOpacity onPress={handleImagePress} {...suppressPressAfterHold} testID='message-image-touchable'>
        <Image
          {...imageProps}
          style={computedImageStyle}
          source={imageSource}
          onLayout={handleImageLayout}
          resizeMode='cover'
        />
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
