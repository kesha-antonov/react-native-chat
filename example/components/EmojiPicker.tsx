import React, { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Rises on a firm spring and drops away a little faster, like an iOS sheet.
const SHEET_SPRING = { damping: 30, stiffness: 320, mass: 1, reduceMotion: ReduceMotion.System }
const SHEET_OUT = { duration: 220, easing: Easing.in(Easing.cubic), reduceMotion: ReduceMotion.System }
const BACKDROP_IN = { duration: 250, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }

interface EmojiPickerProps {
  visible: boolean
  onClose: () => void
  onSelect: (emoji: string) => void
}

const CATEGORIES: { name: string, emojis: string[] }[] = [
  { name: 'Smileys', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😋', '😜', '🤪', '🤗', '🤔', '🤨', '😐', '😴', '😎', '🥳', '😏', '😢', '😭'] },
  { name: 'Gestures', emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '👏', '🙌', '👐', '🤝', '🙏', '💪', '👆', '👇', '👈', '👉', '👋', '🤙', '✍️'] },
  { name: 'Hearts', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'] },
  { name: 'Animals', emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦄', '🐢'] },
  { name: 'Food', emojis: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍒', '🍑', '🥭', '🍍', '🥥', '🍅', '🍔', '🍕', '🍟', '🍰'] },
  { name: 'Misc', emojis: ['⚽', '🏀', '🎾', '🎯', '🎮', '🎲', '🎸', '🎉', '🎊', '🔥', '✨', '⭐', '🌈', '☀️', '🌙', '⚡', '💯', '✅', '❌', '❓'] },
]

export default function EmojiPicker ({ visible, onClose, onSelect }: EmojiPickerProps) {
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()

  // The Modal outlives `visible` until the sheet has slid away, so the exit
  // animation is never cut off by an unmount.
  const [isMounted, setIsMounted] = useState(visible)
  if (visible && !isMounted)
    setIsMounted(true)

  const backdrop = useSharedValue(0)
  const offset = useSharedValue(windowHeight)

  useEffect(() => {
    if (visible) {
      offset.value = withSpring(0, SHEET_SPRING)
      backdrop.value = withTiming(1, BACKDROP_IN)
      return
    }

    backdrop.value = withTiming(0, SHEET_OUT)
    offset.value = withTiming(windowHeight, SHEET_OUT, finished => {
      if (finished)
        runOnJS(setIsMounted)(false)
    })
  }, [visible, windowHeight, backdrop, offset])

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }))
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }))

  if (!isMounted)
    return null

  return (
    <Modal transparent visible animationType='none' onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents='none' />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel='dismiss' />
      <Animated.View style={[styles.panel, { paddingBottom: insets.bottom + 8 }, panelStyle]}>
        <View style={styles.handle} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {CATEGORIES.map(category => (
            <View key={category.name} style={styles.section}>
              <Text style={styles.sectionTitle}>{category.name}</Text>
              <View style={styles.grid}>
                {category.emojis.map((emoji, i) => (
                  <Pressable
                    key={`${category.name}-${i}`}
                    onPress={() => onSelect(emoji)}
                    style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
                  >
                    <Text style={styles.emoji}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '52%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginTop: 8,
    marginBottom: 8,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 4,
    marginLeft: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 8}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellPressed: {
    opacity: 0.4,
  },
  emoji: {
    fontSize: 28,
  },
})
