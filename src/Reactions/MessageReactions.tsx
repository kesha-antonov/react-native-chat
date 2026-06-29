import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useThemedStyles } from '../hooks/useTheme'
import { IMessage } from '../Models'
import { ChatTheme } from '../Theme'
import { MessageReactionsDisplayProps } from './types'

export const MessageReactions = <TMessage extends IMessage = IMessage>(
  props: MessageReactionsDisplayProps<TMessage>
): React.ReactElement | null => {
  const {
    reactions,
    currentUserId,
    position,
    onReactionPress,
    containerStyle,
    reactionStyle,
    reactionActiveStyle,
    reactionTextStyle,
    reactionCountStyle,
  } = props

  const styles = useThemedStyles(createStyles)

  if (!reactions || reactions.length === 0)
    return null

  return (
    <View
      style={[
        styles.container,
        position === 'right' ? styles.containerRight : styles.containerLeft,
        containerStyle,
      ]}
    >
      {reactions.map(reaction => {
        const isActive = currentUserId != null && reaction.userIds.includes(currentUserId)
        const count = reaction.userIds.length

        return (
          <Pressable
            key={reaction.emoji}
            onPress={() => onReactionPress?.(reaction.emoji)}
            style={({ pressed }) => [
              styles.pill,
              isActive ? styles.pillActive : styles.pillInactive,
              isActive ? reactionActiveStyle : reactionStyle,
              pressed && styles.pillPressed,
            ]}
          >
            <Text style={[styles.emoji, reactionTextStyle]}>{reaction.emoji}</Text>
            {count > 1 && (
              <Text
                style={[
                  styles.count,
                  isActive && styles.countActive,
                  reactionCountStyle,
                ]}
              >
                {count}
              </Text>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

const createStyles = (theme: ChatTheme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 3,
      gap: 4,
    },
    containerLeft: {
      justifyContent: 'flex-start',
      paddingLeft: 4,
    },
    containerRight: {
      justifyContent: 'flex-end',
      paddingRight: 4,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: theme.radii.reaction,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
    },
    pillInactive: {
      backgroundColor: theme.colors.reactionBackground,
      borderColor: 'transparent',
    },
    pillActive: {
      backgroundColor: theme.colors.reactionActiveBackground,
      borderColor: theme.colors.accent,
    },
    pillPressed: {
      opacity: 0.7,
    },
    emoji: {
      fontSize: 15,
      lineHeight: 20,
    },
    count: {
      fontSize: 12,
      marginLeft: 3,
      color: theme.colors.incomingText,
      lineHeight: 20,
    },
    countActive: {
      color: theme.colors.accent,
      fontWeight: '600',
    },
  })
