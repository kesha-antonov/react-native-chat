import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text } from 'react-native'

import { useLabels } from '../../hooks/useLabels'
import { IMessage } from '../../Models'
import { RecorderChrome } from './RecorderChrome'
import { styles } from './styles'
import { VideoNoteRecorderProps } from './types'
import { useVideoNoteRecording } from './useVideoNoteRecording'
import {
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
  useVideoOutput,
  visionCamera,
} from './visionCameraHooks'

/** Real path: front camera into the round preview (only when native is ready). */
export function LiveVideoNote<TMessage extends IMessage = IMessage> ({
  config,
  onClose,
  onSend,
}: VideoNoteRecorderProps<TMessage>) {
  const labels = useLabels()
  const Camera = visionCamera.Camera
  // The camera can flip to the rear one; a note starts on the front one.
  const [facing, setFacing] = useState<'front' | 'back'>('front')
  const device = useCameraDevice(facing)
  const otherDevice = useCameraDevice(facing === 'front' ? 'back' : 'front')
  const { hasPermission, requestPermission } = useCameraPermission()
  const microphone = useMicrophonePermission()

  // Recording goes through a video output and the recorders it creates; the
  // persistent recorder keeps one file across a flip mid-take. Audio is only
  // recorded with the microphone permission granted.
  const videoOutput = useVideoOutput({ enableAudio: microphone.hasPermission, enablePersistentRecorder: true })
  const outputs = useMemo(() => [videoOutput], [videoOutput])

  const micHasPermission = microphone.hasPermission
  const micRequestPermission = microphone.requestPermission

  useEffect(() => {
    if (!hasPermission)
      requestPermission?.()
    if (!micHasPermission)
      micRequestPermission?.()
  }, [hasPermission, requestPermission, micHasPermission, micRequestPermission])

  // A permission the user actively refused should surface, not leave a dead UI.
  const onPermissionDenied = config?.onPermissionDenied
  useEffect(() => {
    if (hasPermission === false)
      onPermissionDenied?.()
  }, [hasPermission, onPermissionDenied])

  // The camera is only usable with both a device and permission; without this
  // the shutter called startRecording on a null ref, threw, and silently
  // dismissed the whole sheet.
  const canRecord = !!device && hasPermission === true

  const {
    elapsed,
    maxMs,
    isRecording,
    isLocked,
    setIsLocked,
    isPaused,
    onShutterStart,
    onShutterStop,
    onShutterCancel,
    abort,
    togglePause,
  } = useVideoNoteRecording<TMessage>({ config, onClose, onSend, videoOutput, canRecord })

  const [isTorchOn, setIsTorchOn] = useState(false)

  const flipCamera = useCallback(() => {
    setFacing(current => (current === 'front' ? 'back' : 'front'))
  }, [])

  const toggleTorch = useCallback(() => {
    setIsTorchOn(current => !current)
  }, [])

  const hint = !canRecord
    ? (device ? labels.cameraPermission : labels.noCamera)
    : isLocked
      ? labels.stopAndSend
      : isRecording
        ? labels.releaseToSend
        : labels.holdToRecord

  return (
    <RecorderChrome
      elapsed={elapsed}
      maxMs={maxMs}
      isRecording={isRecording}
      isLocked={isLocked}
      isDisabled={!canRecord}
      onStart={onShutterStart}
      onStop={onShutterStop}
      onCancel={onShutterCancel}
      onLock={() => setIsLocked(true)}
      onClose={abort}
      onFlipCamera={otherDevice ? flipCamera : undefined}
      onToggleTorch={device?.hasTorch ? toggleTorch : undefined}
      isTorchOn={isTorchOn}
      onTogglePause={isRecording ? togglePause : undefined}
      isPaused={isPaused}
      cancelLabel={labels.cancel}
      hint={hint}
      preview={
        !device
          ? <Text style={styles.placeholderText}>{labels.noCamera}</Text>
          : hasPermission
            ? (
              <Camera
                style={StyleSheet.absoluteFill}
                device={device}
                isActive
                outputs={outputs}
                torchMode={isTorchOn ? 'on' : 'off'}
              />
            )
            : <Text style={styles.placeholderText}>{labels.cameraPermission}</Text>
      }
    />
  )
}
