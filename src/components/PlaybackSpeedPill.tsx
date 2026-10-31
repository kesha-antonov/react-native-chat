import React, { useCallback, useRef, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'

import { useThemedStyles } from '../hooks/useTheme'
import { ChatTheme } from '../Theme'
import { PLAYBACK_RATE_PRESETS, nextPlaybackRate, setPlaybackRate } from './mediaPlayback'

const MENU_WIDTH = 120
const MENU_ROW_HEIGHT = 40

export interface PlaybackSpeedPillProps {
  rate: number
}

const formatRate = (rate: number) => `${Number(rate.toFixed(2))}x`

/**
 * The speed pill on a voice note: a tap cycles 1x / 1.5x / 2x, a long press
 * opens Telegram's presets (`FragmentContextView`). The speed is shared by
 * every note.
 */
export function PlaybackSpeedPill ({ rate }: PlaybackSpeedPillProps) {
  const styles = useThemedStyles(createStyles)
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const pillRef = useRef<View>(null)
  const [anchor, setAnchor] = useState<{ x: number, y: number } | null>(null)

  const cycle = useCallback(() => {
    setPlaybackRate(nextPlaybackRate(rate))
  }, [rate])

  const openMenu = useCallback(() => {
    pillRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x: x + width / 2, y: y + height })
    })
  }, [])

  const closeMenu = useCallback(() => setAnchor(null), [])

  const pick = useCallback((next: number) => {
    setPlaybackRate(next)
    setAnchor(null)
  }, [])

  const menuHeight = PLAYBACK_RATE_PRESETS.length * MENU_ROW_HEIGHT
  // Below the pill when it fits, above it otherwise, always on screen.
  const menuTop = anchor
    ? (anchor.y + menuHeight + 8 < windowHeight ? anchor.y + 4 : Math.max(8, anchor.y - menuHeight - 24))
    : 0
  const menuLeft = anchor
    ? Math.max(8, Math.min(windowWidth - MENU_WIDTH - 8, anchor.x - MENU_WIDTH / 2))
    : 0

  return (
    <>
      <Pressable
        ref={pillRef}
        onPress={cycle}
        onLongPress={openMenu}
        accessibilityRole='button'
        accessibilityLabel={`playback speed ${formatRate(rate)}`}
        accessibilityHint='long press for more speeds'
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        style={[styles.pill, rate !== 1 && styles.pillActive]}
      >
        <Text style={[styles.pillText, rate !== 1 && styles.pillTextActive]}>{formatRate(rate)}</Text>
      </Pressable>

      <Modal visible={!!anchor} transparent animationType='fade' onRequestClose={closeMenu}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} accessibilityLabel='close'>
          <View style={[styles.menu, { top: menuTop, left: menuLeft }]}>
            {PLAYBACK_RATE_PRESETS.map(preset => (
              <Pressable
                key={preset}
                onPress={() => pick(preset)}
                accessibilityRole='button'
                accessibilityState={{ selected: preset === rate }}
                style={styles.menuRow}
              >
                <Text style={[styles.menuText, preset === rate && styles.menuTextSelected]}>
                  {formatRate(preset)}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  )
}

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  // Telegram's `SpeedIconDrawable`: the rate in 10dp bold inside a 1.6dp
  // outline with 3dp corners and 3dp either side, drawn in the close
  // button's gray (`inappPlayerClose`) at 1x and in the accent otherwise.
  pill: {
    paddingHorizontal: 3,
    borderWidth: 1.6,
    borderRadius: 3,
    borderColor: theme.colors.placeholder,
  },
  pillActive: {
    borderColor: theme.colors.accent,
  },
  pillText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    color: theme.colors.placeholder,
  },
  pillTextActive: {
    color: theme.colors.accent,
  },
  menu: {
    position: 'absolute',
    width: MENU_WIDTH,
    borderRadius: 12,
    paddingVertical: 4,
    backgroundColor: theme.colors.inputBackground,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  menuRow: {
    height: MENU_ROW_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  menuText: {
    fontSize: 15,
    color: theme.colors.inputText,
  },
  menuTextSelected: {
    color: theme.colors.accent,
    fontWeight: '600',
  },
})
