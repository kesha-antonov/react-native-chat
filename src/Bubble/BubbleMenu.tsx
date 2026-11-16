import React, { useCallback, useMemo, useState } from 'react'
import { StyleProp, ViewStyle } from 'react-native'
import Animated, { AnimatedRef, measure, runOnJS, runOnUI, useAnimatedRef } from 'react-native-reanimated'

import { ContextMenu } from '../components/ContextMenu'
import { impactHaptic } from '../components/haptics'
import { LIST_ITEM_DURATION } from '../MessagesContainer/listTransitions'
import { IMessage, MessageMenuItem } from '../Models'
import { DEFAULT_REACTION_EMOJIS, ReactionPicker } from '../Reactions'
import { ReactionPillRefs } from '../Reactions/pillRegistry'
import { ReactionTarget } from '../Reactions/types'
import { renderComponentOrElement } from '../utils'
import { BubbleBody } from './BubbleBody'
import { ReactionsDisplayProps } from './BubbleContent'
import { BubbleLayout } from './layout'
import { LIFTED_RESET, LiftedBubble } from './LiftedBubble'
import { BubbleProps } from './types'

interface PickerAnchor {
  pageX: number
  pageY: number
  bubbleWidth: number
  bubbleHeight: number
}

const NO_ANCHOR: PickerAnchor = { pageX: 0, pageY: 0, bubbleWidth: 0, bubbleHeight: 0 }

// A new reaction's pill mounts once the app has applied it and the list has drawn the row: look
// for it for this many frames, which is within the pick's grow, before it starts to fly.
const PILL_LOOKUP_FRAMES = 8

// A pick that grows the row makes the list slide the rows into place (`LIST_ITEM_DURATION`), so
// the bubble is measured every frame until that has finished: measured once, mid-slide, the
// lifted copy and the flight's target stayed where the message had been on the way, and the
// message showed up a few points away from its copy as the overlay closed.
const FOLLOW_FRAMES = Math.ceil((LIST_ITEM_DURATION + 100) / 16)

const followFrames = (frames: number, onFrame: () => void) => {
  onFrame()
  if (frames > 0)
    requestAnimationFrame(() => followFrames(frames - 1, onFrame))
}

// The pill's emoji box relative to the bubble, so the target follows the bubble when the list
// moves it; measured on the UI thread for the reason `measureBubble` gives.
const measureReactionTarget = (
  bubbleRef: AnimatedRef<Animated.View>,
  emojiRef: AnimatedRef<Animated.View>,
  onMeasured: (target: ReactionTarget) => void
) => {
  runOnUI(() => {
    'worklet'
    const bubble = measure(bubbleRef)
    const box = measure(emojiRef)
    if (bubble && box)
      runOnJS(onMeasured)({
        x: box.pageX - bubble.pageX + box.width / 2,
        y: box.pageY - bubble.pageY + box.height / 2,
      })
  })()
}

// Waits frame by frame for the pill to register, then measures it.
const findReactionTarget = (
  pillRefs: ReactionPillRefs,
  emoji: string,
  bubbleRef: AnimatedRef<Animated.View>,
  onMeasured: (target: ReactionTarget) => void,
  framesLeft = PILL_LOOKUP_FRAMES
) => {
  const emojiRef = pillRefs.get(emoji)
  if (emojiRef)
    measureReactionTarget(bubbleRef, emojiRef, onMeasured)
  else if (framesLeft > 0)
    requestAnimationFrame(() => findReactionTarget(pillRefs, emoji, bubbleRef, onMeasured, framesLeft - 1))
}

/** The long-press overlay's state: open or not, where the bubble and the finger were. */
export function useBubbleMenu () {
  const bubbleContainerRef = useAnimatedRef<Animated.View>()
  const [isPickerVisible, setIsPickerVisible] = useState(false)
  // The long-press menu is a heavy component (a Modal and a dozen animated values); a bubble
  // mounts it the first time it opens, not with every row, and keeps it for its exit animation.
  const [hasOpenedMenu, setHasOpenedMenu] = useState(false)
  if (isPickerVisible && !hasOpenedMenu)
    setHasOpenedMenu(true)
  const [pickerAnchor, setPickerAnchor] = useState<PickerAnchor>(NO_ANCHOR)
  // True while the overlay shows the lifted copy - through its exit animation
  // too, which outlasts `isPickerVisible`.
  const [isLifted, setIsLifted] = useState(false)
  // Where the finger was: the menu opens beside it.
  const [touchPoint, setTouchPoint] = useState<{ touchX?: number, touchY?: number }>({})
  // The message's reaction pills (see `ReactionPillRefsContext`), and where a pick lands.
  const [pillRefs] = useState<ReactionPillRefs>(() => new Map())
  const [reactionTarget, setReactionTarget] = useState<ReactionTarget | undefined>(undefined)

  const open = useCallback((touchX?: number, touchY?: number) => {
    // The system long-press tick, mapped to a medium impact.
    impactHaptic('Medium')
    setTouchPoint({ touchX, touchY })
    setReactionTarget(undefined)
    setIsPickerVisible(true)
  }, [])

  const close = useCallback(() => {
    setIsPickerVisible(false)
  }, [])

  // Measured on the UI thread, from the native view: the list rides the keyboard on an
  // animated transform that never reaches the shadow tree on Android, so a JS `measure` kept
  // returning the row's place from before the keyboard went down, and the lifted copy and its
  // menu stayed there, over another message.
  const measureBubble = useCallback(() => {
    runOnUI(() => {
      'worklet'
      const frame = measure(bubbleContainerRef)
      if (frame)
        runOnJS(setPickerAnchor)({ pageX: frame.pageX, pageY: frame.pageY, bubbleWidth: frame.width, bubbleHeight: frame.height })
    })()
  }, [bubbleContainerRef])

  // Called right after a pick is applied; until the pill is found the flight aims at the first
  // pill's place.
  const measureReaction = useCallback((emoji: string) => {
    findReactionTarget(pillRefs, emoji, bubbleContainerRef, setReactionTarget)
  }, [bubbleContainerRef, pillRefs])

  return {
    bubbleContainerRef,
    pillRefs,
    reactionTarget,
    measureReaction,
    isPickerVisible,
    hasOpenedMenu,
    pickerAnchor,
    touchPoint,
    isLifted,
    // The original comes back in the same commit that takes the overlay (and the copy) away:
    // the copy's own unmount reports it a render later, which left neither on screen for a
    // frame or two on Android.
    isOriginalHidden: isLifted && isPickerVisible,
    setIsLifted,
    open,
    close,
    measureBubble,
  }
}

export type BubbleMenuState = ReturnType<typeof useBubbleMenu>

/**
 * The long-press overlay: the context menu (with a reactions row when reactions are on) when the
 * message has actions, the reactions picker otherwise. Both lift a copy of the bubble over the
 * backdrop.
 */
export function BubbleMenu<TMessage extends IMessage> ({ bubble, layout, menu, menuItems, wrapperStyleList, reactionsDisplay }: {
  bubble: BubbleProps<TMessage>
  layout: BubbleLayout
  menu: BubbleMenuState
  menuItems: MessageMenuItem[]
  wrapperStyleList: StyleProp<ViewStyle>
  reactionsDisplay: ReactionsDisplayProps | null
}) {
  const { currentMessage, position, reactions } = bubble
  const { isPickerVisible, isLifted, pickerAnchor, touchPoint, reactionTarget, close, measureBubble, measureReaction, setIsLifted } = menu
  const hasMenu = menuItems.length > 0

  // The reactions you already picked, which the menu's bar draws smaller, in a circle.
  const currentUserId = bubble.user?._id
  const chosenReactions = useMemo(() => currentUserId == null
    ? undefined
    : currentMessage?.reactions?.filter(reaction => reaction.userIds.includes(currentUserId)).map(reaction => reaction.emoji)
  , [currentMessage?.reactions, currentUserId])

  // A pick is applied at once; the overlay's flight then needs the bubble's
  // new spot, as a first reaction grows the row and the list moves it, and its pill's.
  const selectReaction = useCallback((emoji: string) => {
    reactions?.onReactionPress?.(currentMessage, emoji)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      measureReaction(emoji)
      followFrames(FOLLOW_FRAMES, measureBubble)
    }))
  }, [reactions, currentMessage, measureBubble, measureReaction])

  const liftedWidth = Math.ceil(pickerAnchor.bubbleWidth + 0.5)
  const messagePreview = isPickerVisible || isLifted
    ? (
      <LiftedBubble
        onLiftChange={setIsLifted}
        onRemeasure={measureBubble}
        style={[
          wrapperStyleList,
          LIFTED_RESET,
          // Rounded up: with the time sharing the last line, a copy a fraction of a point
          // narrower than the original would wrap the time onto a line of its own.
          { width: liftedWidth, maxWidth: liftedWidth },
        ]}
      >
        <BubbleBody bubble={bubble} layout={layout} reactionsDisplay={reactionsDisplay} />
      </LiftedBubble>
    )
    : undefined

  if (hasMenu) {
    const reactionsRow = reactions?.isEnabled
      ? {
        emojis: reactions.emojis ?? DEFAULT_REACTION_EMOJIS,
        onSelect: selectReaction,
        selected: chosenReactions,
        renderExpandedPicker: reactions.renderExpandedPicker ?? undefined,
        renderReactionIcon: reactions.renderReactionIcon,
      }
      : undefined

    return (
      <ContextMenu
        visible={isPickerVisible}
        items={menuItems}
        onDismiss={close}
        position={layout.visualPosition}
        {...pickerAnchor}
        {...touchPoint}
        reactionTarget={reactionTarget}
        reactions={reactionsRow}
        messagePreview={messagePreview}
      />
    )
  }

  if (!reactions?.isEnabled)
    return null

  const pickerProps = {
    visible: isPickerVisible,
    message: currentMessage,
    emojis: reactions.emojis ?? DEFAULT_REACTION_EMOJIS,
    onSelect: selectReaction,
    onDismiss: close,
    position,
    ...pickerAnchor,
    ...touchPoint,
    reactionTarget,
    pickerContainerStyle: reactions.pickerContainerStyle,
    pickerEmojiStyle: reactions.pickerEmojiStyle,
    messagePreview,
    renderExpandedPicker: reactions.renderExpandedPicker,
    renderReactionIcon: reactions.renderReactionIcon,
  }

  if (reactions.renderReactionPicker)
    return renderComponentOrElement(reactions.renderReactionPicker, pickerProps)

  // The built-in picker aligns to the side the bubble is drawn on.
  return <ReactionPicker {...pickerProps} position={layout.visualPosition} />
}
