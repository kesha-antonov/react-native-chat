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
