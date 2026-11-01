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

/** Whether a message carries Telegram's "edited" mark. */
export const isMessageEdited = (message: IMessage | null | undefined) =>
  !!message && (!!message.isEdited || message.editedAt != null)

/**
 * The text of a message's time: Telegram prefixes it with the edited mark ("edited 14:05",
 * `ChatMessageCell:18501`) in the same paint.
 */
export function formatMessageTime (
  message: IMessage,
  locale: string,
  timeFormat: string,
  editedLabel: string
): string {
  const time = dayjs(message.createdAt).locale(locale).format(timeFormat)
  return isMessageEdited(message) ? `${editedLabel} ${time}` : time
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
