import React, { useCallback } from 'react'
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { ChatAvatar } from '../ChatAvatar'
import { multiplyAlpha } from '../colorUtils'
import { useTheme, useThemedStyles } from '../hooks/useTheme'
import { IMessage, User } from '../Models'
import { ChatTheme } from '../Theme'
import { MessageReactionsDisplayProps } from './types'

// `ButtonBounce`: down to 0.9 over 60ms on `DEFAULT`, back over 350ms on `Overshoot(5)`.
const PRESS_IN = { duration: 60, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }
const PRESS_OUT = { duration: 350, easing: Easing.out(Easing.back(5)) }
// An unchosen pill is its accent at 15.6%.
const UNCHOSEN_ALPHA = 0.156
// Up to three reactors' avatars stand in for the count, as in Telegram: one-to-one chats always,
// groups while the message has this many reactions or fewer.
const MAX_AVATARS = 3
const AVATAR_SIZE = 20

interface ReactionPillProps {
  emoji: string
  count: number
  /** Shown instead of the count. */
  avatars?: User[]
  isChosen: boolean
  background: string
  textColor: string
  onPress?: (emoji: string) => void
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  countStyle?: StyleProp<TextStyle>
}

const ReactionPill = ({ emoji, count, avatars, isChosen, background, textColor, onPress, style, textStyle, countStyle }: ReactionPillProps) => {
  const styles = useThemedStyles(createStyles)
  const scale = useSharedValue(1)
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  const handlePressIn = useCallback(() => {
    scale.value = withTiming(0.9, PRESS_IN)
  }, [scale])
  const handlePressOut = useCallback(() => {
    scale.value = withTiming(1, PRESS_OUT)
  }, [scale])
  const handlePress = useCallback(() => onPress?.(emoji), [onPress, emoji])

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole='button'
      accessibilityState={{ selected: isChosen }}
      accessibilityLabel={count > 1 ? `${emoji} ${count}` : emoji}
    >
      <Animated.View style={[styles.pill, !avatars && styles.pillWithCount, { backgroundColor: background }, style, pressStyle]}>
        <Text style={[styles.emoji, textStyle]}>{emoji}</Text>
        {avatars
          ? (
            <View style={styles.avatars}>
              {avatars.map((user, index) => (
                <View key={String(user._id)} style={[styles.avatar, index > 0 && styles.avatarOverlap, { zIndex: avatars.length - index }]}>
                  <ChatAvatar user={user} avatarStyle={styles.avatarImage} textStyle={styles.avatarText} />
                </View>
              ))}
            </View>
          )
          : (
            <Text style={[styles.count, { color: textColor }, countStyle]}>
              {count}
            </Text>
          )}
      </Animated.View>
    </Pressable>
  )
}

/**
 * Reaction pills inside the bubble: 26pt capsules
 * that wrap 4pt apart, the bubble's accent at 15.6% when not chosen and solid with white text
 * when chosen, bouncing on a tap.
 */
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
    trailing,
    hasContentAbove = false,
    getUser,
    isGroupChat = false,
  } = props

  const theme = useTheme()
  const styles = useThemedStyles(createStyles)

  if (!reactions || reactions.length === 0)
    return null

  const accent = position === 'right' ? theme.colors.outgoingReaction : theme.colors.incomingReaction
  const unchosenText = position === 'right' ? theme.colors.outgoingReactionText : theme.colors.incomingReactionText
  const chosenText = position === 'right' ? theme.colors.outgoingReactionTextChosen : theme.colors.incomingReactionTextChosen
  const unchosenBackground = multiplyAlpha(accent, UNCHOSEN_ALPHA)

  // Avatars replace the counts only when every reactor is known, so a pill never mixes the two.
  const reactionCount = reactions.reduce((total, reaction) => total + reaction.userIds.length, 0)
  const reactorsByEmoji = getUser && (!isGroupChat || reactionCount <= MAX_AVATARS)
    ? reactions.map(reaction => reaction.userIds.map(getUser))
    : null
  const canShowAvatars = !!reactorsByEmoji && reactorsByEmoji.every(users => users.every(Boolean))

  const pills = reactions.map((reaction, index) => {
    const isChosen = currentUserId != null && reaction.userIds.includes(currentUserId)
    const avatars = canShowAvatars ? (reactorsByEmoji![index] as User[]).slice(-MAX_AVATARS).reverse() : undefined

    return (
      <ReactionPill
        key={reaction.emoji}
        emoji={reaction.emoji}
        count={reaction.userIds.length}
        avatars={avatars}
        isChosen={isChosen}
        background={isChosen ? accent : unchosenBackground}
        textColor={isChosen ? chosenText : unchosenText}
        onPress={onReactionPress}
        style={isChosen ? reactionActiveStyle : reactionStyle}
        textStyle={reactionTextStyle}
        countStyle={reactionCountStyle}
      />
    )
  })

  return (
    <View
      style={[
        styles.container,
        !hasContentAbove && styles.containerAlone,
        containerStyle,
      ]}
    >
      {/* The reserved time sits beside the pills, not in their wrapping row: as the row's
          last item it had to fit the bubble's width exactly, and when the pills set that width
          a rounding error wrapped it onto a row of its own after the bubble had been sized,
          pushing the text above out of the bubble. */}
      <View style={styles.pills}>{pills}</View>
      {!!trailing && <View style={styles.trailing}>{trailing}</View>}
    </View>
  )
}

const createStyles = (theme: ChatTheme) =>
  StyleSheet.create({
    // Starts at the text's inset; the pills end 7 above the body's bottom.
    container: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 4,
      paddingHorizontal: theme.spacing.bubblePaddingH,
      paddingBottom: 7,
    },
    pills: {
      flexShrink: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    containerAlone: {
      paddingTop: 6,
    },
    // 8 + 20 emoji + 3.
    pill: {
      height: 26,
      borderRadius: theme.radii.reaction,
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 8,
      paddingRight: 3,
    },
    // 8 + 20 + 4 + count + 8.
    pillWithCount: {
      paddingRight: 8,
    },
    // 8 + 20 + 6 + avatars + 3: the avatars sit as far from the end as from the top and bottom.
    avatars: {
      flexDirection: 'row',
      marginLeft: 6,
    },
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
    },
    // Each next one overlaps the one before by a fifth.
    avatarOverlap: {
      marginLeft: -AVATAR_SIZE * 0.2,
    },
    avatarImage: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
    },
    avatarText: {
      fontSize: 8,
    },
    emoji: {
      width: 20,
      fontSize: 16,
      lineHeight: 20,
      textAlign: 'center',
    },
    count: {
      marginLeft: 4,
      fontSize: theme.typography.reactionCount.fontSize,
      fontWeight: theme.typography.reactionCount.fontWeight,
      fontVariant: ['tabular-nums'],
    },
    // The reserved time sits on the pills' baseline, under the visible one.
    trailing: {
      flexShrink: 0,
      height: 14,
      justifyContent: 'flex-end',
    },
  })
