import React, { useCallback, useMemo } from 'react'
import { Pressable, StyleProp, View, ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'

import { useChatContext } from '../ChatContext'
import { useThemedStyles } from '../hooks/useTheme'
import { IMessage } from '../Models'
import { getStyleWithPosition } from '../styles'
import { renderComponentOrElement } from '../utils'
import { BubbleBody } from './BubbleBody'
import { BubbleQuickReplies, ReactionsDisplayProps } from './BubbleContent'
import { BubbleMenu, useBubbleMenu } from './BubbleMenu'
import { useBubbleLayout } from './layout'
import { hiddenStyle, PressableBubbleRow } from './PressableBubbleRow'
import { createBubbleStyles } from './styles'
import { BubbleProps } from './types'

export * from './types'
export type { PressableBubbleRowProps } from './PressableBubbleRow'

/**
 * One message's bubble. It decides its layout once (`useBubbleLayout`) and hands it to its
 * parts: the body (surface, name, content, time), the quick replies and reactions under it, and
 * the long-press menu.
 */
export const Bubble = <TMessage extends IMessage = IMessage>(props: BubbleProps<TMessage>): React.ReactElement => {
  const {
    currentMessage,
    position,
    containerStyle,
    wrapperStyle,
    onPressMessage: onPressMessageProp,
    onLongPressMessage: onLongPressMessageProp,
    reactions,
    messageActions,
    isMessageGestureEnabled = true,
  } = props

  const context = useChatContext()
  const styles = useThemedStyles(createBubbleStyles)
  const layout = useBubbleLayout(props)
  const menu = useBubbleMenu()
  const {
    visualPosition,
    maxWidth,
    cornerStyle,
    hasShadow,
    shadowColor,
    styledBubbleToNext,
    styledBubbleToPrevious,
    hasGradient,
    isVideoNote,
    isBigEmoji,
  } = layout

  // Resolve the long-press context-menu actions for this message.
  const menuItems = useMemo(() => {
    if (!messageActions || !currentMessage)
      return []

    return typeof messageActions === 'function' ? messageActions(currentMessage) : messageActions
  }, [messageActions, currentMessage])
  const hasMenu = menuItems.length > 0

  // Consumers can hand the touches back to natively interactive content
  // (video controls, maps, WebViews) on a per-message basis.
  const isGestureEnabled = typeof isMessageGestureEnabled === 'function'
    ? (currentMessage ? isMessageGestureEnabled(currentMessage) : true)
    : isMessageGestureEnabled

  const onPress = useCallback(() => {
    onPressMessageProp?.(context, currentMessage)
  }, [onPressMessageProp, context, currentMessage])

  const onLongPress = useCallback(() => {
    onLongPressMessageProp?.(context, currentMessage)
  }, [onLongPressMessageProp, context, currentMessage])

  const reactionsDisplay = useMemo((): ReactionsDisplayProps | null => {
    const currentReactions = currentMessage?.reactions
    if (!currentReactions || currentReactions.length === 0)
      return null

    return {
      message: currentMessage,
      reactions: currentReactions,
      currentUserId: props.user?._id,
      position,
      onReactionPress: (emoji: string) => reactions?.onReactionPress?.(currentMessage, emoji),
      containerStyle: reactions?.containerStyle,
      reactionStyle: reactions?.reactionStyle,
      reactionActiveStyle: reactions?.reactionActiveStyle,
      reactionTextStyle: reactions?.reactionTextStyle,
      reactionCountStyle: reactions?.reactionCountStyle,
      getUser: reactions?.getUser,
      isGroupChat: reactions?.isGroupChat,
    }
  }, [currentMessage, position, props.user, reactions])

  const wrapperStyleList = useMemo(() => [
    getStyleWithPosition(styles, 'wrapper', position),
    { maxWidth },
    cornerStyle,
    hasShadow && { boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 0.5, color: shadowColor }] },
    styledBubbleToNext,
    styledBubbleToPrevious,
    wrapperStyle?.[position],
    hasGradient && styles.gradientWrapper,
    isVideoNote && styles.noteWrapper,
    isBigEmoji && styles.emojiWrapper,
  ] as StyleProp<ViewStyle>, [position, maxWidth, cornerStyle, hasShadow, shadowColor, styledBubbleToNext, styledBubbleToPrevious, wrapperStyle, styles, hasGradient, isVideoNote, isBigEmoji])

  const containerStyleList = useMemo(() => [
    getStyleWithPosition(styles, 'container', visualPosition),
    containerStyle?.[position],
  ], [styles, position, visualPosition, containerStyle])

  const rowSurfaceStyle = useMemo(
    () => getStyleWithPosition(styles, 'rowSurface', visualPosition),
    [styles, visualPosition]
  )

  const body = <BubbleBody bubble={props} layout={layout} reactionsDisplay={reactionsDisplay} />

  // A custom reactions display keeps its old place under the bubble.
  const customReactions = reactions?.renderReactions && reactionsDisplay
    ? renderComponentOrElement(reactions.renderReactions, reactionsDisplay as Parameters<typeof reactions.renderReactions>[0])
    : null
  const reactionsBelow = customReactions && menu.isLifted
    ? <View style={hiddenStyle}>{customReactions}</View>
    : customReactions

  // Overlay path: a long-press opens either the context menu
  // (when messageActions are provided, optionally with a reactions row) or the
  // reactions quick-picker. The Animated.View carries only the scale transform.
  if (reactions?.isEnabled || hasMenu)
    // `rowSurface` spans the whole message row, so a long-press in the empty
    // space beside the bubble opens the picker too.
    return (
      <Animated.View style={containerStyleList}>
        <PressableBubbleRow
          isGestureEnabled={isGestureEnabled}
          isLifted={menu.isLifted}
          onPressMessage={onPressMessageProp}
          onLongPressStart={menu.open}
          measureBubble={menu.measureBubble}
          context={context}
          currentMessage={currentMessage}
          rowSurfaceStyle={rowSurfaceStyle}
          wrapperStyleList={wrapperStyleList}
          bubbleContainerRef={menu.bubbleContainerRef}
        >
          {body}
        </PressableBubbleRow>
        <BubbleQuickReplies bubble={props} />
        {reactionsBelow}
        {/* A custom picker stays mounted, as it always has; the built-in ones mount on first use. */}
        {(menu.hasOpenedMenu || (!hasMenu && !!reactions?.renderReactionPicker)) && (
          <BubbleMenu
            bubble={props}
            layout={layout}
            menu={menu}
            menuItems={menuItems}
            wrapperStyleList={wrapperStyleList}
            reactionsDisplay={reactionsDisplay}
          />
        )}
      </Animated.View>
    )

  // Default path: unchanged behaviour for existing users, preserving
  // touchableProps, native press feedback, and the onLongPressMessage callback.
  return (
    <View style={containerStyleList}>
      <View style={wrapperStyleList}>
        {isGestureEnabled
          ? (
            <Pressable
              onPress={onPress}
              onLongPress={onLongPress}
              {...props.touchableProps}
            >
              {body}
            </Pressable>
          )
          : body}
      </View>
      <BubbleQuickReplies bubble={props} />
      {reactionsBelow}
    </View>
  )
}
