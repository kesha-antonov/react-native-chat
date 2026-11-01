import React from 'react'
import {
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
  TextStyle,
} from 'react-native'
import { Color } from './Color'
import { useThemedStyles } from './hooks/useTheme'
import { MessageText, MessageTextProps } from './MessageText'
import { IMessage } from './Models'
import stylesCommon from './styles'
import { ChatTheme } from './Theme'

export interface SystemMessageProps<TMessage extends IMessage> {
  currentMessage: TMessage
  containerStyle?: StyleProp<ViewStyle>
  messageContainerStyle?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  messageTextProps?: Partial<MessageTextProps<TMessage>>
  children?: React.ReactNode
}

export function SystemMessage<TMessage extends IMessage> ({
  currentMessage,
  containerStyle,
  messageContainerStyle,
  textStyle,
  messageTextProps,
  children,
}: SystemMessageProps<TMessage>) {
  const styles = useThemedStyles(createStyles)

  if (currentMessage == null)
    return null

  return (
    <View style={[stylesCommon.fill, styles.wrapper]}>
      <View style={[styles.container, containerStyle]}>
        {
          !!currentMessage.text && (
            <MessageText
              currentMessage={currentMessage}
              customTextStyle={[styles.text, textStyle]}
              position='left'
              containerStyle={{ left: [styles.messageContainer, messageContainerStyle] }}
              linkStyle={{ left: styles.link }}
              {...messageTextProps}
            />
          )
        }
        {children}
      </View>
    </View>
  )
}

// Service messages share the date pill's look: 14 Medium white text
// on the service color, radius 11, 8 either side and 3 above and below, at most 30 narrower
// than the list.
const createStyles = (theme: ChatTheme) => StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    marginTop: 1,
    marginBottom: 7,
    marginHorizontal: 15,
  },
  container: {
    borderRadius: theme.radii.dayPill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: theme.colors.dayPillBackground,
  },
  messageContainer: {
    marginTop: 0,
    marginBottom: 0,
    marginVertical: 0,
    marginHorizontal: 0,
  },
  text: {
    backgroundColor: Color.backgroundTransparent,
    color: theme.colors.dayPillText,
    fontSize: theme.typography.system.fontSize,
    lineHeight: theme.typography.system.lineHeight,
    fontWeight: theme.typography.system.fontWeight,
    textAlign: 'center',
  },
  link: {
    color: theme.colors.dayPillText,
    fontWeight: '500',
  },
})
