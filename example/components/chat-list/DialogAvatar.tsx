import React from 'react'
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { getUserColorIndex } from '@kesha-antonov/react-native-chat'
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated'

import { useChatListColors } from './theme'

const gradient = (top: string, bottom: string): ViewStyle => {
  const css = `linear-gradient(to bottom, ${top}, ${bottom})`
  return { backgroundColor: bottom, experimental_backgroundImage: css } as ViewStyle
}

/** `AvatarDrawable` initials: the first letters of the first two words. */
export function getInitials (title: string): string {
  const words = title.replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/).filter(Boolean)
  return words.slice(0, 2).map(word => word[0]).join('').toUpperCase()
}

export interface DialogAvatarProps {
  id: string
  title: string
  uri?: string
  size: number
  kind?: 'archive'
  /** The green online dot (`DialogCell`: ring r7 in the row color, fill r5). */
  isOnline?: boolean
  /** The selection check (`DialogCell` in selection mode). */
  isSelected?: boolean
  /** Color of the ring around the online dot and the check: the row's background. */
  ringColor?: string
}

export function DialogAvatar ({ id, title, uri, size, kind, isOnline, isSelected, ringColor }: DialogAvatarProps) {
  const colors = useChatListColors()
  const radius = size / 2
  // `abs(id % 7)` over seven colors, as the library picks avatar colors inside
  // the chat, so a person's color matches between the list and their messages.
  const index = getUserColorIndex(id, colors.avatarPalette.length)
  const ring = ringColor ?? colors.background

  return (
    <View style={{ width: size, height: size }}>
      {kind === 'archive'
        ? (
          // Not collapsable: flattened into the row, the icon glyph was drawn under the circle.
          <View style={[styles.center, { width: size, height: size, borderRadius: radius, backgroundColor: colors.archiveAvatar }]} collapsable={false}>
            <MaterialCommunityIcons name='archive-outline' size={Math.round(size * 0.46)} color='#FFFFFF' />
          </View>
        )
        : uri
          ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius, backgroundColor: colors.avatarPaletteEnd[index] }} />
          : (
            <View
              style={[
                styles.center,
                { width: size, height: size, borderRadius: radius },
                gradient(colors.avatarPalette[index], colors.avatarPaletteEnd[index]),
              ]}
            >
              {/* `AvatarDrawable`: 18dp bold for a 52dp avatar, scaled with the size. */}
              <Text style={[styles.initials, { fontSize: Math.round(size * 0.35) }]}>{getInitials(title)}</Text>
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
          <MaterialCommunityIcons name='check-bold' size={13} color='#FFFFFF' />
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
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Centre at (avatar right - 6, bottom - 8) with a 7dp ring: a 14dp circle, offset -1 / 1.
  online: {
    position: 'absolute',
    end: -1,
    bottom: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  // `DialogCell`'s checkbox sits on the avatar's bottom-right corner: 24dp with a 2dp ring.
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
})
