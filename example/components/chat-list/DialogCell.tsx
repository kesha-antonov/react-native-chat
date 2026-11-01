import React from 'react'
import { I18nManager, Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { GestureDetector, Touchable, useCompetingGestures, usePanGesture } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { Dialog, ME } from './data'
import { DialogAvatar } from './DialogAvatar'
import { formatListDate, getPreview } from './format'
import { useLastMessage, useTyping } from './store'
import { useChatListColors } from './theme'

// Row geometry: a two-line row 70 tall, the avatar 11 in and 52 across, text from 72 + 4.
export const ROW_HEIGHT = 70
const AVATAR_SIZE = 52
const AVATAR_START = 11
const TEXT_START = 76
/** The divider starts 72 in and runs to the edge. */
const DIVIDER_INSET = 72

// Swipe to archive.
/** Past 0.45 of the row's width the swipe ticks and reveals. */
const SWIPE_THRESHOLD = 0.45
/** A fling faster than about 1200 pt/s completes it too. */
const SWIPE_ESCAPE_VELOCITY = 1200
/** A cancelled swipe slides back over 200ms. */
const SWIPE_CANCEL = { duration: 200, easing: Easing.out(Easing.quad) }
/** The reveal circle grows over 300ms, accelerating. */
const REVEAL = { duration: 300, easing: Easing.in(Easing.quad) }
/** The icon is centred 43dp from the row's end. */
const ICON_END = 43

// Reordering pinned chats: a long press (the platform's 400ms) lifts the row, the others make
// way as it passes their middle, and it settles into its slot when let go.
const LONG_PRESS_MS = 400
/** The rows making way move like the list does: 250ms, bezier(0.199, 0.011, 0.279, 0.91). */
const MAKE_WAY = { duration: 250, easing: Easing.bezier(0.199, 0.011, 0.279, 0.91) }
/** The lifted row drops into place over 200ms. */
const SETTLE = { duration: 200, easing: Easing.inOut(Easing.sin) }
/** The reorder handle and the badge or pin it replaces cross-fade over 170ms. */
const HANDLE_FADE = { duration: 170, easing: Easing.linear }

/** The drag in progress, shared by every pinned row. */
export interface PinDrag {
  id: SharedValue<string>
  from: SharedValue<number>
  y: SharedValue<number>
  isActive: SharedValue<boolean>
}

export interface DialogReorder {
  /** This row's place among the pinned chats, and how many there are. */
  index: number
  count: number
  drag: PinDrag
  onStart: (dialog: Dialog) => void
  onDrop: (dialog: Dialog, toIndex: number) => void
}

/** Where the dragged row would land. */
const hoverIndex = (drag: PinDrag, count: number) => {
  'worklet'
  return Math.max(0, Math.min(count - 1, drag.from.value + Math.round(drag.y.value / ROW_HEIGHT)))
}

export interface DialogCellProps {
  dialog: Dialog
  isSelected: boolean
  isSelectionMode: boolean
  onPress: (dialog: Dialog) => void
  onLongPress: (dialog: Dialog) => void
  /** Called once a swipe has carried the row off screen (archive or unarchive). */
  onSwipe: (dialog: Dialog) => void
  isLast?: boolean
  /** Set on a pinned chat in the main list: it can be dragged among the other pinned ones. */
  reorder?: DialogReorder
  /** Selecting with more than one chat pinned: the pinned rows show a reorder handle. */
  isReordering?: boolean
}

export function DialogCell ({ dialog, isSelected, isSelectionMode, onPress, onLongPress, onSwipe, isLast, reorder, isReordering = false }: DialogCellProps) {
  // The gesture callbacks read shared values; React Compiler would memoize them into render.
  'use no memo'
  const colors = useChatListColors()
  const { width } = useWindowDimensions()
  const lastMessage = useLastMessage(dialog.id)
  const typingUser = useTyping(dialog.id)

  // The row swipes towards the start edge, revealing the action at the end.
  const direction = I18nManager.isRTL ? 1 : -1
  const translateX = useSharedValue(0)
  const isPast = useSharedValue(false)
  const reveal = useSharedValue(0)
  const iconScale = useSharedValue(1)

  const pan = usePanGesture({
    enabled: !isSelectionMode,
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
        runOnJS(Haptics.selectionAsync)()
      }
    },
    onDeactivate: event => {
      const isFling = event.velocityX * direction > SWIPE_ESCAPE_VELOCITY
      if (!event.canceled && (isPast.value || isFling)) {
        translateX.value = withTiming(width * direction, SWIPE_CANCEL, isFinished => {
          if (isFinished)
            runOnJS(onSwipe)(dialog)
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
  // How far this row has moved to make way for the dragged one.
  const shift = useSharedValue(0)
  const dragPan = usePanGesture({
    enabled: !!reorder,
    activateAfterLongPress: LONG_PRESS_MS,
    onActivate: () => {
      if (!drag)
        return
      drag.id.value = dialog.id
      drag.from.value = index
      drag.y.value = 0
      drag.isActive.value = true
      if (onDragStart)
        runOnJS(onDragStart)(dialog)
    },
    onUpdate: event => {
      if (!drag)
        return
      // Kept to the pinned rows, give or take half a row.
      const min = -(index + 0.5) * ROW_HEIGHT
      const max = (count - 1 - index + 0.5) * ROW_HEIGHT
      drag.y.value = Math.max(min, Math.min(max, event.translationY))
    },
    onDeactivate: () => {
      if (!drag || drag.id.value !== dialog.id)
        return
      const to = hoverIndex(drag, count)
      drag.y.value = withTiming((to - index) * ROW_HEIGHT, SETTLE, () => {
        if (onDrop)
          runOnJS(onDrop)(dialog, to)
      })
    },
  })
  const gesture = useCompetingGestures(pan, dragPan)

  // Where this row should sit, eased there while a drag is on and dropped at once after it.
  const lastTarget = useSharedValue(0)
  useDerivedValue(() => {
    let target = 0
    if (drag && drag.isActive.value && drag.id.value !== dialog.id) {
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
  const isLifted = useDerivedValue(() => !!drag && drag.isActive.value && drag.id.value === dialog.id)
  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: isLifted.value && drag ? drag.y.value : shift.value }],
    elevation: isLifted.value ? 6 : 0,
    shadowOpacity: isLifted.value ? 0.18 : 0,
  }))

  const handleProgress = useSharedValue(isReordering ? 1 : 0)
  React.useEffect(() => {
    handleProgress.value = withTiming(isReordering ? 1 : 0, HANDLE_FADE)
  }, [isReordering, handleProgress])
  const handleStyle = useAnimatedStyle(() => ({ opacity: handleProgress.value }))
  const trailingStyle = useAnimatedStyle(() => ({ opacity: 1 - handleProgress.value }))

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }))
  const revealStyle = useAnimatedStyle(() => ({ transform: [{ scale: reveal.value }] }))
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }))

  // Archive: blue, with the grey circle growing past the threshold. Unarchive swaps the two.
  const background = dialog.isArchived ? colors.archivePinBackground : colors.archiveBackground
  const revealColor = dialog.isArchived ? colors.archiveBackground : colors.archivePinBackground
  // The circle reaches the far corner of the row from the icon's centre.
  const revealRadius = Math.hypot(width - ICON_END, ROW_HEIGHT / 2)

  const preview = getPreview(dialog, lastMessage)
  const isOutgoing = lastMessage?.user._id === ME._id && dialog.kind !== 'channel'
  const rowBackground = isSelected ? colors.selectedRow : 'transparent'

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.row, styles.liftShadow, dragStyle]}>
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
            <MaterialCommunityIcons name={dialog.isArchived ? 'archive-arrow-up-outline' : 'archive-arrow-down-outline'} size={28} color='#FFFFFF' />
            <Text style={styles.swipeLabel}>{dialog.isArchived ? 'Unarchive' : 'Archive'}</Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.fill, { backgroundColor: colors.background }, rowStyle]}>
          <Touchable
            style={[styles.fill, { backgroundColor: rowBackground }]}
            underlayColor={colors.pressed}
            activeUnderlayOpacity={1}
            onPress={() => onPress(dialog)}
            onLongPress={() => onLongPress(dialog)}
            accessibilityRole='button'
            accessibilityLabel={dialog.title}
          >
            <View style={styles.avatar}>
              <DialogAvatar
                id={dialog.id}
                title={dialog.title}
                uri={dialog.avatar}
                size={AVATAR_SIZE}
                isOnline={dialog.isOnline}
                isSelected={isSelected}
              />
            </View>

            <View style={styles.content}>
              <View style={styles.topLine}>
                <View style={styles.nameRow}>
                  <Text style={[styles.name, { color: colors.name }]} numberOfLines={1}>{dialog.title}</Text>
                  {dialog.isVerified && <MaterialCommunityIcons name='check-decagram' size={16} color={colors.verified} style={styles.nameIcon} />}
                  {dialog.isMuted && <MaterialCommunityIcons name='volume-off' size={15} color={colors.muteIcon} style={styles.nameIcon} />}
                </View>
                {isOutgoing && !dialog.draft && (
                  <MaterialCommunityIcons
                    name={lastMessage?.pending ? 'clock-outline' : lastMessage?.received ? 'check-all' : 'check'}
                    size={17}
                    color={colors.check}
                    style={styles.checks}
                  />
                )}
                {lastMessage && <Text style={[styles.time, { color: colors.date }]}>{formatListDate(lastMessage.createdAt)}</Text>}
              </View>

              <View style={styles.bottomLine}>
                <View style={styles.previewBox}>
                  {typingUser
                    ? (
                      <Animated.View key='typing' entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.previewLayer}>
                        <Text style={[styles.message, { color: colors.typing }]} numberOfLines={1}>
                          {dialog.kind === 'group' ? `${typingUser.name?.split(' ')[0]} is typing…` : 'typing…'}
                        </Text>
                      </Animated.View>
                    )
                    : (
                      <Animated.View key='message' entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.previewLayer}>
                        {dialog.draft
                          ? (
                            <Text style={[styles.message, { color: colors.message }]} numberOfLines={1}>
                              <Text style={{ color: colors.draft }}>Draft: </Text>
                              {dialog.draft}
                            </Text>
                          )
                          : (
                            <>
                              {preview.prefix && <Text style={[styles.message, styles.noShrink, { color: colors.senderPrefix }]}>{preview.prefix}</Text>}
                              {preview.thumbnail && <Image source={{ uri: preview.thumbnail }} style={styles.thumbnail} />}
                              <Text style={[styles.message, styles.shrink, { color: colors.message }]} numberOfLines={1}>
                                {preview.attachment ? <Text style={{ color: colors.attachment }}>{preview.attachment}</Text> : preview.text}
                              </Text>
                            </>
                          )}
                      </Animated.View>
                    )}
                </View>
                <Animated.View style={trailingStyle}>
                  {dialog.unreadCount > 0
                    ? (
                      <Animated.View
                        entering={FadeIn.duration(150)}
                        exiting={FadeOut.duration(150)}
                        style={[styles.badge, { backgroundColor: dialog.isMuted ? colors.badgeMuted : colors.badge }]}
                      >
                        <Text style={[styles.badgeText, { color: colors.badgeText }]}>{dialog.unreadCount}</Text>
                      </Animated.View>
                    )
                    : dialog.isPinned && (
                      <MaterialCommunityIcons name='pin' size={18} color={colors.pinIcon} style={styles.pin} />
                    )}
                </Animated.View>
                {dialog.isPinned && (
                  <Animated.View style={[styles.handle, handleStyle]} pointerEvents='none' accessibilityElementsHidden={!isReordering}>
                    <MaterialCommunityIcons name='reorder-horizontal' size={22} color={colors.pinIcon} />
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
    width: 80,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // `dialogs_archiveTextPaint`: 13dp bold, white.
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
    // The time sits 15dp and the badge 15.67dp from the edge.
    paddingEnd: 15,
  },
  // The name's box starts 14dp down and the time's 16dp: both centre on the same line.
  topLine: {
    marginTop: 14,
    height: 19,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // 16dp Roboto Medium (`dialogs_namePaint[1]`).
  name: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'left',
  },
  nameIcon: {
    marginStart: 4,
  },
  // The checks sit 5dp before the time.
  checks: {
    marginStart: 6,
    marginEnd: 5,
  },
  // 12dp regular (`dialogs_timePaint`).
  time: {
    fontSize: 12,
    marginStart: 6,
  },
  // The badge's box starts 38dp down, the message's 39dp.
  bottomLine: {
    marginTop: 5,
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
  // 15dp regular, one line (`dialogs_messagePaint[1]`).
  message: {
    fontSize: 15,
    textAlign: 'left',
  },
  noShrink: {
    flexShrink: 0,
  },
  shrink: {
    flexShrink: 1,
  },
  // Media thumbnails in the preview: 18dp, radius 2, a 2dp gap (`DialogCell` thumbs).
  thumbnail: {
    width: 18,
    height: 18,
    borderRadius: 2,
    marginEnd: 4,
  },
  // 20.666dp tall, 6.333dp padding, an 11.5dp radius: a circle until the count needs more room.
  badge: {
    minWidth: 20.666,
    height: 20.666,
    borderRadius: 11.5,
    paddingHorizontal: 6.333,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: 0.666,
  },
  // 13dp bold, white.
  badgeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // The pin is a tilted pushpin.
  pin: {
    transform: [{ rotate: '45deg' }],
  },
  // In the pin's place, at the end of the second line.
  handle: {
    position: 'absolute',
    end: 0,
    top: -1,
  },
  divider: {
    position: 'absolute',
    start: DIVIDER_INSET,
    end: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
})
