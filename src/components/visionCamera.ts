// Optional camera for round video notes, resolved through the optional-peer registry (`src/optional`) so
// the bundle works whether or not the consumer installed `react-native-vision-camera`.
//
// Version 5 rebuilt the library on Nitro: recording goes through a video output
// handed to `<Camera outputs>` and a `Recorder` it creates, instead of methods on
// the camera ref. Its entry point also creates the native `CameraFactory` while it
// loads, so a JS package without the native module behind it (a binary built
// before the dependency was added) throws here and counts as not installed - the
// recorder then falls back to the system camera.

import { getVisionCamera as resolveVisionCamera, hasRoundVideoCapture } from '../optional'

const visionCamera = resolveVisionCamera()

/**
 * vision-camera 5 or newer is installed and its native module is linked.
 * @deprecated Use `getChatCapabilities().roundVideoCapture`.
 */
export const isVisionCameraAvailable = hasRoundVideoCapture()

// Reading a permission status is the cheapest call that crosses into native code.
export const isVisionCameraNativeReady = (() => {
  if (!isVisionCameraAvailable)
    return false
  try {
    return typeof visionCamera.VisionCamera.cameraPermissionStatus === 'string'
  } catch {
    return false
  }
})()

/** The `react-native-vision-camera` module; only read it when `isVisionCameraAvailable`. */
export const getVisionCamera = (): any => visionCamera

export type CameraPermissionStatus = 'not-determined' | 'authorized' | 'denied' | 'restricted'

export function getCameraPermissionStatus (): CameraPermissionStatus {
  return visionCamera?.VisionCamera?.cameraPermissionStatus ?? 'authorized'
}

export function getMicrophonePermissionStatus (): CameraPermissionStatus {
  return visionCamera?.VisionCamera?.microphonePermissionStatus ?? 'authorized'
}

/** Resolves `true` once the permission is granted. */
export async function requestCameraPermission (): Promise<boolean> {
  return (await visionCamera?.VisionCamera?.requestCameraPermission?.()) ?? true
}

/** Resolves `true` once the permission is granted. */
export async function requestMicrophonePermission (): Promise<boolean> {
  return (await visionCamera?.VisionCamera?.requestMicrophonePermission?.()) ?? true
}

export interface RecordingCallbacks {
  onRecordingFinished: (video: { path: string }) => void
  onRecordingError: (error: unknown) => void
}

/**
 * The recording controls the round-note code drives, the shape vision-camera 4
 * exposed on its camera ref. Every method is safe to call at any time: before a
 * take has started they wait for it, after it has ended they do nothing.
 */
export interface VideoNoteRecorderController {
  startRecording: (callbacks: RecordingCallbacks) => void
  stopRecording: () => Promise<void>
  cancelRecording: () => Promise<void>
  pauseRecording: () => Promise<void>
  resumeRecording: () => Promise<void>
}

/**
 * Wraps a vision-camera 5 video output (`useVideoOutput`) in start/stop/pause
 * controls. Each take gets a fresh `Recorder`; creating it is asynchronous, so a
 * stop that arrives first waits for the take to have actually started.
 */
export function createVideoNoteRecorder (videoOutput: any): VideoNoteRecorderController {
  let take: { cancelled: boolean, recorder: any, work: Promise<void> } | null = null

  const control = (action: (recorder: any) => Promise<void>) => {
    const current = take
    if (!current)
      return Promise.resolve()

    const work = current.work.then(async () => {
      if (current.recorder?.isRecording)
        await action(current.recorder)
    })
    current.work = work.catch(() => {})
    return work
  }

  return {
    startRecording ({ onRecordingFinished, onRecordingError }) {
      const current = { cancelled: false, recorder: null, work: Promise.resolve() }
      take = current
      current.work = (async () => {
        const recorder = await videoOutput.createRecorder({})
        if (current.cancelled)
          return

        current.recorder = recorder
        await recorder.startRecording(
          (filePath: string) => onRecordingFinished({ path: filePath }),
          onRecordingError
        )
      })().catch(onRecordingError)
    },
    stopRecording () {
      return control(recorder => recorder.stopRecording())
    },
    cancelRecording () {
      if (take)
        take.cancelled = true
      return control(recorder => recorder.cancelRecording())
    },
    pauseRecording () {
      return control(async recorder => {
        if (!recorder.isPaused)
          await recorder.pauseRecording()
      })
    },
    resumeRecording () {
      return control(async recorder => {
        if (recorder.isPaused)
          await recorder.resumeRecording()
      })
    },
  }
}

// CameraX's own failures of a single control call, as vision-camera's Android side reports them
// (the Java exception text travels in the message).
const CAMERA_CONTROL_FAILURE = /CameraControl\$OperationCanceledException|Camera is not active|No flash unit/

/**
 * A failed zoom, torch or focus call, which leaves the camera session running, as opposed to a
 * failure of the camera itself. vision-camera reports both through `<Camera onError>`.
 */
export function isCameraControlError (error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return CAMERA_CONTROL_FAILURE.test(message)
}
