import React from 'react'
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native'
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated'

import { Icon } from '../components/Icon'
import { useTheme } from '../hooks/useTheme'
import { getUserColorIndex } from '../Theme'
import { getInitials } from './utils'

const gradient = (top: string, bottom: string | undefined): ViewStyle => bottom
  ? { backgroundColor: bottom, experimental_backgroundImage: `linear-gradient(to bottom, ${top}, ${bottom})` } as ViewStyle
  : { backgroundColor: top }

export interface ChatListAvatarProps {
  id: string | number
  title: string
  uri?: string
  size: number
  /** The archive folder's grey avatar. */
  isArchive?: boolean
  /** The green online dot. */
  isOnline?: boolean
  /** The selection check, on the bottom-right corner. */
  isSelected?: boolean
  /** The ring around the dot and the check: the row's background. */
  ringColor?: string
}

/**
 * A chat's avatar: its photo, or its initials on the same per-id color the chat uses for that
 * person, so their color matches between the list and their messages.
 */
export function ChatListAvatar ({ id, title, uri, size, isArchive, isOnline, isSelected, ringColor }: ChatListAvatarProps) {
  const theme = useTheme()
  const colors = theme.chatList
  const { palette, paletteEnd } = theme.avatar
  const radius = size / 2
  const index = getUserColorIndex(id, palette.length)
  const ring = ringColor ?? colors.background
  const circle = { width: size, height: size, borderRadius: radius }

  return (
    <View style={{ width: size, height: size }}>
      {isArchive
        ? (
          // Not collapsable: flattened into the row, the glyph was drawn under the circle.
          <View style={[styles.center, circle, { backgroundColor: colors.archiveAvatar }]} collapsable={false}>
            <Icon name='archiveFolder' color='#FFFFFF' size={Math.round(size * 0.46)} fallback={null} />
          </View>
        )
        : uri
          ? <Image source={{ uri }} style={[circle, { backgroundColor: paletteEnd[index] ?? palette[index] }]} />
          : (
            <View style={[styles.center, circle, gradient(palette[index], paletteEnd[index])]}>
              <Text style={[styles.initials, { color: theme.avatar.textColor, fontSize: Math.round(size * 0.35) }]}>{getInitials(title)}</Text>
            </View>
          )}
      {isOnline && !isSelected && (
        <Animated.View
          entering={ZoomIn.duration(150)}
          exiting={ZoomOut.duration(150)}
          style={[styles.online, { backgroundColor: colors.online, borderColor: ring }]}
        />
      )}
      {isSelected && (
        <Animated.View
          entering={ZoomIn.duration(200)}
          exiting={ZoomOut.duration(200)}
          style={[styles.check, { backgroundColor: colors.checkbox, borderColor: ring }]}
        >
          <Icon name='check' color='#FFFFFF' size={13} fallback={<Text style={styles.checkText}>✓</Text>} />
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '600',
  },
  // A 14 dot with a 2 ring, its centre 6 in from the right and 8 up from the bottom.
  online: {
    position: 'absolute',
    end: -1,
    bottom: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  // A 24 check with a 2 ring on the bottom-right corner.
  check: {
    position: 'absolute',
    end: -3,
    bottom: -3,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
})
