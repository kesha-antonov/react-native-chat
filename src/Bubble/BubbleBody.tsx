import React from 'react'
import { Text, View } from 'react-native'

import { BubbleTail, GradientBubbleBackground } from '../components/BubbleBackground'
import { BubbleHighlightTint, useMessageHighlightToken } from '../components/messageHighlight'
import { useTheme, useThemedStyles } from '../hooks/useTheme'
import { IMessage } from '../Models'
import { getNameColor } from '../Theme'
import { renderComponentOrElement } from '../utils'
import { BubbleContent, ReactionsDisplayProps } from './BubbleContent'
import { BubbleMeta, useTimeSpacer } from './BubbleMeta'
import { BubbleLayout } from './layout'
import { createBubbleStyles } from './styles'
import { BubbleProps } from './types'

/** The bubble's surface: its gradient or tail, and the tint of a quote-jump flash. */
function BubbleSurface<TMessage extends IMessage> ({ bubble, layout }: { bubble: BubbleProps<TMessage>, layout: BubbleLayout }) {
  const theme = useTheme()
  const { currentMessage, position } = bubble
  const {
    isVideoNote,
    hasTail,
    visualPosition,
    hasGradient,
    gradientStops,
    isGroupedWithNext,
    cornerStyle,
    bodyColor,
    hasShadow,
    shadowColor,
  } = layout
  // The flash after a quote jump tints the bubble too, not just the row behind it.
  const highlightToken = useMessageHighlightToken(currentMessage?._id)

  if (isVideoNote)
    return null

  const tailSide = hasTail ? visualPosition : undefined

  return (
    <>
      {hasGradient && currentMessage
        ? (
          <GradientBubbleBackground
            stops={gradientStops!}
            mode={theme.bubble.outgoingGradientMode}
            messageId={currentMessage._id}
            bottomGap={isGroupedWithNext ? theme.spacing.withinGroup : theme.spacing.betweenGroups}
            cornerStyle={cornerStyle}
            tailSide={tailSide}
          />
        )
        : tailSide && <BubbleTail side={tailSide} color={bodyColor} shadowColor={hasShadow ? shadowColor : undefined} />}
      {!!highlightToken && (
        <BubbleHighlightTint
          token={highlightToken}
          color={position === 'right' ? theme.colors.outgoingBubbleSelected : theme.colors.incomingBubbleSelected}
          cornerStyle={cornerStyle}
        />
      )}
    </>
  )
}

/** The sender's name over the first message of someone else's run. */
function BubbleUsername<TMessage extends IMessage> ({ bubble, layout }: { bubble: BubbleProps<TMessage>, layout: BubbleLayout }) {
  const theme = useTheme()
  const styles = useThemedStyles(createBubbleStyles)
  const { currentMessage } = bubble

  if (!layout.isUsernameShown || !currentMessage)
    return null

  if (bubble.renderUsername)
    return renderComponentOrElement(bubble.renderUsername, currentMessage.user)

  return (
    <View style={styles.usernameContainer}>
      <Text
        style={[styles.username, { color: getNameColor(theme, currentMessage.user._id) }, bubble.usernameStyle]}
        numberOfLines={1}
      >
        {currentMessage.user.name}
      </Text>
    </View>
  )
}

/**
 * Everything inside the bubble's outline: surface, name, content and time. Drawn in the row, and
 * again as the lifted copy the long-press menu shows.
 */
export function BubbleBody<TMessage extends IMessage> ({ bubble, layout, reactionsDisplay }: {
  bubble: BubbleProps<TMessage>
  layout: BubbleLayout
  reactionsDisplay: ReactionsDisplayProps | null
}) {
  const timeSpacer = useTimeSpacer(bubble, layout)
  return (
    <>
      <BubbleSurface bubble={bubble} layout={layout} />
      <BubbleUsername bubble={bubble} layout={layout} />
      <BubbleContent bubble={bubble} layout={layout} timeSpacer={timeSpacer} reactionsDisplay={reactionsDisplay} />
      <BubbleMeta bubble={bubble} layout={layout} />
    </>
  )
}
