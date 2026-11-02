import React, { memo, useEffect } from 'react'
import { I18nManager, Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { GestureDetector, Touchable, useCompetingGestures, usePanGesture } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { useChatContext } from '../ChatContext'
import { selectionHaptic } from '../components/haptics'
import { Icon } from '../components/Icon'
import { TypingStatus } from '../components/TypingStatus'
import { useLabels } from '../hooks/useLabels'
import { useTheme } from '../hooks/useTheme'
import { ChatListAvatar } from './ChatListAvatar'
import { ChatListCellProps, ChatListDrag, ChatListItem } from './types'
import { formatChatListDate, getChatPreview } from './utils'

// A two-line row 70 tall: the avatar 11 in and 52 across, the text from 76.
export const CHAT_LIST_ROW_HEIGHT = 70
const ROW_HEIGHT = CHAT_LIST_ROW_HEIGHT
const AVATAR_SIZE = 52
const AVATAR_START = 11
const TEXT_START = 76
/** The divider starts 72 in and runs to the edge. */
const DIVIDER_INSET = 72

/** Past 0.45 of the row's width the swipe ticks and reveals; a fast fling completes it too. */
const SWIPE_THRESHOLD = 0.45
const SWIPE_ESCAPE_VELOCITY = 1200
/** A cancelled swipe slides back over 200ms. */
const SWIPE_CANCEL = { duration: 200, easing: Easing.out(Easing.quad) }
/** The reveal circle grows over 300ms, accelerating. */
const REVEAL = { duration: 300, easing: Easing.in(Easing.quad) }
/** The swipe's icon is centred 43 from the row's end. */
const ICON_END = 43

// Reordering pinned chats: a long press (the platform's 400ms) lifts the row, the others make
// way as it passes their middle, and it settles into its slot when let go.
const LONG_PRESS_MS = 400
const MAKE_WAY = { duration: 250, easing: Easing.bezier(0.199, 0.011, 0.279, 0.91) }
const SETTLE = { duration: 200, easing: Easing.inOut(Easing.sin) }
/** The reorder handle and the badge or pin it replaces cross-fade over 170ms. */
const HANDLE_FADE = { duration: 170, easing: Easing.linear }

/** Where the dragged row would land. */
const hoverIndex = (drag: ChatListDrag, count: number) => {
  'worklet'
  return Math.max(0, Math.min(count - 1, drag.from.value + Math.round(drag.y.value / ROW_HEIGHT)))
}

/**
 * A chat's row: avatar, name, time, the last message (or a draft, or who is typing), the unread
 * counter or pin, a swipe to archive, and dragging when pinned chats can be reordered.
 */
function ChatListCellInner<TChat extends ChatListItem> ({
  chat,
  user,
  isSelected,
  isSelectionMode,
  onPress,
  onLongPress,
  onSwipe,
  isLast,
  reorder,
  isReordering = false,
}: ChatListCellProps<TChat>) {
  // The gesture callbacks read shared values; React Compiler would memoize them into render.
  'use no memo'
  const theme = useTheme()
  const colors = theme.chatList
  const labels = useLabels()
  const { getLocale } = useChatContext()
  const { width } = useWindowDimensions()

  // The row swipes towards the start edge, revealing the action at the end.
  const direction = I18nManager.isRTL ? 1 : -1
  const translateX = useSharedValue(0)
  const isPast = useSharedValue(false)
  const reveal = useSharedValue(0)
  const iconScale = useSharedValue(1)

  const pan = usePanGesture({
    enabled: !isSelectionMode && !!onSwipe,
    activeOffsetX: direction < 0 ? [-15, Number.MAX_SAFE_INTEGER] : [-Number.MAX_SAFE_INTEGER, 15],
    failOffsetY: [-12, 12],
    onUpdate: event => {
      const distance = Math.max(0, event.translationX * direction)
      translateX.value = distance * direction
      const past = distance >= width * SWIPE_THRESHOLD
      if (past !== isPast.value) {
        isPast.value = past
        reveal.value = withTiming(past ? 1 : 0, REVEAL)
        if (past)
          iconScale.value = withSequence(withTiming(1.2, { duration: 85 }), withTiming(1, { duration: 85 }))
        runOnJS(selectionHaptic)()
      }
    },
    onDeactivate: event => {
      const isFling = event.velocityX * direction > SWIPE_ESCAPE_VELOCITY
      if (!event.canceled && onSwipe && (isPast.value || isFling)) {
        translateX.value = withTiming(width * direction, SWIPE_CANCEL, isFinished => {
          if (isFinished)
            runOnJS(onSwipe)(chat)
        })
        return
      }
      translateX.value = withTiming(0, SWIPE_CANCEL)
      reveal.value = withTiming(0, SWIPE_CANCEL)
      isPast.value = false
    },
  })

  const drag = reorder?.drag
  const index = reorder?.index ?? 0
  const count = reorder?.count ?? 0
  const onDragStart = reorder?.onStart
  const onDrop = reorder?.onDrop
  const chatKey = String(chat.id)
  // How far this row has moved to make way for the dragged one.
  const shift = useSharedValue(0)
  const dragPan = usePanGesture({
    enabled: !!reorder,
    activateAfterLongPress: LONG_PRESS_MS,
    onActivate: () => {
      if (!drag)
        return
      drag.id.set(chatKey)
      drag.from.set(index)
      drag.y.set(0)
      drag.isActive.set(true)
      if (onDragStart)
        runOnJS(onDragStart)(chat)
    },
    onUpdate: event => {
      if (!drag)
        return
      // Kept to the pinned rows, give or take half a row.
      const min = -(index + 0.5) * ROW_HEIGHT
      const max = (count - 1 - index + 0.5) * ROW_HEIGHT
      drag.y.set(Math.max(min, Math.min(max, event.translationY)))
    },
    onDeactivate: () => {
      if (!drag || drag.id.value !== chatKey)
        return
      const to = hoverIndex(drag, count)
      drag.y.set(withTiming((to - index) * ROW_HEIGHT, SETTLE, () => {
        if (onDrop)
          runOnJS(onDrop)(chat, to)
      }))
    },
  })
  const gesture = useCompetingGestures(pan, dragPan)

  // Where this row should sit, eased there while a drag is on and dropped at once after it.
  const lastTarget = useSharedValue(0)
  useDerivedValue(() => {
    let target = 0
    if (drag && drag.isActive.value && drag.id.value !== chatKey) {
      const from = drag.from.value
      const to = hoverIndex(drag, count)
      if (from < index && index <= to)
        target = -ROW_HEIGHT
      else if (to <= index && index < from)
        target = ROW_HEIGHT
    }
    if (target === lastTarget.value)
      return
    lastTarget.value = target
    shift.value = drag?.isActive.value ? withTiming(target, MAKE_WAY) : target
  })
  const isLifted = useDerivedValue(() => !!drag && drag.isActive.value && drag.id.value === chatKey)
  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: isLifted.value && drag ? drag.y.value : shift.value }],
    elevation: isLifted.value ? 6 : 0,
    shadowOpacity: isLifted.value ? 0.18 : 0,
  }))

  const handleProgress = useSharedValue(isReordering ? 1 : 0)
  useEffect(() => {
    handleProgress.value = withTiming(isReordering ? 1 : 0, HANDLE_FADE)
  }, [isReordering, handleProgress])
  const handleStyle = useAnimatedStyle(() => ({ opacity: handleProgress.value }))
  const trailingStyle = useAnimatedStyle(() => ({ opacity: 1 - handleProgress.value }))

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }))
  const revealStyle = useAnimatedStyle(() => ({ transform: [{ scale: reveal.value }] }))
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }))

  // Archive: the accent, with the grey circle growing past the threshold. Unarchive swaps them.
  const background = chat.isArchived ? colors.swipeUnarchive : colors.swipeArchive
  const revealColor = chat.isArchived ? colors.swipeArchive : colors.swipeUnarchive
  // The circle reaches the far corner of the row from the icon's centre.
  const revealRadius = Math.hypot(width - ICON_END, ROW_HEIGHT / 2)

  const lastMessage = chat.lastMessage
  const preview = getChatPreview(chat, labels, user)
  const typingUsers = chat.typingUsers ?? []
  const isOutgoing = !!user && lastMessage?.user?._id === user._id && chat.kind !== 'channel' && !lastMessage?.system
  const unreadCount = chat.unreadCount ?? 0
  const rowBackground = isSelected ? colors.selectedRow : 'transparent'
  const statusIcon = lastMessage?.pending ? 'clock' : lastMessage?.received ? 'checkAll' : 'check'

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.row, styles.liftShadow, dragStyle]}>
        {!!onSwipe && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: background }]}>
            <Animated.View
              style={[
                styles.reveal,
                {
                  width: revealRadius * 2,
                  height: revealRadius * 2,
                  borderRadius: revealRadius,
                  end: ICON_END - revealRadius,
                  top: ROW_HEIGHT / 2 - revealRadius,
                  backgroundColor: revealColor,
                },
                revealStyle,
              ]}
            />
            <Animated.View style={[styles.swipeAction, iconStyle]}>
              <Icon name={chat.isArchived ? 'unarchive' : 'archive'} size={28} color='#FFFFFF' fallback={null} />
              <Text style={styles.swipeLabel}>{chat.isArchived ? labels.chatListUnarchive : labels.chatListArchive}</Text>
            </Animated.View>
          </View>
        )}

        <Animated.View style={[styles.fill, { backgroundColor: colors.background }, rowStyle]}>
          <Touchable
            style={[styles.fill, { backgroundColor: rowBackground }]}
            underlayColor={colors.pressed}
            activeUnderlayOpacity={1}
            onPress={() => onPress(chat)}
            onLongPress={() => onLongPress(chat)}
            accessibilityRole='button'
            accessibilityLabel={chat.title}
            accessibilityState={{ selected: isSelected }}
          >
            <View style={styles.avatar}>
              <ChatListAvatar
                id={chat.id}
                title={chat.title}
                uri={chat.avatar}
                size={AVATAR_SIZE}
                isOnline={chat.isOnline}
                isSelected={isSelected}
              />
            </View>

            <View style={styles.content}>
              <View style={styles.topLine}>
                <View style={styles.nameRow}>
                  <Text style={[styles.name, { color: colors.name }]} numberOfLines={1}>{chat.title}</Text>
                  {chat.isVerified && (
                    <View style={styles.nameIcon}>
                      <Icon name='verified' size={16} color={colors.verified} fallback={null} />
                    </View>
                  )}
                  {chat.isMuted && (
                    <View style={styles.nameIcon}>
                      <Icon name='mute' size={15} color={colors.muteIcon} fallback={null} />
                    </View>
                  )}
                </View>
                {isOutgoing && !chat.draft && (
                  <View style={styles.checks}>
                    <Icon name={statusIcon} size={16} color={colors.check} fallback={null} />
                  </View>
                )}
                {lastMessage?.createdAt != null && (
                  <Text style={[styles.time, { color: colors.date }]}>{formatChatListDate(lastMessage.createdAt, getLocale())}</Text>
                )}
              </View>

              <View style={styles.bottomLine}>
                <View style={styles.previewBox}>
                  {typingUsers.length > 0
                    ? (
                      <Animated.View key='typing' entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.previewLayer}>
                        <TypingStatus
                          users={typingUsers}
                          action={chat.typingAction}
                          isGroup={chat.kind === 'group'}
                          color={colors.typing}
                          textStyle={styles.message}
                        />
                      </Animated.View>
                    )
                    : (
                      <Animated.View key='message' entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.previewLayer}>
                        {chat.draft
                          ? (
                            <Text style={[styles.message, { color: colors.message }]} numberOfLines={1}>
                              <Text style={{ color: colors.draft }}>{labels.chatListDraft} </Text>
                              {chat.draft}
                            </Text>
                          )
                          : (
                            <>
                              {!!preview.prefix && <Text style={[styles.message, styles.noShrink, { color: colors.senderPrefix }]}>{preview.prefix}</Text>}
                              {!!preview.thumbnail && <Image source={{ uri: preview.thumbnail }} style={styles.thumbnail} />}
                              <Text style={[styles.message, styles.shrink, { color: colors.message }]} numberOfLines={1}>
                                {preview.attachment ? <Text style={{ color: colors.attachment }}>{preview.attachment}</Text> : preview.text}
                              </Text>
                            </>
                          )}
                      </Animated.View>
                    )}
                </View>
                <Animated.View style={trailingStyle}>
                  {unreadCount > 0
                    ? (
                      <Animated.View
                        entering={FadeIn.duration(150)}
                        exiting={FadeOut.duration(150)}
                        style={[styles.badge, { backgroundColor: chat.isMuted ? colors.badgeMuted : colors.badge }]}
                      >
                        <Text style={[styles.badgeText, { color: colors.badgeText }]}>{unreadCount}</Text>
                      </Animated.View>
                    )
                    : chat.isPinned && (
                      <View style={styles.pin}>
                        <Icon name='pushpin' size={16} color={colors.pinIcon} fallback={null} />
                      </View>
                    )}
                </Animated.View>
                {chat.isPinned && (
                  <Animated.View style={[styles.handle, handleStyle]} pointerEvents='none'>
                    <Icon name='reorder' size={20} color={colors.pinIcon} fallback={<Text style={{ color: colors.pinIcon }}>≡</Text>} />
                  </Animated.View>
                )}
              </View>
            </View>

            {!isLast && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
          </Touchable>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  )
}

/** The drag props are rebuilt with the list; what matters is what they say. */
const isSameReorder = (a?: ChatListCellProps['reorder'], b?: ChatListCellProps['reorder']) =>
  a === b || (!!a && !!b && a.index === b.index && a.count === b.count && a.drag === b.drag &&
    a.onStart === b.onStart && a.onDrop === b.onDrop)

const arePropsEqual = (previous: ChatListCellProps, next: ChatListCellProps) =>
  previous.chat === next.chat &&
  previous.user === next.user &&
  previous.isSelected === next.isSelected &&
  previous.isSelectionMode === next.isSelectionMode &&
  previous.onPress === next.onPress &&
  previous.onLongPress === next.onLongPress &&
  previous.onSwipe === next.onSwipe &&
  previous.isLast === next.isLast &&
  previous.isReordering === next.isReordering &&
  isSameReorder(previous.reorder, next.reorder)

/**
 * A chat's row: avatar, name, time, the last message (or a draft, or who is typing), the unread
 * counter or pin, a swipe to archive, and dragging when pinned chats can be reordered. Rows only
 * re-render when their own chat or state changes.
 */
export const ChatListCell = memo(ChatListCellInner, arePropsEqual as never) as typeof ChatListCellInner

const styles = StyleSheet.create({
  row: {
    height: ROW_HEIGHT,
    overflow: 'hidden',
  },
  liftShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  fill: {
    flex: 1,
    flexDirection: 'row',
  },
  reveal: {
    position: 'absolute',
  },
  swipeAction: {
    position: 'absolute',
    end: ICON_END - 40,
    top: 0,
    bottom: 0,
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  avatar: {
    position: 'absolute',
    start: AVATAR_START,
    top: (ROW_HEIGHT - AVATAR_SIZE) / 2,
  },
  content: {
    flex: 1,
    marginStart: TEXT_START,
    paddingEnd: 15,
  },
  // The name's box starts 14 down and the time's 16: both centre on the same line.
  topLine: {
    marginTop: 14,
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Each line's height is set rather than left to the font: Android's Roboto, with its font
  // padding, is taller than the 20pt box, which clipped descenders and emoji, and threw the
  // typing indicator's icon off the text's middle.
  name: {
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 20,
    includeFontPadding: false,
    fontWeight: '500',
    textAlign: 'left',
  },
  nameIcon: {
    marginStart: 4,
  },
  // The checks sit 5 before the time.
  checks: {
    marginStart: 6,
    marginEnd: 5,
  },
  time: {
    fontSize: 12,
    marginStart: 6,
  },
  bottomLine: {
    marginTop: 4,
    height: 20.666,
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewBox: {
    flex: 1,
    height: 20.666,
    marginEnd: 6,
  },
  previewLayer: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    textAlign: 'left',
  },
  noShrink: {
    flexShrink: 0,
  },
  shrink: {
    flexShrink: 1,
  },
  thumbnail: {
    width: 18,
    height: 18,
    borderRadius: 2,
    marginEnd: 4,
  },
  // A circle until the count needs more room.
  badge: {
    minWidth: 20.666,
    height: 20.666,
    borderRadius: 11.5,
    paddingHorizontal: 6.333,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: 0.666,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // A tilted pushpin.
  pin: {
    transform: [{ rotate: '45deg' }],
  },
  // In the pin's place, at the end of the second line.
  handle: {
    position: 'absolute',
    end: 0,
    top: 0,
  },
  divider: {
    position: 'absolute',
    start: DIVIDER_INSET,
    end: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
})
