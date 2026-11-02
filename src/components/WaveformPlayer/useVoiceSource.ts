import { RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSharedValue } from 'react-native-reanimated'

import { IMessage } from '../../Models'
import { downloadWithProgress, isRemoteUri } from '../mediaDownload'
import { releasePlayback } from '../mediaPlayback'
import {
  barCountForWidth,
  levelsFromSamples,
  levelsFromWaveform,
  voiceContentWidth,
  voiceTrackWidth,
} from '../voiceWaveform'
import { bufferDuration, decodeAudio } from './audio'
import { ROW_PADDING_H } from './styles'

interface VoiceSourceOptions {
  uri: string
  position: 'left' | 'right'
  durationProp: number | undefined
  message: IMessage | undefined
  playerId: string
  trackWidth: number
  isTranscribeVisible: boolean
  bufferRef: RefObject<any>
  durationRef: RefObject<number>
  pendingPlayRef: RefObject<boolean>
  playFromRef: RefObject<(fraction: number) => void>
  stopRaf: () => void
  stopRunningSource: () => void
}

/**
 * Gets a note's audio ready to play: fetches a remote file with progress, decodes it, and
 * buckets its samples into as many levels as the measured track has bars.
 */
export const useVoiceSource = ({
  uri,
  position,
  durationProp,
  message,
  playerId,
  trackWidth,
  isTranscribeVisible,
  bufferRef,
  durationRef,
  pendingPlayRef,
  playFromRef,
  stopRaf,
  stopRunningSource,
}: VoiceSourceOptions) => {
  const [decodedLevels, setLevels] = useState<number[]>([])
  const [failed, setFailed] = useState(false)
  // The voice button while the file is not here yet: the download arrow until it is fetched,
  // the cancel ✕ with a progress ring while it is, then play. A remote note fetches itself, as
  // voice is auto-downloaded; the app can drive it instead with `transfer` / `isDownloadRequired`.
  const transfer = message?.transfer
  const isAppDownloading = transfer?.type === 'download'
  const isDownloadRequired = !!message?.isDownloadRequired
  const [isCancelled, setIsCancelled] = useState(false)
  const [isRequested, setIsRequested] = useState(false)
  const shouldLoad = !isAppDownloading && !isCancelled && (!isDownloadRequired || isRequested)
  const isRemote = isRemoteUri(uri)
  // A remote note opens straight on the ring, without animating in.
  const [isFetching, setIsFetching] = useState(() => isRemote && shouldLoad)
  const downloadProgress = useSharedValue(0)
  const [decodedDuration, setDecodedDuration] = useState(0)

  const fullDuration = decodedDuration || durationProp || 0
  const contentWidth = voiceContentWidth(fullDuration, position === 'right')
  // The track's width before it has been measured, so the first decode
  // buckets close to the right count. The transcribe button takes its slot
  // out of the waveform, never out of the bubble's width.
  const expectedTrackWidth = voiceTrackWidth(contentWidth, ROW_PADDING_H, isTranscribeVisible)
  const barCount = barCountForWidth(trackWidth > 0 ? trackWidth : expectedTrackWidth)
  const barCountRef = useRef(barCount)
  useLayoutEffect(() => {
    barCountRef.current = barCount
  })
  // The waveform the server sent with the note is drawn first, so
  // the bars are there before the file is; only without one is it decoded from the audio.
  const serverWaveform = message?.waveform
  const serverLevels = useMemo(() => levelsFromWaveform(serverWaveform, barCount), [serverWaveform, barCount])
  const levels = serverLevels.length ? serverLevels : decodedLevels

  useEffect(() => {
    if (!shouldLoad)
      return

    let cancelled = false
    let abortDownload: (() => void) | null = null

    ;(async () => {
      let source: string | ArrayBuffer = uri
      if (isRemote) {
        downloadProgress.set(0)
        setIsFetching(true)
        const download = downloadWithProgress(uri, fraction => {
          downloadProgress.set(fraction)
        })
        abortDownload = download.abort
        try {
          source = await download.promise
        } catch {
          abortDownload = null
          // A failed fetch goes back to the download arrow, for a retry by tap.
          if (!cancelled) {
            setIsFetching(false)
            setIsCancelled(true)
          }
          return
        }
        abortDownload = null
        if (cancelled)
          return

        // On disk, the button turns to play at once; decoding the waveform
        // follows, and a tap meanwhile plays once it is ready.
        setIsFetching(false)
      }

      try {
        const buffer = await decodeAudio(source)
        if (cancelled)
          return

        bufferRef.current = buffer
        durationRef.current = bufferDuration(buffer, durationProp)
        setDecodedDuration(durationRef.current)
        setLevels(levelsFromSamples(buffer.getChannelData(0), barCountRef.current))
        setIsFetching(false)
        if (pendingPlayRef.current) {
          pendingPlayRef.current = false
          playFromRef.current(0)
        }
      } catch {
        if (!cancelled) {
          setFailed(true)
          setIsFetching(false)
        }
      }
    })()

    return () => {
      cancelled = true
      abortDownload?.()
      stopRaf()
      releasePlayback(playerId)
      stopRunningSource()
    }
  }, [uri, isRemote, shouldLoad, downloadProgress, stopRaf, playerId, durationProp, bufferRef, durationRef, pendingPlayRef, playFromRef, stopRunningSource])

  // Re-bucket an already-decoded waveform when the bar count changes.
  useEffect(() => {
    const buffer = bufferRef.current
    if (!buffer || barCount <= 0)
      return

    setLevels(levelsFromSamples(buffer.getChannelData(0), barCount))
  }, [barCount, bufferRef])

  return {
    levels,
    failed,
    setFailed,
    transfer,
    isDownloadRequired,
    shouldLoad,
    isFetching,
    setIsCancelled,
    setIsRequested,
    downloadProgress,
    fullDuration,
    contentWidth,
    barCount,
  }
}
