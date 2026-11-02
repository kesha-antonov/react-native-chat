import React, { RefObject, useCallback, useImperativeHandle } from 'react'
import { Alert, Platform } from 'react-native'

import { useLabels } from '../../hooks/useLabels'
import { IMessage } from '../../Models'
import { confirmTrimOnResume, shouldConfirmTrimOnResume } from '../recordingFeedback'
import { RecordingMeter } from '../recordingMeter'
import { clipsDuration, renderClips, trimClips, VoiceClip } from '../voiceEditing'
import { viewOnceFields } from './recorder'
import { VoiceMessageInputHandle, VoiceMessageInputProps, VoiceRecordingPreview } from './types'

interface UseTakePreviewActionsOptions {
  ref: React.Ref<VoiceMessageInputHandle>
  config: VoiceMessageInputProps['config']
  onSend: VoiceMessageInputProps['onSend']
  labels: ReturnType<typeof useLabels>
  meter: RecordingMeter
  preview: VoiceRecordingPreview | null
  setPreview: (preview: VoiceRecordingPreview | null) => void
  setIsLocked: (isLocked: boolean) => void
  setIsResuming: (isResuming: boolean) => void
  clipsRef: RefObject<VoiceClip[]>
  trimRef: RefObject<{ start: number, end: number }>
  isViewOnceRef: RefObject<boolean>
  start: (isResume?: boolean) => Promise<void>
  stopTake: (outcome: 'send' | 'cancel' | 'preview') => Promise<void>
}

/**
 * What a paused take can do: be cancelled, trimmed, sent or resumed. Also
 * exposes `cancel` and `trim` on the component's handle.
 */
export function useTakePreviewActions ({
  ref,
  config,
  onSend,
  labels,
  meter,
  preview,
  setPreview,
  setIsLocked,
  setIsResuming,
  clipsRef,
  trimRef,
  isViewOnceRef,
  start,
  stopTake,
}: UseTakePreviewActionsOptions) {
  const cancel = useCallback(() => {
    if (preview) {
      clipsRef.current = []
      setPreview(null)
      return
    }

    stopTake('cancel')
  }, [preview, stopTake, clipsRef, setPreview])

  const trim = useCallback((startFraction: number, endFraction: number) => {
    trimRef.current = { start: startFraction, end: endFraction }
  }, [trimRef])

  useImperativeHandle(ref, () => ({ cancel, trim }), [cancel, trim])

  /** The clips cut down to the preview's trim handles. */
  const trimmedClips = useCallback(() => {
    const { start: from, end: to } = trimRef.current
    const clips = clipsRef.current
    if (from <= 0 && to >= 1)
      return clips

    const total = clipsDuration(clips)
    return trimClips(clips, from * total, to * total)
  }, [clipsRef, trimRef])

  const isTrimmed = useCallback(() => trimRef.current.start > 0 || trimRef.current.end < 1, [trimRef])

  const sendPreview = useCallback(async () => {
    if (!preview)
      return

    setPreview(null)

    // Untrimmed, the preview's file is already the whole take.
    if (!isTrimmed()) {
      clipsRef.current = []
      onSend?.({ audio: preview.uri, duration: Math.round(preview.durationMs / 1000), ...viewOnceFields(isViewOnceRef.current) } as Partial<IMessage>, false)
      return
    }

    const clips = trimmedClips()
    clipsRef.current = []
    // A promise chain: the compiler cannot lower the optional calls inside a `try`.
    await renderClips(clips)
      .then(uri => {
        onSend?.({ audio: uri, duration: Math.round(clipsDuration(clips) / 1000), ...viewOnceFields(isViewOnceRef.current) } as Partial<IMessage>, false)
      })
      .catch(error => {
        config?.onError?.(error)
      })
  }, [preview, onSend, config, trimmedClips, clipsRef, isTrimmed, isViewOnceRef, setPreview])

  // Resume: cut the take to the handles, then record onto its end.
  const resume = useCallback(() => {
    const go = () => {
      clipsRef.current = trimmedClips()
      trimRef.current = { start: 0, end: 1 }
      meter.elapsed.set(clipsDuration(clipsRef.current))
      setIsLocked(true)
      setIsResuming(true)
      start(true)
    }

    // Ask once before a trim throws audio away for good.
    if (isTrimmed() && shouldConfirmTrimOnResume() && Platform.OS !== 'web') {
      Alert.alert(labels.trimRecordingTitle, labels.trimRecordingText, [
        { text: labels.cancel, style: 'cancel' },
        {
          text: labels.ok,
          onPress: () => {
            confirmTrimOnResume()
            go()
          },
        },
      ])
      return
    }

    go()
  }, [labels, start, trimmedClips, meter, clipsRef, isTrimmed, setIsLocked, setIsResuming, trimRef])

  return { sendPreview, resume }
}
