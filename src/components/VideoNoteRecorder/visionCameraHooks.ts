import { getVisionCamera } from '../visionCamera'

// Picked once at load, not off the module during render: a hook has to be the same function on
// every render, and the module never changes once resolved. Only LiveVideoNote calls them, and
// it only mounts when the native module is present.
export const visionCamera = getVisionCamera()
export const useCameraDevice: (facing: 'front' | 'back') => any = visionCamera?.useCameraDevice
export const useCameraPermission: () => any = visionCamera?.useCameraPermission
export const useMicrophonePermission: () => any = visionCamera?.useMicrophonePermission
export const useVideoOutput: (options: object) => any = visionCamera?.useVideoOutput
