import React, { useCallback, useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'

import { clampProgress, transferState, useMediaTransfer } from './components/mediaTransfer'
import { suppressPressAfterHold } from './components/messagePress'
import { RadialProgress } from './components/RadialProgress'
import { useIsRTL } from './hooks/useIsRTL'
import { useThemedStyles } from './hooks/useTheme'
import { IMessage, IMessageFile as MessageFileData, MessageFileProps } from './Models'
import { getExpoSharing } from './optional'
import { ChatTheme } from './Theme'

/** "1.2 MB", in Telegram's style (`AndroidUtilities.formatFileSize`). */
export const formatFileSize = (bytes?: number): string => {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0)
    return ''
  if (bytes < 1024)
    return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}

/** The extension Telegram prints in the file's icon: up to four characters, upper case. */
export const fileExtension = (name?: string): string => {
  const match = name?.match(/\.([a-z0-9]{1,8})$/i)
  return match ? match[1].slice(0, 4).toUpperCase() : ''
}

/** Opens a file: the system share sheet (`expo-sharing`) when installed, otherwise `Linking`. */
export const openFile = (file: MessageFileData) => {
  const sharing = getExpoSharing()
  if (sharing?.shareAsync) {
    Promise.resolve(sharing.shareAsync(file.uri, { mimeType: file.mimeType, dialogTitle: file.name }))
      .catch(() => Linking.openURL(file.uri).catch(() => {}))
    return
  }
  Linking.openURL(file.uri).catch(() => {})
}

// Telegram's document cell (`ChatMessageCell`, `documentAttach`): a 44 circle in the bubble's
// accent with the type inside, the name in medium 15 and the size under it in the meta color.
const ICON_SIZE = 44
// Room for the time, which sits on the size line at the bottom-right (the icon keeps its side
// in RTL too, so the time never lands on it).
const META_RESERVE = 62

/** Telegram's file bubble for `IMessage.file`. A tap opens or shares the file. */
export function MessageFile<TMessage extends IMessage = IMessage> ({
  currentMessage,
  position = 'left',
  containerStyle,
  onPress,
}: Partial<MessageFileProps<TMessage>>) {
  const styles = useThemedStyles(position === 'right' ? createRightStyles : createLeftStyles)
  const isRTL = useIsRTL()
  const file = currentMessage?.file
  const mediaTransfer = useMediaTransfer()
  // Telegram's document button (`getIconForCurrentState`, documents): the download arrow, the
  // cancel ✕ with a ring while it moves, and the file icon once it is here (`ICON_FILE`).
  const transfer = transferState(currentMessage)
  // Kept mounted after a transfer so its circle fades back to the file icon (cancel -> none).
  const [hasShownButton, setHasShownButton] = useState(!!transfer)
  if (transfer && !hasShownButton)
    setHasShownButton(true)

  const handlePress = useCallback(() => {
    if (!file)
      return
    if (currentMessage?.transfer) {
      mediaTransfer.onCancel(currentMessage)
      return
    }
    if (currentMessage?.isDownloadRequired) {
      mediaTransfer.onDownload(currentMessage)
      return
    }
    if (onPress)
      onPress(file)
    else
      openFile(file)
  }, [file, onPress, currentMessage, mediaTransfer])

  if (!file)
    return null

  const extension = fileExtension(file.name)
  // "1.2 MB / 4.5 MB" in place of the size while it moves (`ChatMessageCell.java:18363-18367`).
  const size = currentMessage?.transfer && file.size
    ? `${formatFileSize(Math.round(clampProgress(currentMessage.transfer.progress) * file.size))} / ${formatFileSize(file.size)}`
    : formatFileSize(file.size)
  const hasText = !!currentMessage?.text

  return (
    <Pressable
      onPress={handlePress}
      {...suppressPressAfterHold}
      accessibilityRole='button'
      accessibilityLabel={[file.name, size].filter(Boolean).join(', ')}
      style={[styles.container, containerStyle]}
    >
      <View style={styles.icon}>
        {extension
          ? <Text style={styles.extension} numberOfLines={1} adjustsFontSizeToFit>{extension}</Text>
          : <View style={styles.page}><View style={styles.pageFold} /></View>}
        {hasShownButton && (
          <RadialProgress
            style={StyleSheet.absoluteFill}
            icon={transfer?.icon ?? 'none'}
            progress={transfer?.progress ?? 0}
            size={ICON_SIZE}
            color={styles.extension.color as string}
            backgroundColor={styles.icon.backgroundColor as string}
          />
        )}
      </View>
      <View style={[styles.meta, !hasText && styles.metaReserve]}>
        <Text style={[styles.name, isRTL && styles.textRTL]} numberOfLines={2} ellipsizeMode='middle'>
          {file.name}
        </Text>
        {!!size && <Text style={[styles.size, isRTL && styles.textRTL]} numberOfLines={1}>{size}</Text>}
      </View>
    </Pressable>
  )
}

const makeStyles = (theme: ChatTheme, position: 'left' | 'right') => {
  const isOutgoing = position === 'right'
  const accent = isOutgoing ? theme.colors.outgoingVoiceFill : theme.colors.incomingVoiceFill
  // Over a light accent (the night outgoing bubble's white), the glyph takes the bubble's color.
  const glyph = isOutgoing && accent.toUpperCase() === '#FFFFFF' ? theme.colors.outgoingBubble : '#FFFFFF'

  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      minWidth: 200,
      paddingTop: theme.spacing.bubblePaddingV + 3,
      paddingBottom: 9,
      paddingHorizontal: theme.spacing.bubblePaddingH,
      gap: 10,
    },
    icon: {
      width: ICON_SIZE,
      height: ICON_SIZE,
      borderRadius: ICON_SIZE / 2,
      backgroundColor: accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    extension: {
      maxWidth: ICON_SIZE - 8,
      fontSize: 12,
      fontWeight: '700',
      color: glyph,
    },
    page: {
      width: 16,
      height: 20,
      borderRadius: 2,
      borderWidth: 2,
      borderColor: glyph,
      alignItems: 'flex-end',
    },
    pageFold: {
      width: 6,
      height: 6,
      backgroundColor: glyph,
      borderBottomLeftRadius: 2,
    },
    meta: {
      flexShrink: 1,
      flexGrow: 1,
      gap: 2,
    },
    metaReserve: {
      paddingRight: META_RESERVE,
    },
    name: {
      fontSize: 15,
      lineHeight: 19,
      fontWeight: '500',
      color: isOutgoing ? theme.colors.outgoingText : theme.colors.incomingText,
    },
    size: {
      fontSize: 13,
      lineHeight: 16,
      color: isOutgoing ? theme.colors.outgoingMeta : theme.colors.incomingMeta,
    },
    textRTL: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
  })
}

const createLeftStyles = (theme: ChatTheme) => makeStyles(theme, 'left')
const createRightStyles = (theme: ChatTheme) => makeStyles(theme, 'right')
