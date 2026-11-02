import { useCallback, useRef } from 'react'
import { GestureStateManager, usePanGesture } from 'react-native-gesture-handler'
import { ReduceMotion, SharedValue, runOnJS, withTiming } from 'react-native-reanimated'
import { recordingHaptic } from '../components/recordingFeedback'
import {
  FADE_MS,
  angleToFraction,
  isSeekTouch,
  isWrap,
  knobPoint,
  pausedAmount,
  ringRadius,
  useRoundNoteChrome,
} from '../components/roundNoteChrome'
import { SEEK_THROTTLE_MS } from './constants'
import { setPlayer } from './videoPlayers'

interface RingSeekOptions {
  player: any
  isViewOnce: boolean
  isCurrent: boolean
  isPlaying: boolean
  total: number
  sizeSV: SharedValue<number>
  chrome: ReturnType<typeof useRoundNoteChrome>
  setCurrentTime: (time: number) => void
  resume: () => void
}

// Scrub a paused note by dragging around its ring (`checkRoundSeekbar`).
// The drag only starts on the knob or the outer band, so a tap in the
// middle still resumes.
export const useRingSeek = ({
  player,
  isViewOnce,
  isCurrent,
  isPlaying,
  total,
  sizeSV,
  chrome,
  setCurrentTime,
  resume,
}: RingSeekOptions) => {
  // A view-once note plays straight through: no scrubbing back over it.
  const canSeek = !isViewOnce && isCurrent && !isPlaying && total > 0
  const lastSeekAtRef = useRef(0)

  const seekTo = useCallback((fraction: number, isFinal: boolean) => {
    const now = Date.now()
    if (!isFinal && now - lastSeekAtRef.current < SEEK_THROTTLE_MS)
      return

    lastSeekAtRef.current = now
    const time = fraction * total
    setCurrentTime(time)
    try {
      setPlayer(player, { currentTime: time })
    } catch {
      return
    }
    if (isFinal)
      resume()
  }, [total, player, resume, setCurrentTime])

  // The knob follows the finger on the UI thread; only the seek itself
  // goes through JS, throttled.
  const track = (x: number, y: number) => {
    'worklet'
    const fraction = angleToFraction(sizeSV.get(), x, y)
    // Wrapping past 12 o'clock leaves the old arc to fade out rather than
    // jumping, with one tick per wrap.
    if (isWrap(chrome.progress.get(), fraction)) {
      if (chrome.wrapAlpha.get() === 0)
        runOnJS(recordingHaptic)()
      chrome.wrapProgress.set(chrome.progress.get())
      chrome.wrapAlpha.set(1)
      chrome.wrapAlpha.set(withTiming(0, { duration: FADE_MS }))
    }
    chrome.progress.set(fraction)
    return fraction
  }

  return usePanGesture({
    enabled: canSeek,
    manualActivation: true,
    onTouchesDown: event => {
      const touch = event.changedTouches[0]
      const size = sizeSV.get()
      const pause = pausedAmount(chrome.pause.get(), chrome.isPaused.get())
      const knob = knobPoint(size, ringRadius(size, chrome.grow.get(), pause), chrome.progress.get())
      if (isSeekTouch(size, knob, touch.x, touch.y)) {
        // `roundToPauseProgress2`: the knob swells under the finger.
        chrome.drag.set(withTiming(1, { duration: FADE_MS, reduceMotion: ReduceMotion.Never }))
        GestureStateManager.activate(event.handlerTag)
      } else {
        GestureStateManager.fail(event.handlerTag)
      }
    },
    onUpdate: event => {
      runOnJS(seekTo)(track(event.x, event.y), false)
    },
    onDeactivate: event => {
      runOnJS(seekTo)(track(event.x, event.y), true)
    },
    onFinalize: () => {
      chrome.drag.set(withTiming(0, { duration: FADE_MS, reduceMotion: ReduceMotion.Never }))
    },
  })
}
