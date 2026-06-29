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
              {...messageTextProps}
            />
          )
        }
        {children}
      </View>
    </View>
  )
}

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    marginVertical: 5,
    marginHorizontal: 10,
  },
  container: {
    maxWidth: '70%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.separator,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: theme.colors.reactionBackground,
  },
  messageContainer: {
    marginVertical: 0,
    marginHorizontal: 0,
  },
  text: {
    backgroundColor: Color.backgroundTransparent,
    color: theme.colors.incomingMeta,
    fontSize: theme.typography.system.fontSize,
    fontWeight: theme.typography.system.fontWeight,
    textAlign: 'center',
  },
})
