/*
 * Pause, resume and trim for voice takes. expo-audio cannot append to a finished file, so a
 * resumed take is a list of clips, each its own recording, joined when the
 * take is previewed or sent. Both need native help that is optional here:
 * joining uses react-native-audio-api's `concatAudioFiles` (an FFmpeg remux,
 * no re-encode), and a trimmed take is decoded with react-native-audio-api
 * and written as 16-bit PCM WAV with expo-file-system, since there is no AAC
 * encoder to reach from JS.
 */

import { getAudioApi, getExpoFileSystem } from '../optional'

// Optional natives. Resolved through the optional-peer registry (`src/optional`) so the bundle works
// whether or not the consumer installed them.
const audioApi = getAudioApi()
const fileSystem = getExpoFileSystem()

/** Spacing of the recorder's amplitude samples (its timer interval). */
export const LEVEL_INTERVAL_MS = 100
/** A trimmed take is written at this rate: plenty for speech, a third of 48k's size. */
const TRIM_SAMPLE_RATE = 24000

let ffmpegEnabled: boolean | null = null
// Both joining and decoding an M4A go through FFmpeg, which an app can
// compile out of react-native-audio-api.
const isFfmpegEnabled = () => {
  if (ffmpegEnabled == null)
    try {
      ffmpegEnabled = audioApi?.isFfmpegEnabled ? audioApi.isFfmpegEnabled() !== false : !!audioApi
    } catch {
      ffmpegEnabled = false
    }

  return ffmpegEnabled
}

/** A paused take can be resumed: the clips can be joined into one file. */
export const isVoiceResumeAvailable = () =>
  typeof audioApi?.concatAudioFiles === 'function' && isFfmpegEnabled()

/** A paused take can be trimmed: the clips can be decoded and written back. */
export const isVoiceTrimAvailable = () =>
  typeof audioApi?.decodeAudioData === 'function' &&
  typeof fileSystem?.File === 'function' &&
  isFfmpegEnabled()

/** One recording of a take, and the part of it that is kept. */
export interface VoiceClip {
  uri: string
  /** Length of the recording itself. */
  durationMs: number
  /** Kept window within the recording. */
  startMs: number
  endMs: number
  /** Amplitudes over the kept window, 0..1. */
  levels: number[]
}

export const createClip = (uri: string, durationMs: number, levels: number[]): VoiceClip => ({
  uri, durationMs, startMs: 0, endMs: durationMs, levels,
})

const isWhole = (clip: VoiceClip) => clip.startMs <= 0 && clip.endMs >= clip.durationMs

export const clipsDuration = (clips: VoiceClip[]) =>
  clips.reduce((total, clip) => total + clip.endMs - clip.startMs, 0)

export const clipsLevels = (clips: VoiceClip[]) =>
  clips.flatMap(clip => clip.levels)

/**
 * Keeps `[fromMs, toMs]` of the take's timeline, cutting into the clips it
 * crosses. Nothing is re-encoded here; the cut is applied on render.
 */
export const trimClips = (clips: VoiceClip[], fromMs: number, toMs: number): VoiceClip[] => {
  const out: VoiceClip[] = []
  let offset = 0

  for (const clip of clips) {
    const length = clip.endMs - clip.startMs
    const keepFrom = Math.max(fromMs, offset)
    const keepTo = Math.min(toMs, offset + length)

    if (keepTo > keepFrom) {
      const levelsFrom = Math.floor(((keepFrom - offset) / length) * clip.levels.length)
      const levelsTo = Math.ceil(((keepTo - offset) / length) * clip.levels.length)
      out.push({
        ...clip,
        startMs: clip.startMs + keepFrom - offset,
        endMs: clip.startMs + keepTo - offset,
        levels: clip.levels.slice(levelsFrom, levelsTo),
      })
    }

    offset += length
  }

  return out
}

const directoryOf = (uri: string) => uri.slice(0, uri.lastIndexOf('/'))

const extensionOf = (uri: string) => {
  const name = uri.slice(uri.lastIndexOf('/') + 1)
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot) : '.m4a'
}

const uniqueName = (prefix: string, extension: string) =>
  `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}${extension}`

/** 16-bit PCM WAV, mono, from consecutive pieces of float samples. */
export const encodeWav = (pieces: Float32Array[], sampleRate: number) => {
  const sampleCount = pieces.reduce((total, piece) => total + piece.length, 0)
  const bytes = new Uint8Array(44 + sampleCount * 2)
  const view = new DataView(bytes.buffer)
  const writeAscii = (at: number, text: string) => {
    for (let i = 0; i < text.length; i++)
      view.setUint8(at + i, text.charCodeAt(i))
  }

  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + sampleCount * 2, true)
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(36, 'data')
  view.setUint32(40, sampleCount * 2, true)

  let at = 44
  for (const piece of pieces)
    for (let i = 0; i < piece.length; i++) {
      const sample = Math.max(-1, Math.min(1, piece[i]))
      view.setInt16(at, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      at += 2
    }

  return bytes
}

// Averages the channels so a stereo recording still lands as one voice.
const mixdown = (buffer: any): Float32Array => {
  const channels: number = buffer.numberOfChannels ?? 1
  const first: Float32Array = buffer.getChannelData(0)
  if (channels < 2)
    return first

  const mixed = new Float32Array(first.length)
  for (let channel = 0; channel < channels; channel++) {
    const data: Float32Array = buffer.getChannelData(channel)
    for (let i = 0; i < mixed.length; i++)
      mixed[i] += data[i] / channels
  }
  return mixed
}

const writeTrimmed = async (clips: VoiceClip[]) => {
  const pieces: Float32Array[] = []
  for (const clip of clips) {
    const buffer = await audioApi.decodeAudioData(clip.uri, TRIM_SAMPLE_RATE)
    const samples = mixdown(buffer)
    const from = Math.min(samples.length, Math.round((clip.startMs / 1000) * TRIM_SAMPLE_RATE))
    const to = Math.min(samples.length, Math.round((clip.endMs / 1000) * TRIM_SAMPLE_RATE))
    pieces.push(samples.subarray(from, Math.max(from, to)))
  }

  const directory = directoryOf(clips[0].uri)
  const base = directory.includes('://') ? directory : `file://${directory}`
  const file = new fileSystem.File(`${base}/${uniqueName('voice-trimmed', '.wav')}`)
  file.write(encodeWav(pieces, TRIM_SAMPLE_RATE))
  return file.uri as string
}

/**
 * One file for the clips: the recording itself when there is only one and
 * it is whole, the recordings joined without re-encoding when none is cut,
 * otherwise a WAV of the kept parts.
 */
export const renderClips = async (clips: VoiceClip[]): Promise<string> => {
  if (!clips.length)
    throw new Error('Nothing recorded')

  if (clips.length === 1 && isWhole(clips[0]))
    return clips[0].uri

  if (clips.every(isWhole)) {
    const first = clips[0].uri
    const output = `${directoryOf(first)}/${uniqueName('voice', extensionOf(first))}`
    return await audioApi.concatAudioFiles(clips.map(clip => clip.uri), output)
  }

  return await writeTrimmed(clips)
}
