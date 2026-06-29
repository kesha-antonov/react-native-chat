import React, { useCallback } from 'react'
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native'

import { useThemedStyles } from '../hooks/useTheme'
import { MessageMenuItem } from '../Models'
import { ChatTheme } from '../Theme'

const MENU_WIDTH = 240
const ROW_HEIGHT = 48
const REACTION_ROW_HEIGHT = 52
const VERTICAL_OFFSET = 8
const EDGE = 8

export interface ContextMenuReactions {
  emojis: string[]
  onSelect: (emoji: string) => void
}

export interface ContextMenuProps {
  visible: boolean
  items: MessageMenuItem[]
  onDismiss: () => void
  position?: 'left' | 'right'
  pageX?: number
  pageY?: number
  bubbleWidth?: number
  bubbleHeight?: number
  /** Optional reactions pill rendered above the action list. */
  reactions?: ContextMenuReactions
}

/**
 * Telegram-style long-press context menu: a floating, themed action list
 * anchored to the bubble, with an optional reactions pill on top. Dependency-free
 * (Modal + Views), dark-mode aware.
 */
export const ContextMenu = ({
  visible,
  items,
  onDismiss,
  position = 'left',
  pageX = 0,
  pageY = 0,
  bubbleWidth = 0,
  bubbleHeight = 0,
  reactions,
}: ContextMenuProps) => {
  const styles = useThemedStyles(createStyles)
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window')

  const menuHeight = items.length * ROW_HEIGHT + (reactions ? REACTION_ROW_HEIGHT + VERTICAL_OFFSET : 0)

  const showAbove = pageY >= menuHeight + VERTICAL_OFFSET && pageY + bubbleHeight + menuHeight > screenHeight
  const top = showAbove
    ? Math.max(EDGE, pageY - menuHeight - VERTICAL_OFFSET)
    : Math.min(pageY + bubbleHeight + VERTICAL_OFFSET, screenHeight - menuHeight - EDGE)

  const left = position === 'right'
    ? Math.max(EDGE, Math.min(pageX + bubbleWidth - MENU_WIDTH, screenWidth - MENU_WIDTH - EDGE))
    : Math.max(EDGE, Math.min(pageX, screenWidth - MENU_WIDTH - EDGE))

  const handlePress = useCallback((onPress: () => void) => {
    onPress()
    onDismiss()
  }, [onDismiss])

  const handleReaction = useCallback((emoji: string) => {
    reactions?.onSelect(emoji)
    onDismiss()
  }, [reactions, onDismiss])

  if (!visible)
    return null

  return (
    <Modal transparent visible={visible} animationType='fade' onRequestClose={onDismiss} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

      <View style={[styles.anchor, { top, left, width: MENU_WIDTH }]} pointerEvents='box-none'>
        {reactions && reactions.emojis.length > 0 && (
          <View style={styles.reactionPill}>
            {reactions.emojis.map(emoji => (
              <Pressable
                key={emoji}
                onPress={() => handleReaction(emoji)}
                style={({ pressed }) => [styles.reactionButton, pressed && styles.pressed]}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.menu}>
          {items.map((item, index) => (
            <Pressable
              key={`${item.label}-${index}`}
              onPress={() => handlePress(item.onPress)}
              style={({ pressed }) => [
                styles.row,
                index > 0 && styles.rowDivider,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[styles.rowLabel, item.destructive && styles.destructive]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
              {item.icon?.({
                color: item.destructive ? styles.destructive.color : styles.rowLabel.color,
                size: 20,
              })}
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  )
}

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  anchor: {
    position: 'absolute',
  },
  reactionPill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginBottom: VERTICAL_OFFSET,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  reactionButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionEmoji: {
    fontSize: 24,
  },
  menu: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.separator,
  },
  pressed: {
    backgroundColor: theme.colors.reactionBackground,
  },
  rowLabel: {
    fontSize: 16,
    color: theme.colors.incomingText,
  },
  destructive: {
    color: theme.colors.error,
  },
})
