// Optional camera for round video notes, resolved through a try/catch require so
// the bundle works whether or not the consumer installed `react-native-vision-camera`.
//
// Version 5 rebuilt the library on Nitro: recording goes through a video output
// handed to `<Camera outputs>` and a `Recorder` it creates, instead of methods on
// the camera ref. Its entry point also creates the native `CameraFactory` while it
// loads, so a JS package without the native module behind it (a binary built
// before the dependency was added) throws here and counts as not installed - the
// recorder then falls back to the system camera.
let visionCamera: any = null
try {
  visionCamera = require('react-native-vision-camera')
} catch {
  visionCamera = null
}

/** vision-camera 5 or newer is installed and its native module is linked. */
export const isVisionCameraAvailable = !!(visionCamera?.Camera && visionCamera?.useVideoOutput && visionCamera?.VisionCamera)

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
  let recorder: any = null
  let starting: Promise<void> | null = null

  const whenStarted = async () => {
    try {
      await starting
    } catch {
      // the start failed and already reported it
    }
    return recorder
  }

  return {
    startRecording ({ onRecordingFinished, onRecordingError }) {
      recorder = null
      starting = (async () => {
        const next = await videoOutput.createRecorder({})
        recorder = next
        await next.startRecording(
          (filePath: string) => onRecordingFinished({ path: filePath }),
          (error: unknown) => onRecordingError(error)
        )
      })()
      starting.catch(onRecordingError)
    },
    async stopRecording () {
      const current = await whenStarted()
      if (current?.isRecording)
        await current.stopRecording()
    },
    async cancelRecording () {
      const current = await whenStarted()
      if (current?.isRecording)
        await current.cancelRecording()
    },
    async pauseRecording () {
      const current = await whenStarted()
      if (current?.isRecording && !current.isPaused)
        await current.pauseRecording()
    },
    async resumeRecording () {
      const current = await whenStarted()
      if (current?.isRecording && current.isPaused)
        await current.resumeRecording()
    },
  }
}
