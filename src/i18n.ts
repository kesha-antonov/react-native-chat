/**
 * UI string localization for the chat. Date/time localization is handled
 * separately by Day.js via the `locale` prop; this covers the static UI labels
 * (composer placeholder, buttons, recording hint, media/location labels, etc.).
 *
 * Provide overrides through the `labels` prop on `Chat`, or rely on the built-in
 * translations selected by the `locale` prop. Labels resolve as:
 *   labels (prop)  >  translations[locale]  >  defaultLabels (English)
 */
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
}

/** Built-in translations (a starter set). Each is merged over English. */
export const translations: Record<string, Partial<ChatLabels>> = {
  es: {
    placeholder: 'Escribe un mensaje...',
    send: 'Enviar',
    cancel: 'Cancelar',
    loadEarlier: 'Cargar mensajes anteriores',
    today: 'Hoy',
    video: 'Video',
    voiceMessage: 'Mensaje de voz',
    videoMessage: 'Mensaje de video',
    location: 'Ubicacion',
    openLocationAccessibility: 'Abrir ubicacion en mapas',
    slideToCancel: 'desliza para cancelar',
    replyingTo: 'Respondiendo a {name}',
    editing: 'Editando',
    cameraPermission: 'Se necesita permiso de camara',
    noCamera: 'No hay camara disponible',
  },
  fr: {
    placeholder: 'Ecrire un message...',
    send: 'Envoyer',
    cancel: 'Annuler',
    loadEarlier: 'Charger les messages precedents',
    today: 'Aujourd\'hui',
    video: 'Video',
    voiceMessage: 'Message vocal',
    videoMessage: 'Message vidéo',
    location: 'Position',
    openLocationAccessibility: 'Ouvrir la position dans les cartes',
    slideToCancel: 'glisser pour annuler',
    replyingTo: 'Reponse a {name}',
    editing: 'Modification',
    cameraPermission: 'Autorisation de la camera requise',
    noCamera: 'Aucune camera disponible',
  },
  de: {
    placeholder: 'Nachricht schreiben...',
    send: 'Senden',
    cancel: 'Abbrechen',
    loadEarlier: 'Fruhere Nachrichten laden',
    today: 'Heute',
    video: 'Video',
    voiceMessage: 'Sprachnachricht',
    videoMessage: 'Videonachricht',
    location: 'Standort',
    openLocationAccessibility: 'Standort in Karten offnen',
    slideToCancel: 'zum Abbrechen wischen',
    replyingTo: 'Antwort an {name}',
    editing: 'Bearbeiten',
    cameraPermission: 'Kameraberechtigung erforderlich',
    noCamera: 'Keine Kamera verfugbar',
  },
  ru: {
    placeholder: 'Введите сообщение...',
    send: 'Отправить',
    cancel: 'Отмена',
    loadEarlier: 'Загрузить предыдущие сообщения',
    today: 'Сегодня',
    video: 'Видео',
    voiceMessage: 'Голосовое сообщение',
    videoMessage: 'Видеосообщение',
    location: 'Местоположение',
    openLocationAccessibility: 'Открыть местоположение на картах',
    slideToCancel: 'смахните для отмены',
    replyingTo: 'Ответ {name}',
    editing: 'Редактирование',
    cameraPermission: 'Требуется доступ к камере',
    noCamera: 'Камера недоступна',
  },
}

/**
 * Resolve the active labels: the `labels` override on top of the built-in
 * translation for `locale` (if any) on top of English defaults.
 */
export function resolveLabels (
  locale?: string,
  labels?: Partial<ChatLabels>
): ChatLabels {
  const localeKey = locale?.split('-')[0]?.toLowerCase()
  const translated = localeKey ? translations[localeKey] : undefined
  return { ...defaultLabels, ...translated, ...labels }
}

/** Interpolate `{name}`-style placeholders in a label. */
export function formatLabel (label: string, values: Record<string, string | number>): string {
  return label.replace(/\{(\w+)\}/g, (_match, key) => String(values[key] ?? ''))
}
