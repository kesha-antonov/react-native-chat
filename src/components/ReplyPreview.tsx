import React, { useEffect } from 'react'
import {
  Image,
  ImageStyle,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  interpolate,
  runOnJS,
} from 'react-native-reanimated'

import { useLabels } from '../hooks/useLabels'
import { useThemedStyles } from '../hooks/useTheme'
import { formatLabel } from '../i18n'
import { ReplyMessage } from '../Models'
import { ChatTheme } from '../Theme'
import { Icon } from './Icon'
import { CloseIcon, PencilIcon, ReplyArrowIcon } from './MediaControls'

const ANIMATION_DURATION = 200
const ANIMATION_EASING = Easing.bezier(0.25, 0.1, 0.25, 1)
const DEFAULT_HEIGHT = 68

export interface ReplyPreviewProps {
  /** The reply message to preview */
  replyMessage: ReplyMessage
  /** Callback to clear the reply */
  onClearReply?: () => void
  /** Banner mode: replying to a message, or editing one. Default 'reply'. */
  mode?: 'reply' | 'edit'
  /** Container style */
  containerStyle?: StyleProp<ViewStyle>
  /** Text style */
  textStyle?: StyleProp<TextStyle>
  /** Image style */
  imageStyle?: StyleProp<ImageStyle>
}

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  borderIndicator: {
    backgroundColor: theme.colors.accent,
    borderRadius: 2,
    width: 3,
    alignSelf: 'stretch',
    marginVertical: 8,
  },
  clearButton: {
    alignItems: 'center',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  clearButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.placeholder,
  },
  // Flush banner: full-bleed inside the bar, sharing the bar background with a
  // bottom hairline, so it reads as the composer growing a header.
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    paddingHorizontal: theme.spacing.screenEdge,
    backgroundColor: theme.colors.inputBarBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.separator,
  },
  leadingIcon: {
    marginRight: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  image: {
    borderRadius: 4,
    height: 40,
    marginRight: 8,
    width: 40,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  text: {
    fontSize: 14,
    color: theme.colors.inputText,
  },
  username: {
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  wrapper: {
    overflow: 'hidden',
  },
})

export function ReplyPreview ({
  replyMessage,
  onClearReply,
  mode = 'reply',
  containerStyle,
  textStyle,
  imageStyle,
}: ReplyPreviewProps) {
  const styles = useThemedStyles(createStyles)
  const labels = useLabels()

  const animationProgress = useSharedValue(0)
  const contentHeight = useSharedValue(DEFAULT_HEIGHT)

  // Animate in on mount
  useEffect(() => {
    animationProgress.value = withTiming(1, {
      duration: ANIMATION_DURATION,
      easing: ANIMATION_EASING,
    })
  }, [animationProgress])

  const handleClear = () => {
    'worklet'
    animationProgress.value = withTiming(0, {
      duration: ANIMATION_DURATION,
      easing: ANIMATION_EASING,
    }, finished => {
      if (finished && onClearReply)
        runOnJS(onClearReply)()
    })
  }

  const wrapperAnimatedStyle = useAnimatedStyle(() => {
    const height = interpolate(
      animationProgress.value,
      [0, 1],
      [0, contentHeight.value]
    )

    const opacity = interpolate(
      animationProgress.value,
      [0, 0.5, 1],
      [0, 0.5, 1]
    )

    return {
      height,
      opacity,
    }
  })

  const displayName = replyMessage.user?.name || 'Unknown'
  const accent = styles.username.color
  const title = mode === 'edit' ? labels.editing : formatLabel(labels.replyingTo, { name: displayName })

  return (
    <Animated.View style={[styles.wrapper, wrapperAnimatedStyle]}>
      <View
        style={[
          styles.container,
          containerStyle,
        ]}
        onLayout={e => {
          const newHeight = e.nativeEvent.layout.height + 8
          // Animate height change smoothly when content changes
          contentHeight.value = withTiming(newHeight, {
            duration: ANIMATION_DURATION,
            easing: ANIMATION_EASING,
          })
        }}
      >
        <View style={styles.leadingIcon}>
          {mode === 'edit'
            ? <Icon name='pencil' color={accent} size={18} fallback={<PencilIcon color={accent} size={18} />} />
            : <Icon name='reply' color={accent} size={18} fallback={<ReplyArrowIcon color={accent} size={18} />} />}
        </View>
        <View style={styles.borderIndicator} />
        <View style={styles.content}>
          <View style={styles.row}>
            {replyMessage.image && (
              <Image
                source={{ uri: replyMessage.image }}
                style={[styles.image, imageStyle]}
              />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.username} numberOfLines={1}>
                {title}
              </Text>
              {replyMessage.text && (
                <Text
                  style={[
                    styles.text,
                    textStyle,
                  ]}
                  numberOfLines={2}
                >
                  {replyMessage.text}
                </Text>
              )}
            </View>
          </View>
        </View>
        <Pressable
          style={styles.clearButton}
          onPress={handleClear}
          hitSlop={8}
        >
          <Icon name='close' color={styles.clearButtonText.color} size={16} fallback={<CloseIcon color={styles.clearButtonText.color} size={16} />} />
        </Pressable>
      </View>
    </Animated.View>
  )
}
