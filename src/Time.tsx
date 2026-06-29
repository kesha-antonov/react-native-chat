import React, { useMemo } from 'react'
import { StyleSheet, View, ViewStyle, TextStyle , Text } from 'react-native'
import dayjs from 'dayjs'
import { useChatContext } from './ChatContext'
import { TIME_FORMAT } from './Constant'
import { useThemedStyles } from './hooks/useTheme'
import { LeftRightStyle, IMessage } from './Models'
import { getStyleWithPosition } from './styles'
import { ChatTheme } from './Theme'

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  text: {
    fontSize: theme.typography.time.fontSize,
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
  const styles = useThemedStyles(createStyles)

  const formattedTime = useMemo(() => {
    if (!currentMessage)
      return null

    return dayjs(currentMessage.createdAt).locale(getLocale()).format(timeFormat)
  }, [currentMessage, getLocale, timeFormat])

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
