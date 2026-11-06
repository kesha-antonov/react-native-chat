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
  /** Prefix of an edited message's time ("edited 14:05"). */
  edited: string
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
  /** Message context menu: send a message that failed again. */
  actionRetry: string
  /** Emoji keyboard: the search field placeholder. */
  emojiSearch: string
  /** Emoji keyboard: the recents tab. */
  emojiRecent: string
  /** Emoji keyboard: smileys and people section. */
  emojiSmileys: string
  /** Emoji keyboard: animals section. */
  emojiAnimals: string
  /** Emoji keyboard: food section. */
  emojiFood: string
  /** Emoji keyboard: activities section. */
  emojiActivities: string
  /** Emoji keyboard: travel section. */
  emojiTravel: string
  /** Emoji keyboard: objects section. */
  emojiObjects: string
  /** Emoji keyboard: symbols section. */
  emojiSymbols: string
  /** Emoji keyboard: flags section. */
  emojiFlags: string
  /** Emoji keyboard: shown when a search finds nothing. */
  emojiNoResults: string
  /** Accessibility label of the composer's emoji button. */
  emojiButton: string
  /** Accessibility label of the emoji button while the emoji keyboard is open. */
  keyboardButton: string
  /** Accessibility label of the emoji keyboard's backspace. */
  backspace: string
  /** Accessibility label of the composer's paperclip. */
  attachButton: string
  /** Attachment menu: the Gallery tab. */
  attachGallery: string
  /** Attachment menu: the File tab. */
  attachFile: string
  /** Attachment menu: the Location tab. */
  attachLocation: string
  /** Attachment menu: the Camera tab and tile. */
  attachCamera: string
  /** Attachment menu: the caption field placeholder. */
  attachCaption: string
  /** Attachment menu: the button that sends your position. */
  attachSendLocation: string
  /** Attachment menu: shown while the position is being found. */
  attachLocating: string
  /** Attachment menu: accuracy of the found position; `{meters}` is replaced. */
  attachLocationAccuracy: string
  /** Attachment menu: shown when photo access is denied. */
  attachPhotosAccess: string
  /** Attachment menu: shown when the library has no photos. */
  attachNoPhotos: string
  /** Attachment menu: opens the system photo picker. */
  attachChooseFromGallery: string
  /** Attachment menu: the File tab's button. */
  attachChooseFile: string
  /** Attachment menu: shown when location access is denied. */
  attachLocationDenied: string
  /** Empty chat card: the title. */
  emptyChatTitle: string
  /** Empty chat card: the line above the greeting. */
  emptyChatText: string
  /** The bar above the first unread message. */
  unreadMessages: string
  /** Media viewer: which photo is open; `{index}` counts from the oldest, `{count}` is all. */
  mediaViewerCounter: string
  /** Media viewer: when the open photo was sent; `{date}` and `{time}` are formatted for the locale. */
  mediaViewerDate: string
  /** Message context menu: start selecting messages. */
  actionSelect: string
  /** Selection bar: accessibility label of the button that leaves selection. */
  cancelSelection: string
  /** The chat list's header title */
  chatListTitle: string
  /** Search field placeholder and button */
  chatListSearch: string
  /** The archive folder row and its header */
  chatListArchived: string
  /** Archive action */
  chatListArchive: string
  /** Unarchive action */
  chatListUnarchive: string
  /** Mute action */
  chatListMute: string
  /** Unmute action */
  chatListUnmute: string
  /** The new-chat button */
  chatListNewChat: string
  /** Back from search or the archive */
  chatListBack: string
  /** An empty list */
  chatListEmpty: string
  /** A search with no results */
  chatListNoResults: string
  /** Someone typing in a private chat (an animation stands before it) */
  typingStatus: string
  /** One person typing in a group; `{name}` is their first name */
  typingStatusName: string
  /** Two people typing; `{name}` and `{other}` are their first names */
  typingStatusTwo: string
  /** Several people typing; `{count}` is how many besides `{name}` */
  typingStatusMany: string
  /** Recording a voice message */
  typingRecordingVoice: string
  /** Recording a voice message, in a group */
  typingRecordingVoiceName: string
  /** Recording a video message */
  typingRecordingVideo: string
  /** Recording a video message, in a group */
  typingRecordingVideoName: string
  /** Sending a photo */
  typingSendingPhoto: string
  /** Sending a photo, in a group */
  typingSendingPhotoName: string
  /** Sending a video */
  typingSendingVideo: string
  /** Sending a video, in a group */
  typingSendingVideoName: string
  /** Sending a file */
  typingSendingFile: string
  /** Sending a file, in a group */
  typingSendingFileName: string
  /** Choosing a sticker */
  typingChoosingSticker: string
  /** Choosing a sticker, in a group */
  typingChoosingStickerName: string
  /** Before an unsent draft */
  chatListDraft: string
  /** Before your own last message in a group */
  chatListYou: string
  /** A photo as the last message */
  chatListPhoto: string
  /** A file as the last message, when it has no name */
  chatListFile: string
  /** Confirm deleting one chat */
  chatListDeleteTitle: string
  /** Confirm deleting several; `{count}` is how many */
  chatListDeleteManyTitle: string
  /** The confirmation's text */
  chatListDeleteMessage: string
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
  edited: 'edited',
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
  actionRetry: 'Retry',
  emojiSearch: 'Search Emoji',
  emojiRecent: 'Recently Used',
  emojiSmileys: 'Smileys & People',
  emojiAnimals: 'Animals & Nature',
  emojiFood: 'Food & Drink',
  emojiActivities: 'Activity',
  emojiTravel: 'Travel & Places',
  emojiObjects: 'Objects',
  emojiSymbols: 'Symbols',
  emojiFlags: 'Flags',
  emojiNoResults: 'No emoji found',
  emojiButton: 'Emoji',
  keyboardButton: 'Keyboard',
  backspace: 'Backspace',
  attachButton: 'Attach',
  attachGallery: 'Gallery',
  attachFile: 'File',
  attachLocation: 'Location',
  attachCamera: 'Camera',
  attachCaption: 'Add a caption...',
  attachSendLocation: 'Send My Current Location',
  attachLocating: 'Locating...',
  attachLocationAccuracy: 'Accurate to {meters} m',
  attachPhotosAccess: 'Allow access to your photos to send them',
  attachNoPhotos: 'No photos yet',
  attachChooseFromGallery: 'Choose from Gallery',
  attachChooseFile: 'Choose a file to send',
  attachLocationDenied: 'Location access is off. Turn it on in Settings to send your location.',
  emptyChatTitle: 'No messages here yet...',
  emptyChatText: 'Send a message or tap the greeting below.',
  unreadMessages: 'Unread Messages',
  mediaViewerCounter: '{index} of {count}',
  mediaViewerDate: '{date} at {time}',
  actionSelect: 'Select',
  cancelSelection: 'Cancel selection',
  chatListTitle: 'Chats',
  chatListSearch: 'Search',
  chatListArchived: 'Archived Chats',
  chatListArchive: 'Archive',
  chatListUnarchive: 'Unarchive',
  chatListMute: 'Mute',
  chatListUnmute: 'Unmute',
  chatListNewChat: 'New message',
  chatListBack: 'Back',
  chatListEmpty: 'No chats here yet',
  chatListNoResults: 'No chats found',
  typingStatus: 'typing',
  typingStatusName: '{name} is typing',
  typingStatusTwo: '{name} and {other} are typing',
  typingStatusMany: '{name} and {count} people are typing',
  typingRecordingVoice: 'recording a voice message',
  typingRecordingVoiceName: '{name} is recording a voice message',
  typingRecordingVideo: 'recording a video message',
  typingRecordingVideoName: '{name} is recording a video message',
  typingSendingPhoto: 'sending a photo',
  typingSendingPhotoName: '{name} is sending a photo',
  typingSendingVideo: 'sending a video',
  typingSendingVideoName: '{name} is sending a video',
  typingSendingFile: 'sending a file',
  typingSendingFileName: '{name} is sending a file',
  typingChoosingSticker: 'choosing a sticker',
  typingChoosingStickerName: '{name} is choosing a sticker',
  chatListDraft: 'Draft:',
  chatListYou: 'You',
  chatListPhoto: 'Photo',
  chatListFile: 'File',
  chatListDeleteTitle: 'Delete chat',
  chatListDeleteManyTitle: 'Delete {count} chats',
  chatListDeleteMessage: 'Are you sure you want to delete the selected chats?',
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
