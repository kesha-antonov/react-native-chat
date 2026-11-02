import React, { useMemo } from 'react'
import { StyleSheet, View, ViewStyle, TextStyle, Text } from 'react-native'
import dayjs from 'dayjs'
import { useChatContext } from './ChatContext'
import { TIME_FORMAT } from './Constant'
import { useLabels } from './hooks/useLabels'
import { useThemedStyles } from './hooks/useTheme'
import { LeftRightStyle, IMessage } from './Models'
import { getStyleWithPosition } from './styles'
import { ChatTheme } from './Theme'

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  text: {
    fontSize: theme.typography.time.fontSize,
    lineHeight: theme.typography.time.lineHeight,
    fontWeight: theme.typography.time.fontWeight,
    textAlign: 'right',
  },
  text_left: {
    color: theme.colors.incomingMeta,
  },
  text_right: {
    color: theme.colors.outgoingMeta,
  },
})

/** Whether a message carries the "edited" mark. */
export const isMessageEdited = (message: IMessage | null | undefined) =>
  !!message && (!!message.isEdited || message.editedAt != null)

/**
 * The text of a message's time, prefixed with the edited mark ("edited 14:05") in the same
 * style.
 */
export function formatMessageTime (
  message: IMessage,
  locale: string,
  timeFormat: string,
  editedLabel: string
): string {
  const time = formatTimeCached(message.createdAt, locale, timeFormat)
  return isMessageEdited(message) ? `${editedLabel} ${time}` : time
}

// Every row formats its time (twice: the visible label and the space it reserves on the last
// line), and again whenever its message object changes - a status tick, a reaction, every frame
// of a streamed reply. The label depends only on the timestamp, locale and format.
const timeCache = new Map<string, string>()
const TIME_CACHE_MAX = 2000

function formatTimeCached (createdAt: IMessage['createdAt'], locale: string, timeFormat: string) {
  const at = createdAt instanceof Date ? createdAt.getTime() : typeof createdAt === 'number' ? createdAt : String(createdAt)
  const key = `${at}|${locale}|${timeFormat}`
  let time = timeCache.get(key)
  if (time === undefined) {
    time = dayjs(createdAt).locale(locale).format(timeFormat)
    if (timeCache.size >= TIME_CACHE_MAX)
      timeCache.clear()
    timeCache.set(key, time)
  }
  return time
}

export interface TimeProps<TMessage extends IMessage> {
  position?: 'left' | 'right'
  currentMessage: TMessage
  containerStyle?: LeftRightStyle<ViewStyle>
  timeTextStyle?: LeftRightStyle<TextStyle>
  timeFormat?: string
}

export const Time = <TMessage extends IMessage = IMessage>({
  position = 'left',
  containerStyle,
  currentMessage,
  timeFormat = TIME_FORMAT,
  timeTextStyle,
}: TimeProps<TMessage>) => {
  const { getLocale } = useChatContext()
  const labels = useLabels()
  const styles = useThemedStyles(createStyles)

  const formattedTime = useMemo(() => {
    if (!currentMessage)
      return null

    return formatMessageTime(currentMessage, getLocale(), timeFormat, labels.edited)
  }, [currentMessage, getLocale, timeFormat, labels.edited])

  if (!currentMessage)
    return null

  return (
    <View style={containerStyle?.[position]}>
      <Text
        style={[
          getStyleWithPosition(styles, 'text', position),
          timeTextStyle?.[position],
        ]}
      >
        {formattedTime}
      </Text>
    </View>
  )
}
