import { getExpoBlur, getExpoVideo, getSvg } from '../../optional'

// Optional player for the paused take's preview.
export const expoVideo = getExpoVideo()

export const canPreview = !!(expoVideo?.VideoView && expoVideo?.useVideoPlayer)

// Optional blur for the layer behind the circle; without it a plain dim stands
// in for the blurred chat.
export const BlurView = getExpoBlur()?.BlurView ?? null

// Optional SVG for the progress ring; without it the note still records.
const svg = getSvg()
export const Svg: any = svg ? svg.Svg ?? svg.default : null
export const SvgCircle: any = svg?.Circle ?? null
