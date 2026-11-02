import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import dayjs from 'dayjs'
import { Touchable } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useChatContext } from '../../ChatContext'
import { TIME_FORMAT } from '../../Constant'
import { useLabels } from '../../hooks/useLabels'
import { formatLabel } from '../../i18n'
import { IMessage } from '../../Models'
import { Icon } from '../Icon'
import { CloseIcon } from '../MediaControls'

export interface MediaViewerChromeProps {
  message: IMessage | undefined
  index: number
  count: number
  onClose: () => void
}

/**
 * The viewer's bars, as in Telegram's: a close button and "3 of 12" on top; the caption, the
 * sender and when it was sent at the bottom, over a shade so they read on any photo.
 */
export function MediaViewerChrome ({ message, index, count, onClose }: MediaViewerChromeProps) {
  const insets = useSafeAreaInsets()
  const labels = useLabels()
  const { getLocale } = useChatContext()

  const sentAt = message?.createdAt != null ? dayjs(message.createdAt).locale(getLocale()) : undefined
  const date = sentAt
    ? formatLabel(labels.mediaViewerDate, {
      date: sentAt.format(sentAt.isSame(dayjs(), 'year') ? 'D MMM' : 'D MMM YYYY'),
      time: sentAt.format(TIME_FORMAT),
    })
    : undefined

  return (
    <>
      <View style={[styles.top, { paddingTop: insets.top }]} pointerEvents='box-none'>
        <Touchable onPress={onClose} accessibilityRole='button' accessibilityLabel='Close'>
          <View style={styles.close}>
            <Icon name='close' color='#FFFFFF' size={24} fallback={<CloseIcon color='#FFFFFF' size={24} />} />
          </View>
        </Touchable>
        {count > 1 && (
          <Text style={styles.counter} accessibilityRole='header'>
            {formatLabel(labels.mediaViewerCounter, { index: index + 1, count })}
          </Text>
        )}
      </View>
      {!!message && (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]} pointerEvents='none'>
          {!!message.text && <Text style={styles.caption} numberOfLines={4}>{message.text}</Text>}
          {!!message.user?.name && <Text style={styles.name} numberOfLines={1}>{message.user.name}</Text>}
          {!!date && <Text style={styles.date}>{date}</Text>}
        </View>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  close: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '500',
    marginStart: 6,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  caption: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 21,
    marginBottom: 10,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  date: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    marginTop: 2,
  },
})
