import React from 'react'

import { Store } from '../../store'
import { RecordButtonPhase } from '../RecordButton'

/** `paused` holds the recorder's file open (Resume continues it); `preview` plays a finished one. */
export type Phase = 'idle' | 'preparing' | 'recording' | 'paused' | 'stopping' | 'preview' | 'finishing'

/** What the composer needs to drive and draw a round video note take. */
export interface VideoNoteSession {
  /** A take is starting, recording or in preview, so the toolbar shows its bar. */
  isActive: boolean
  isLocked: boolean
  /** The camera is actually recording, not just opening. */
  isCapturing: boolean
  /** The record button's state for this take. */
  buttonPhase: RecordButtonPhase
  /** Set while a paused take plays back for review. */
  preview: { durationMs: number } | null
  /** Finger went down on the control: open the camera and record. */
  start: () => void
  /** Finger lifted (`cancelled` when slid to cancel), or Send / CANCEL pressed. */
  finish: (cancelled: boolean) => void
  /** Slid up past the lock threshold: keep recording hands-free. */
  lock: () => void
  /** Locked: pause the recording, holding it open. */
  pause?: () => void
  /** Paused: carry on recording into the same video. */
  resume?: () => void
  /** Send the take, recording or previewed. */
  send: () => void
  /** The take goes out as view-once (`voiceOnce`). */
  isViewOnce: boolean
  /** Flips `isViewOnce`; undefined unless `videoRecording.isViewOnceEnabled`. */
  toggleViewOnce?: () => void
  /** The camera, or the preview, to draw over the message list; null when idle. */
  overlay: React.ReactNode
}

/** A take that has ended, held while its overlay closes. */
export interface ClosingTake {
  kind: 'capture' | 'preview'
  isSlideOut: boolean
  uri: string | null
  /** Sent: the circle flies into the new note instead of closing. */
  isFlight: boolean
  /** The phase the take closed from and its elapsed time, so the ring holds its last share. */
  fromPhase: Phase
  elapsed: number
}

/** The ring's share of the max length: fixed, or read from the running time while recording. */
export type RingProgress = number | { elapsed: Store<number>, maxMs: number }
