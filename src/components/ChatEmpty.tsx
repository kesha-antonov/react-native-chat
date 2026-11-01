import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useLabels } from '../hooks/useLabels'
import { useThemedStyles } from '../hooks/useTheme'
import { ChatTheme } from '../Theme'

export interface ChatEmptyProps {
  /**
   * The big greeting under the text, sent as a message when tapped. `null` leaves it out.
   * @default '👋'
   */
  greeting?: string | null
  /** Called with the greeting when it is tapped. */
  onPressGreeting?: (greeting: string) => void
}

/**
 * The empty chat: a service-colored card in the middle of
 * the wallpaper with "No messages here yet..." in bold, a line of help below it, and a greeting
 * sticker that sends itself when tapped. Without a sticker of the app's own, the waving hand
 * stands in for it.
 */
export function ChatEmpty ({ greeting = '👋', onPressGreeting }: ChatEmptyProps) {
  const styles = useThemedStyles(createStyles)
  const labels = useLabels()

  return (
    <View style={styles.card} testID='chat-empty'>
      <Text style={[styles.text, styles.title]}>{labels.emptyChatTitle}</Text>
      {!!greeting && <Text style={styles.text}>{labels.emptyChatText}</Text>}
      {!!greeting && (
        <Pressable
          onPress={() => onPressGreeting?.(greeting)}
          disabled={!onPressGreeting}
          accessibilityRole='button'
          accessibilityLabel={`${labels.send} ${greeting}`}
          style={({ pressed }) => [styles.sticker, pressed && styles.stickerPressed]}
        >
          <Text style={styles.greeting} allowFontScaling={false}>{greeting}</Text>
        </Pressable>
      )}
    </View>
  )
}

// The greeting card: 8 padding on top; title and description 14dp (the title bold) in
// the service text color, 20 from the sides and 6 above and below each; a 112dp sticker 10 below
// them and 16 from the bottom; the card is the service color with radius 16.
const createStyles = (theme: ChatTheme) => StyleSheet.create({
  card: {
    alignSelf: 'center',
    maxWidth: 260,
    paddingTop: 8,
    borderRadius: 16,
    backgroundColor: theme.colors.dayPillBackground,
    alignItems: 'center',
  },
  text: {
    marginHorizontal: 20,
    marginVertical: 6,
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
    color: theme.colors.dayPillText,
  },
  title: {
    fontWeight: '700',
  },
  sticker: {
    width: 112,
    height: 112,
    marginTop: 10,
    marginBottom: 16,
    marginHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The greeting sticker shrinks a little while pressed.
  stickerPressed: {
    transform: [{ scale: 0.9 }],
  },
  greeting: {
    fontSize: 80,
    lineHeight: 96,
    textAlign: 'center',
  },
})
