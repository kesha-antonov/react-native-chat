import React from 'react'

import { IMessage } from '../../Models'
import { isVisionCameraNativeReady } from '../visionCamera'
import { LiveVideoNote } from './LiveVideoNote'
import { VideoNoteRecorderProps } from './types'
import { UnavailableVideoNote } from './UnavailableVideoNote'

export type { VideoNoteRecorderProps } from './types'

/**
 * Round video note recorder: records the front camera into a
 * circular preview. When react-native-vision-camera's native module is missing
 * (a simulator, or a binary built before the dependency was added) it shows an
 * unavailable state with the shutter disabled rather than fabricating a note.
 * The two paths are separate components so the vision-camera hooks are only ever
 * called when the native module is present (no crash, stable hook order).
 */
export function VideoNoteRecorder<TMessage extends IMessage = IMessage> (
  props: VideoNoteRecorderProps<TMessage>
) {
  return isVisionCameraNativeReady
    ? <LiveVideoNote<TMessage> {...props} />
    : <UnavailableVideoNote onClose={props.onClose} />
}
