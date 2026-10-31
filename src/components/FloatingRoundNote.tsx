import React, { useCallback, useEffect, useRef, useState } from 'react'
import { LayoutChangeEvent, StyleSheet, View } from 'react-native'
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  SharedValue,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import {
  DEFAULT_FLOATING_DOCK,
  FLOATING_NOTE_HIDDEN_SCALE,
  FLOATING_NOTE_MS,
  FLOATING_NOTE_SIZE,
  FloatingArea,
  FloatingDock,
  clampDrag,
  dockPoint,
  dragAlpha,
  settleFloatingNote,
} from './floatingNoteMath'
import {
  NowPlayingEntry,
  useIsMessageViewable,
  useMediaPlaybackController,
  useNowPlaying,
} from './mediaPlayback'
import { RING_EDGE_INSET, RING_OPACITY, RING_STROKE } from './roundNoteChrome'

// Both optional, resolved the way MessageVideo and VideoNoteOverlay do: without
// expo-video there are no round note players to float, and without SVG the
// floating note simply has no progress ring.
let expoVideo: any = null
try {
  expoVideo = require('expo-video')
} catch {
  expoVideo = null
}

let Svg: any = null
let AnimatedCircle: any = null
try {
  const svg = require('react-native-svg')
  Svg = svg.Svg ?? svg.default
  AnimatedCircle = svg.Circle ? Animated.createAnimatedComponent(svg.Circle) : null
} catch {
  Svg = null
  AnimatedCircle = null
}

/** `DecelerateInterpolator`, Telegram's curve for every PiP animation. */
const decelerate = Easing.out(Easing.quad)
/** Telegram starts a drag after 0.3cm of travel; about 11pt. */
const DRAG_START_DISTANCE = 11

/*
 * Where the user last left it, for the next time a note floats. Telegram keeps
 * this in its `pipconfig` preferences; here it lasts for the app session.
 */
let lastDock: FloatingDock = DEFAULT_FLOATING_DOCK

/** The progress ring, Telegram's `radialProgressPaint` arc from 12 o'clock. */
const ProgressRing = ({ progress }: { progress: SharedValue<number> }) => {
  const radius = FLOATING_NOTE_SIZE / 2 - RING_EDGE_INSET
  const circumference = 2 * Math.PI * radius
  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - Math.max(0, Math.min(1, progress.value))),
  }))

  return (
    <View style={[StyleSheet.absoluteFill, styles.ringRotation]} pointerEvents='none'>
      <Svg width='100%' height='100%'>
        <AnimatedCircle
          animatedProps={arcProps}
          cx={FLOATING_NOTE_SIZE / 2}
          cy={FLOATING_NOTE_SIZE / 2}
          r={radius}
          stroke='#FFFFFF'
          strokeOpacity={RING_OPACITY}
          strokeWidth={RING_STROKE}
          strokeLinecap='round'
          fill='none'
          strokeDasharray={[circumference, circumference]}
        />
      </Svg>
    </View>
  )
}

interface FloatingNoteViewProps {
  entry: NowPlayingEntry
  isVisible: boolean
  area: FloatingArea
  onHidden: () => void
}

const FloatingNoteView = ({ entry, isVisible, area, onHidden }: FloatingNoteViewProps) => {
  const controller = useMediaPlaybackController()
  const { messageId, player } = entry as NowPlayingEntry & { player: any }
  const VideoView = expoVideo.VideoView

  const entryRef = useRef(entry)
  entryRef.current = entry
  const toggle = useCallback(() => entryRef.current.toggle(), [])
  const close = useCallback(() => entryRef.current.stop(), [])
  const saveDock = useCallback((dock: FloatingDock) => {
    lastDock = dock
  }, [])

  // Lets the row know its picture is drawn here, so on Android it can take
  // the player back once this view is gone.
  useEffect(() => {
    if (!controller)
      return

    controller.setFloatingNote(messageId)
    return () => {
      if (controller.getFloatingNote() === messageId)
        controller.setFloatingNote(null)
    }
  }, [controller, messageId])

  const start = dockPoint(lastDock, area)
  const x = useSharedValue(start.x)
  const y = useSharedValue(start.y)
  const dragStart = useSharedValue({ x: 0, y: 0 })
  const fade = useSharedValue(1)
  const visibility = useSharedValue(0)
  const areaSV = useSharedValue(area)

  // Re-dock when the area changes size (rotation, keyboard), as Telegram
  // recomputes `getSideCoord` from the remembered side.
  useEffect(() => {
    areaSV.value = area
    const point = dockPoint(lastDock, area)
    x.value = point.x
    y.value = point.y
  }, [area, areaSV, x, y])

  // Appear and disappear: scale 0.8 <-> 1 with a fade (`runShowHideAnimation`).
  useEffect(() => {
    visibility.value = withTiming(isVisible ? 1 : 0, { duration: FLOATING_NOTE_MS, easing: decelerate }, finished => {
      if (finished && !isVisible)
        runOnJS(onHidden)()
    })
  }, [isVisible, visibility, onHidden])

  // The ring follows playback; expo-video has no progress callback, so it is
  // sampled each frame, as the row does.
  const progress = useSharedValue(0)
  useEffect(() => {
    let frame: ReturnType<typeof requestAnimationFrame>
    const tick = () => {
      try {
        const length = player.duration || 0
        progress.value = length > 0 ? Math.min(1, (player.currentTime || 0) / length) : 0
      } catch {
        // player released
      }
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [player, progress])

  const pan = usePanGesture({
    minDistance: DRAG_START_DISTANCE,
    onActivate: () => {
      dragStart.value = { x: x.value, y: y.value }
    },
    onUpdate: event => {
      const next = clampDrag(dragStart.value.x + event.translationX, dragStart.value.y + event.translationY, areaSV.value)
      x.value = next.x
      y.value = next.y
      fade.value = dragAlpha(next.x, areaSV.value.width)
    },
    onDeactivate: event => {
      const settle = settleFloatingNote(x.value, y.value, event.velocityX, areaSV.value, lastDock)
      const timing = { duration: FLOATING_NOTE_MS, easing: decelerate }
      y.value = withTiming(settle.y, timing)
      if (settle.isClosing) {
        // Thrown off the side: slide out, then stop playback
        // (`animateToBoundsMaybe` -> `close` -> `onCloseRunnable`).
        fade.value = withTiming(0, timing)
        x.value = withTiming(settle.x, timing, finished => {
          if (finished)
            runOnJS(close)()
        })
        return
      }

      fade.value = withTiming(1, timing)
      x.value = withTiming(settle.x, timing)
      runOnJS(saveDock)(settle.dock)
    },
  })

  // A tap without a drag pauses or resumes it.
  const tap = useTapGesture({
    onDeactivate: event => {
      if (!event.canceled)
        runOnJS(toggle)()
    },
  })

  const gesture = useCompetingGestures(pan, tap)

  const containerStyle = useAnimatedStyle(() => ({
    opacity: visibility.value * fade.value,
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: FLOATING_NOTE_HIDDEN_SCALE + (1 - FLOATING_NOTE_HIDDEN_SCALE) * visibility.value },
    ],
  }))

  const onAccessibilityAction = useCallback((event: { nativeEvent: { actionName: string } }) => {
    if (event.nativeEvent.actionName === 'activate')
      toggle()
    else if (event.nativeEvent.actionName === 'close')
      close()
  }, [toggle, close])

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[styles.floating, containerStyle]}
        accessible
        accessibilityRole='button'
        accessibilityLabel={entry.isPlaying ? 'pause video note' : 'play video note'}
        accessibilityActions={[
          { name: 'activate' },
          { name: 'close', label: 'close video note' },
        ]}
        onAccessibilityAction={onAccessibilityAction}
        onAccessibilityEscape={close}
      >
        <View style={styles.circle}>
          <VideoView
            style={StyleSheet.absoluteFill}
            player={player}
            fullscreenOptions={{ enable: false }}
            allowsPictureInPicture={false}
            nativeControls={false}
            contentFit='cover'
          />
          {Svg && AnimatedCircle && <ProgressRing progress={progress} />}
        </View>
      </Animated.View>
    </GestureDetector>
  )
}

/**
 * Telegram's floating round video (`PipRoundVideoView`): while a round note is
 * current, playing or paused, and its message has scrolled out of the list, it
 * floats in a 120pt circle docked to the top right. A tap pauses or resumes it,
 * it can be dragged and snaps to the side it is let go near, and throwing it
 * off a side stops the note. It goes away once the message is back on screen,
 * where the note carries on in its row.
 *
 * Drawn over the message list; render it inside the list's area.
 */
export function FloatingRoundNote () {
  const live = useNowPlaying()
  const round = live?.kind === 'round' && live.player ? live : null
  const isViewable = useIsMessageViewable(round?.messageId)
  // `undefined` means the list has not reported yet: do not float on a guess.
  const isFloating = !!round && isViewable === false

  // Keep the last note while it animates away.
  const [shown, setShown] = useState<NowPlayingEntry | null>(null)
  useEffect(() => {
    if (isFloating && round)
      setShown(round)
  }, [isFloating, round])
  const onHidden = useCallback(() => setShown(null), [])

  const [area, setArea] = useState<FloatingArea | null>(null)
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setArea(previous => (previous?.width === width && previous?.height === height ? previous : { width, height }))
  }, [])

  if (!expoVideo?.VideoView)
    return null

  // While visible, follow the live entry (play state, controls); a different
  // note becoming current swaps the view, as Telegram reopens its PiP.
  const entry = isFloating && round ? round : shown

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents='box-none' onLayout={onLayout}>
      {entry && area && area.width > 0 && (
        <FloatingNoteView
          key={String(entry.messageId)}
          entry={entry}
          isVisible={isFloating}
          area={area}
          onHidden={onHidden}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  floating: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: FLOATING_NOTE_SIZE,
    height: FLOATING_NOTE_SIZE,
    borderRadius: FLOATING_NOTE_SIZE / 2,
    // Telegram's `chat_roundVideoShadow`, drawn just below and right of it.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  circle: {
    flex: 1,
    borderRadius: FLOATING_NOTE_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  ringRotation: {
    transform: [{ rotate: '-90deg' }],
  },
})
