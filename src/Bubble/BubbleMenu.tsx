import React, { useCallback, useMemo, useState } from 'react'
import { StyleProp, ViewStyle } from 'react-native'
import Animated, { measure, runOnJS, runOnUI, useAnimatedRef } from 'react-native-reanimated'

import { ContextMenu } from '../components/ContextMenu'
import { impactHaptic } from '../components/haptics'
import { IMessage, MessageMenuItem } from '../Models'
import { DEFAULT_REACTION_EMOJIS, ReactionPicker } from '../Reactions'
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

  const open = useCallback((touchX?: number, touchY?: number) => {
    // The system long-press tick, mapped to a medium impact.
    impactHaptic('Medium')
    setTouchPoint({ touchX, touchY })
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

  return {
    bubbleContainerRef,
    isPickerVisible,
    hasOpenedMenu,
    pickerAnchor,
    touchPoint,
    isLifted,
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
  const { isPickerVisible, isLifted, pickerAnchor, touchPoint, close, measureBubble, setIsLifted } = menu
  const hasMenu = menuItems.length > 0

  // The reactions you already picked, which the menu's bar draws smaller, in a circle.
  const currentUserId = bubble.user?._id
  const chosenReactions = useMemo(() => currentUserId == null
    ? undefined
    : currentMessage?.reactions?.filter(reaction => reaction.userIds.includes(currentUserId)).map(reaction => reaction.emoji)
  , [currentMessage?.reactions, currentUserId])

  // A pick is applied at once; the overlay's flight then needs the bubble's
  // new spot, as a first reaction grows the row and the list may move it.
  const selectReaction = useCallback((emoji: string) => {
    reactions?.onReactionPress?.(currentMessage, emoji)
    requestAnimationFrame(() => requestAnimationFrame(measureBubble))
  }, [reactions, currentMessage, measureBubble])

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
    pickerContainerStyle: reactions.pickerContainerStyle,
    pickerEmojiStyle: reactions.pickerEmojiStyle,
    messagePreview,
    renderExpandedPicker: reactions.renderExpandedPicker,
  }

  if (reactions.renderReactionPicker)
    return renderComponentOrElement(reactions.renderReactionPicker, pickerProps)

  // The built-in picker aligns to the side the bubble is drawn on.
  return <ReactionPicker {...pickerProps} position={layout.visualPosition} />
}
