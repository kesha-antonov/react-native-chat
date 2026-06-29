import React from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

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

  return (
    <Modal transparent visible={visible} animationType='slide' onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel='dismiss' />
      <View style={[styles.panel, { paddingBottom: insets.bottom + 8 }]}>
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
      </View>
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
