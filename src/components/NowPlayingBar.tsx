import React, { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { useLabels } from '../hooks/useLabels'
import { useThemedStyles } from '../hooks/useTheme'
import { ChatTheme } from '../Theme'
import { CloseIcon } from './MediaControls'
import { NowPlayingEntry, useNowPlaying, usePlaybackRate } from './mediaPlayback'
import { PlaybackSpeedPill } from './PlaybackSpeedPill'
import { PlayPauseIcon } from './PlayPauseIcon'

/** Telegram's bar is 36dp tall and slides in by its own height over 200ms. */
const BAR_HEIGHT = 36
/** `PlayPauseDrawable(16)` in the 36dp play button. */
const PLAY_ICON_SIZE = 16
const SLIDE_MS = 200

export interface NowPlayingBarProps {
  /** Looks up the sender of the playing note, for the title. */
  getSenderName: (messageId: string | number) => string | undefined
  /** A tap on the title jumps to the playing message. */
  onPressTitle?: (messageId: string | number) => void
}

/**
 * Telegram's "now playing" bar (`FragmentContextView`, audio style), shown at
 * the top of the chat while a voice or round note owns playback: play/pause,
 * the sender and the kind of note, the playback speed, and close, which stops
 * it. It pushes the list down rather than covering it, as Telegram does.
 */
export function NowPlayingBar ({ getSenderName, onPressTitle }: NowPlayingBarProps) {
  const styles = useThemedStyles(createStyles)
  const labels = useLabels()
  const rate = usePlaybackRate()
  const live = useNowPlaying()

  // Keep showing the last note while the bar slides away.
  const [shown, setShown] = useState<NowPlayingEntry | null>(live)
  const height = useSharedValue(live ? BAR_HEIGHT : 0)
  const isFirst = useRef(true)

  useEffect(() => {
    if (live)
      setShown(live)

    const animate = !isFirst.current
    isFirst.current = false
    const target = live ? BAR_HEIGHT : 0
    if (!animate) {
      height.value = target
      return
    }

    height.value = withTiming(target, { duration: SLIDE_MS, easing: Easing.out(Easing.quad) }, finished => {
      if (finished && target === 0)
        runOnJS(setShown)(null)
    })
  }, [live, height])

  const barStyle = useAnimatedStyle(() => ({ height: height.value }))

  if (!shown)
    return null

  const entry = live ?? shown
  const sender = getSenderName(entry.messageId)
  const kind = entry.kind === 'round' ? labels.videoMessage : labels.voiceMessage
  const title = sender ? `${sender} ${kind}` : kind

  return (
    <Animated.View style={[styles.bar, barStyle]}>
      <View style={styles.row}>
        <Pressable
          onPress={entry.toggle}
          hitSlop={6}
          accessibilityRole='button'
          accessibilityLabel={entry.isPlaying ? 'pause' : 'play'}
          style={styles.button}
        >
          <PlayPauseIcon isPlaying={entry.isPlaying} color={styles.accent.color} size={PLAY_ICON_SIZE} />
        </Pressable>
        <Pressable
          onPress={() => onPressTitle?.(entry.messageId)}
          accessibilityRole='button'
          accessibilityLabel={title}
          style={styles.titleArea}
        >
          <Text style={styles.title} numberOfLines={1} ellipsizeMode='middle'>
            {/* The sender in bold, then the kind of note (a `TypefaceSpan` over
                `getMusicAuthor()` in `FragmentContextView`). */}
            {sender ? <Text style={styles.sender}>{sender} </Text> : null}
            {kind}
          </Text>
        </Pressable>
        <View style={styles.button}>
          <PlaybackSpeedPill rate={rate} />
        </View>
        <Pressable
          onPress={entry.stop}
          hitSlop={6}
          accessibilityRole='button'
          accessibilityLabel='stop playback'
          style={styles.button}
        >
          <CloseIcon color={styles.muted.color} size={14} />
        </Pressable>
      </View>
    </Animated.View>
  )
}

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  bar: {
    overflow: 'hidden',
    backgroundColor: theme.colors.inputBarBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.separator,
  },
  // Laid out at full height and revealed by the bar's growing height, so the
  // contents slide in rather than squash. Telegram's play button is a 36dp
  // square flush with the left edge, the title starts right after it, and the
  // speed and close buttons are 36dp squares with the close 4dp from the right.
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  button: {
    width: BAR_HEIGHT,
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleArea: {
    flex: 1,
    height: BAR_HEIGHT,
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    color: theme.colors.inputText,
  },
  sender: {
    fontWeight: '600',
  },
  accent: {
    color: theme.colors.accent,
  },
  muted: {
    color: theme.colors.placeholder,
  },
})
