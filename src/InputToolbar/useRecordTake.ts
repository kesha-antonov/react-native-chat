import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSharedValue } from 'react-native-reanimated'

import { useChatOverlay } from '../components/ChatOverlay'
import { RecordExitReason, useRecordSlideDistance } from '../components/RecordButton'
import { CANCEL_LINGER_MS } from '../components/RecordingBar'
import { createRecordingMeter } from '../components/recordingMeter'
import { useVideoNoteSession } from '../components/VideoNoteCapture'
import { VoiceMessageInputHandle, VoiceRecordingState } from '../components/VoiceMessageInput'
import { IMessage, VideoRecordingProps } from '../Models'
import { OnSend } from './types'

interface UseRecordTakeOptions<TMessage extends IMessage> {
  videoConfig: VideoRecordingProps | undefined
  onSend: OnSend<TMessage> | undefined
  closeEmoji: () => void
}

/**
 * The take in progress, voice or video: whether it is recording, paused into a preview, or
 * lingering after a cancel, and how the last one ended.
 */
export function useRecordTake<TMessage extends IMessage> ({ videoConfig, onSend, closeEmoji }: UseRecordTakeOptions<TMessage>) {
  // Recording state is owned by VoiceMessageInput (it holds the recorder) and
  // by the video session; both report up here so the bar - timer, "slide to
  // cancel", CANCEL once locked, the paused take's preview - can span the full
  // input row.
  const [voiceState, setVoiceState] = useState<VoiceRecordingState>({
    active: false, locked: false, elapsed: 0, cancelArmed: false, levels: [], preview: null,
  })
  // The running time and loudness of a take, ticking ten times a second: the timer and the
  // record button read them from here, so a tick does not re-render the composer.
  const [meter] = useState(createRecordingMeter)
  // The voice input reports its whole state on every tick; only a change in what the bar
  // shows (not the time or the level) is worth a render here.
  const updateVoiceState = useCallback((next: VoiceRecordingState) => {
    setVoiceState(prev =>
      prev.active === next.active &&
      prev.locked === next.locked &&
      prev.cancelArmed === next.cancelArmed &&
      prev.preview === next.preview
        ? prev
        : next
    )
  }, [])
  const voiceRef = useRef<VoiceMessageInputHandle>(null)
  const trimVoicePreview = useCallback((start: number, end: number) => {
    voiceRef.current?.trim(start, end)
  }, [])
  // The record button's cancel slide on the UI thread, so "slide to cancel"
  // can follow the circle without a render per frame.
  const slideProgress = useSharedValue(1)
  const slideDistance = useRecordSlideDistance()

  const videoSession = useVideoNoteSession<TMessage>({ config: videoConfig, onSend, elapsedStore: meter.elapsed })

  // The camera preview is drawn over the message list by `Chat`; outside a
  // Chat it falls back to sitting above the toolbar.
  const setOverlay = useChatOverlay()
  const videoOverlay = videoSession.overlay
  useEffect(() => {
    setOverlay?.(videoOverlay)
  }, [setOverlay, videoOverlay])
  useEffect(() => () => setOverlay?.(null), [setOverlay])

  // Voice and video share the recording bar.
  const isVideoTake = videoSession.isActive
  const recording = isVideoTake
    ? {
      active: !videoSession.preview,
      locked: videoSession.isLocked,
    }
    : voiceState
  const voicePreview = isVideoTake ? null : voiceState.preview ?? null
  const videoPreview = isVideoTake ? videoSession.preview : null
  const isPreviewing = !!voicePreview || !!videoPreview
  const isRecordingActive = recording.active
  const isTakeInProgress = isRecordingActive || isPreviewing

  // A take replaces the field, so the emoji panel goes with it.
  useEffect(() => {
    if (isTakeInProgress)
      closeEmoji()
  }, [isTakeInProgress, closeEmoji])

  // A cancelled take keeps the bar up a moment for the trash can, then the
  // composer comes back (`recordDeleteImageView`).
  const [isCancelLingering, setIsCancelLingering] = useState(false)
  const lingerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRecordingActiveRef = useRef(isRecordingActive)
  useLayoutEffect(() => {
    isRecordingActiveRef.current = isRecordingActive
  })
  const startCancelLinger = useCallback(() => {
    // Only a bar that is showing has anything to animate out.
    if (!isRecordingActiveRef.current)
      return

    if (lingerTimerRef.current)
      clearTimeout(lingerTimerRef.current)
    setIsCancelLingering(true)
    lingerTimerRef.current = setTimeout(() => {
      lingerTimerRef.current = null
      setIsCancelLingering(false)
    }, CANCEL_LINGER_MS)
  }, [])

  // How and when the last take ended, for the composer's way back in.
  const [lastExit, setLastExit] = useState<{ reason: 'send' | 'cancel', at: number }>({ reason: 'cancel', at: 0 })

  const onRecordExit = useCallback((reason: RecordExitReason) => {
    if (reason !== 'preview')
      setLastExit({ reason, at: Date.now() })
    if (reason === 'cancel')
      startCancelLinger()
  }, [startCancelLinger])

  // A new take over a lingering bar takes the bar back.
  useEffect(() => {
    if (!isRecordingActive || !lingerTimerRef.current)
      return

    clearTimeout(lingerTimerRef.current)
    lingerTimerRef.current = null
    setIsCancelLingering(false)
  }, [isRecordingActive])
  useEffect(() => () => {
    if (lingerTimerRef.current)
      clearTimeout(lingerTimerRef.current)
  }, [])

  // The composer comes back with a fade only after a take, not on first mount.
  const [hasHadTake, setHasHadTake] = useState(false)
  if (isTakeInProgress && !hasHadTake)
    setHasHadTake(true)

  const cancelRecording = useCallback(() => {
    setLastExit({ reason: 'cancel', at: Date.now() })
    startCancelLinger()
    if (videoSession.isActive)
      videoSession.finish(true)
    else
      voiceRef.current?.cancel()
  }, [videoSession, startCancelLinger])

  return {
    meter,
    updateVoiceState,
    voiceRef,
    trimVoicePreview,
    slideProgress,
    slideDistance,
    videoSession,
    setOverlay,
    videoOverlay,
    isVideoTake,
    recording,
    voicePreview,
    videoPreview,
    isPreviewing,
    isRecordingActive,
    isTakeInProgress,
    isCancelLingering,
    lastExit,
    onRecordExit,
    hasHadTake,
    cancelRecording,
  }
}
