import React, { useCallback } from 'react'
import { Linking, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native'

import { useLabels } from '../hooks/useLabels'
import { useThemedStyles } from '../hooks/useTheme'
import { ChatTheme } from '../Theme'
import { Icon } from './Icon'
import { PlayIcon } from './MediaControls'

export interface MediaCardProps {
  kind: 'video' | 'audio'
  /** Media URL; opened with Linking when pressed (unless onPress is provided). */
  uri?: string
  position?: 'left' | 'right'
  label?: string
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

/**
 * Lightweight, dependency-free media placeholder used when the optional
 * expo-video / expo-audio players are not installed. It is a real, usable
 * default: tapping plays the media in the system player via Linking (or fires
 * the supplied onPress).
 */
export const MediaCard = ({ kind, uri, position = 'left', label, onPress, style }: MediaCardProps) => {
  const styles = useThemedStyles(position === 'right' ? createRightStyles : createLeftStyles)
  const labels = useLabels()

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress()
      return
    }

    if (uri)
      Linking.openURL(uri).catch(() => {})
  }, [onPress, uri])

  const defaultLabel = kind === 'video' ? labels.video : labels.voiceMessage

  if (kind === 'video')
    return (
      <Pressable
        onPress={handlePress}
        accessibilityRole='button'
        accessibilityLabel={label ?? defaultLabel}
        style={[styles.videoCard, style]}
      >
        <View style={styles.playCircleLarge}>
          <Icon name='play' color='#fff' size={20} fallback={<PlayIcon color='#fff' size={20} />} />
        </View>
        <Text style={styles.videoLabel} numberOfLines={1}>{label ?? defaultLabel}</Text>
      </Pressable>
    )

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole='button'
      accessibilityLabel={label ?? defaultLabel}
      style={[styles.audioRow, style]}
    >
      <View style={styles.playCircle}>
        <Icon name='play' color='#fff' size={14} fallback={<PlayIcon color='#fff' size={14} />} />
      </View>
      <View style={styles.audioTrack} />
      <Text style={styles.audioLabel} numberOfLines={1}>{label ?? defaultLabel}</Text>
    </Pressable>
  )
}

const makeStyles = (theme: ChatTheme, position: 'left' | 'right') => {
  const overlay = position === 'right' ? theme.colors.outgoingOverlay : theme.colors.reactionBackground
  const textColor = position === 'right' ? theme.colors.outgoingText : theme.colors.incomingText

  return StyleSheet.create({
    videoCard: {
      width: 220,
      height: 140,
      borderRadius: 12,
      backgroundColor: overlay,
      alignItems: 'center',
      justifyContent: 'center',
      margin: 6,
    },
    videoLabel: {
      marginTop: 8,
      fontSize: 13,
      color: textColor,
    },
    playCircleLarge: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    audioRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 8,
      minWidth: 180,
      gap: 10,
    },
    playCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    audioTrack: {
      flex: 1,
      height: 3,
      borderRadius: 2,
      backgroundColor: overlay,
    },
    audioLabel: {
      fontSize: 12,
      color: textColor,
    },
  })
}

const createLeftStyles = (theme: ChatTheme) => makeStyles(theme, 'left')
const createRightStyles = (theme: ChatTheme) => makeStyles(theme, 'right')
