import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useIcons } from '../hooks/useIcons'
import { getSvg } from '../optional'
import { Icon } from './Icon'
import { PendingClock, Ticks } from './Ticks'

const svg = getSvg()
const Svg: any = svg ? svg.default ?? svg.Svg : null
const Path: any = svg?.Path

/**
 * The box the status takes beside the time: Telegram's 12pt check with the half-check 4pt to
 * its right (`msg_check_s` + `msg_halfcheck`, `ChatMessageCell:24860`).
 */
export const STATUS_WIDTH = 16
const STATUS_HEIGHT = 12

// Telegram's checks are thin, round-capped strokes; the read state adds a second check whose
// short arm hides behind the first one's long arm.
const CHECK = 'M1.6 6.7 L4.5 9.5 L10.4 2.9'
const HALF_CHECK = 'M7.9 8.2 L9.2 9.5 L15.1 2.9'

export type MessageStatusKind = 'pending' | 'sent' | 'read' | 'failed'

export interface MessageStatusProps {
  status: MessageStatusKind
  color: string
  /** Badge color for `failed`. */
  errorColor: string
}

const TelegramChecks = ({ isRead, color }: { isRead: boolean, color: string }) => (
  <Svg width={STATUS_WIDTH} height={STATUS_HEIGHT} viewBox='0 0 16 12' fill='none'>
    <Path d={CHECK} stroke={color} strokeWidth={1.5} strokeLinecap='round' strokeLinejoin='round' />
    {isRead && (
      <Path d={HALF_CHECK} stroke={color} strokeWidth={1.5} strokeLinecap='round' strokeLinejoin='round' />
    )}
  </Svg>
)

/**
 * A message's delivery state as Telegram draws it beside the time: a spinning clock while
 * sending, one check once sent, two once read, a red badge if sending failed. The `icons`
 * registry still wins for `clock`, `check` and `checkAll`.
 */
export const MessageStatus = ({ status, color, errorColor }: MessageStatusProps) => {
  const icons = useIcons()

  let glyph: React.ReactNode
  if (status === 'failed')
    // A 14pt red badge with a white exclamation mark (`ChatMessageCell:24479`).
    glyph = (
      <View testID='message-status-error-badge' style={[styles.error, { backgroundColor: errorColor }]}>
        <Text style={styles.errorText} allowFontScaling={false}>!</Text>
      </View>
    )
  else if (status === 'pending')
    glyph = icons.clock
      ? <Icon name='clock' color={color} size={11} fallback={null} />
      : <PendingClock color={color} />
  else if (icons.check || icons.checkAll)
    glyph = <Icon name={status === 'read' ? 'checkAll' : 'check'} color={color} size={14} fallback={null} />
  else if (Svg && Path)
    glyph = <TelegramChecks isRead={status === 'read'} color={color} />
  else
    glyph = <Ticks double={status === 'read'} color={color} />

  return (
    <View testID={`message-status-${status}`} style={styles.box}>
      {glyph}
    </View>
  )
}

const styles = StyleSheet.create({
  // Right-aligned, so a single check sits where the read state's half-check would.
  box: {
    width: STATUS_WIDTH,
    height: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  error: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
  },
})
