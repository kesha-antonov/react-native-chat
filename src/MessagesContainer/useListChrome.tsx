import React, { useCallback, useMemo } from 'react'
import { View } from 'react-native'

import { useTheme } from '../hooks/useTheme'
import { LoadEarlierMessages } from '../LoadEarlierMessages'
import { IMessage } from '../Models'
import stylesCommon from '../styles'
import { TypingIndicator } from '../TypingIndicator'
import { MessagesContainerProps } from './types'

/**
 * What the list draws around the rows: the "Load earlier" header, the typing indicator (or a
 * custom footer), the empty state, and loading earlier messages on reaching the top.
 */
export function useListChrome<TMessage extends IMessage> (props: MessagesContainerProps<TMessage>) {
  const {
    isTyping = false,
    renderChatEmpty: renderChatEmptyProp,
    loadEarlierMessagesProps,
    renderTypingIndicator: renderTypingIndicatorProp,
    renderFooter: renderFooterProp,
    renderLoadEarlier: renderLoadEarlierProp,
  } = props

  const theme = useTheme()

  // The incoming bubbles start past the avatar column: the row's 8, then the avatar
  // (pulled 2 towards the edge) and the 11 the tail curls into (see `Avatar`).
  const typingIndicatorAvatarInset = useMemo(() => ({ marginLeft: 8 - 2 + theme.avatar.size + 11 }), [theme.avatar.size])

  const renderTypingIndicator = useCallback(() => {
    if (renderTypingIndicatorProp)
      return renderTypingIndicatorProp()

    return <TypingIndicator isTyping={isTyping} style={[props.isAvatarVisible && typingIndicatorAvatarInset, props.typingIndicatorStyle]} />
  }, [isTyping, renderTypingIndicatorProp, props.isAvatarVisible, typingIndicatorAvatarInset, props.typingIndicatorStyle])

  // Only a custom footer is handed the props, so only then does it depend on them - the
  // typing indicator would otherwise be rebuilt, and the list with it, on every render.
  // A custom footer takes the typing indicator's place and gets it as the second argument, to keep
  // it next to its own content.
  const footerProps = renderFooterProp ? props : undefined
  const ListFooterComponent = useMemo(() => (
    <>
      {renderFooterProp ? renderFooterProp(footerProps!, renderTypingIndicator()) : renderTypingIndicator()}
    </>
  ), [renderFooterProp, renderTypingIndicator, footerProps])

  const renderLoadEarlier = useCallback(() => {
    if (loadEarlierMessagesProps?.isAvailable) {
      if (renderLoadEarlierProp)
        return renderLoadEarlierProp(loadEarlierMessagesProps)

      return <LoadEarlierMessages {...loadEarlierMessagesProps} />
    }

    return null
  }, [loadEarlierMessagesProps, renderLoadEarlierProp])

  const emptyContent = useMemo(() => {
    if (!renderChatEmptyProp)
      return null

    return renderChatEmptyProp()
  }, [renderChatEmptyProp])

  const renderChatEmpty = useMemo(() => (
    <View style={stylesCommon.fill}>
      {renderChatEmptyProp ? emptyContent : null}
    </View>
  ), [renderChatEmptyProp, emptyContent])

  const ListHeaderComponent = useMemo(() => {
    const content = renderLoadEarlier()

    if (!content)
      return undefined

    return (
      <View style={stylesCommon.fill}>{content}</View>
    )
  }, [renderLoadEarlier])

  // The oldest messages are at the top, so infinite scroll loads earlier ones on reaching it.
  const onStartReached = useCallback(() => {
    if (
      loadEarlierMessagesProps &&
      loadEarlierMessagesProps.isAvailable &&
      loadEarlierMessagesProps.isInfiniteScrollEnabled &&
      !loadEarlierMessagesProps.isLoading
    )
      loadEarlierMessagesProps.onPress()
  }, [loadEarlierMessagesProps])

  return { ListHeaderComponent, ListFooterComponent, renderChatEmpty, onStartReached }
}
