/**
 * UI string localization for the chat. Date/time localization (month/day names, calendar
 * formats) is handled separately by Day.js via the `locale` prop - dayjsLocales.ts bundles the
 * matching dayjs locale for every language translated here, kept in sync via the
 * `SupportedLocale` type in ./locales (compile time) and dayjsLocales.test.ts (runtime). This
 * file covers the static UI labels (composer placeholder, buttons, recording hint, media/
 * location labels, etc.); the actual per-language strings live one-per-file under `src/locales/`.
 *
 * Provide overrides through the `labels` prop on `Chat`, or rely on the built-in
 * translations selected by the `locale` prop. Labels resolve as:
 *   labels (prop)  >  translations[locale]  >  defaultLabels (English)
 */
import { matchSupportedLocale, translations } from './locales'

export interface ChatLabels {
  /** Composer placeholder. */
  placeholder: string
  /** Send button / quick-reply send label. */
  send: string
  /** Cancel row in the attachment sheet. */
  cancel: string
  /** "Load earlier messages" button. */
  loadEarlier: string
  /** Day separator label for today's date. */
  today: string
  /** Video message fallback label. */
  video: string
  /** Voice/audio message fallback label. */
  voiceMessage: string
  videoMessage: string
  /** Location message title. */
  location: string
  /** Accessibility label for the location card. */
  openLocationAccessibility: string
  /** Voice recording slide-to-cancel hint. */
  slideToCancel: string
  /** Reply banner title; `{name}` is replaced with the author's name. */
  replyingTo: string
  /** Edit banner title. */
  editing: string
  /** Shown in the video recorder when camera permission is missing. */
  cameraPermission: string
  /** Shown in the video recorder when no camera device is found. */
  noCamera: string
  /** Hint under the video recorder's shutter while a take is running. */
  stopAndSend: string
  /** Hint under the video recorder's shutter before recording starts. */
  tapToRecord: string
  /** Hint while holding the video shutter. */
  releaseToSend: string
  /** Idle hint for the hold-to-record video shutter. */
  holdToRecord: string
  /** Tooltip by the lock while a take is held, shown for the first few takes. */
  slideUpToLock: string
  /** Tooltip after the shared record button switches to voice. */
  holdToRecordAudioSwitch: string
  /** Tooltip after the shared record button switches to video. */
  holdToRecordVideoSwitch: string
  /** Tooltip after a tap on a voice-only record button. */
  holdToRecordAudioOnly: string
  /** Tooltip after a tap on a video-only record button. */
  holdToRecordVideoOnly: string
  /** Tooltip by the pause button of a locked voice take. */
  pauseToTrimOrReplay: string
  /** Title of the prompt before resuming a trimmed voice take. */
  trimRecordingTitle: string
  /** Body of the prompt before resuming a trimmed voice take. */
  trimRecordingText: string
  /** Confirm button of a prompt. */
  ok: string
  /** Tooltip by the view-once toggle on the first few locked takes; `**` marks bold. */
  viewOnceHint: string
  /** Tooltip once view-once is switched on for a voice take. */
  viewOnceVoiceEnabledHint: string
  /** Tooltip once view-once is switched on for a round video take. */
  viewOnceVideoEnabledHint: string
  /** Accessibility label of the view-once toggle while off. */
  activateViewOnce: string
  /** Accessibility label of the view-once toggle while on. */
  deactivateViewOnce: string
  /** Message context menu: reply to the message. */
  actionReply: string
  /** Message context menu: copy the message text. */
  actionCopy: string
  /** Message context menu: pin the message. */
  actionPin: string
  /** Message context menu: unpin a pinned message. */
  actionUnpin: string
  /** Message context menu: edit your own message. */
  actionEdit: string
  /** Message context menu: forward the message. */
  actionForward: string
  /** Message context menu: delete the message. */
  actionDelete: string
}

export const defaultLabels: ChatLabels = {
  placeholder: 'Type a message...',
  send: 'Send',
  cancel: 'Cancel',
  loadEarlier: 'Load earlier messages',
  today: 'Today',
  video: 'Video',
  voiceMessage: 'Voice message',
  videoMessage: 'Video message',
  location: 'Location',
  openLocationAccessibility: 'Open location in maps',
  slideToCancel: 'Slide left to cancel...',
  replyingTo: 'Replying to {name}',
  editing: 'Editing',
  cameraPermission: 'Camera permission needed',
  noCamera: 'No camera available',
  stopAndSend: 'Tap to stop and send',
  tapToRecord: 'Tap to record',
  releaseToSend: 'Release to send, slide up to lock',
  holdToRecord: 'Hold to record',
  slideUpToLock: 'Slide up to lock recording',
  holdToRecordAudioSwitch: 'Hold to record audio. Tap to switch to video.',
  holdToRecordVideoSwitch: 'Hold to record video. Tap to switch to audio.',
  holdToRecordAudioOnly: 'Hold to record audio.',
  holdToRecordVideoOnly: 'Hold to record video.',
  pauseToTrimOrReplay: 'Pause to trim or replay',
  trimRecordingTitle: 'Trim to selected range?',
  trimRecordingText: 'Audio outside that range will be discarded, and recording will start immediately.',
  ok: 'OK',
  viewOnceHint: 'Tap to set this message to **Play Once**.',
  viewOnceVoiceEnabledHint: 'The recipient will be able to listen to it only once.',
  viewOnceVideoEnabledHint: 'The recipient will be able to play it only once.',
  activateViewOnce: 'Activate Play Once',
  deactivateViewOnce: 'Deactivate Play Once',
  actionReply: 'Reply',
  actionCopy: 'Copy',
  actionPin: 'Pin',
  actionUnpin: 'Unpin',
  actionEdit: 'Edit',
  actionForward: 'Forward',
  actionDelete: 'Delete',
}

/**
 * Built-in translations (a starter set), one language per file under `src/locales/`. Re-exported
 * here so `import { translations } from 'react-native-chat'` keeps working.
 */
export { translations }

/**
 * Resolve the active labels: the `labels` override on top of the built-in
 * translation for `locale` (if any) on top of English defaults.
 */
export function resolveLabels (
  locale?: string,
  labels?: Partial<ChatLabels>
): ChatLabels {
  const matched = matchSupportedLocale(locale)
  const translated = matched ? translations[matched] : undefined
  return { ...defaultLabels, ...translated, ...labels }
}

/** Interpolate `{name}`-style placeholders in a label. */
export function formatLabel (label: string, values: Record<string, string | number>): string {
  return label.replace(/\{(\w+)\}/g, (_match, key) => String(values[key] ?? ''))
}
