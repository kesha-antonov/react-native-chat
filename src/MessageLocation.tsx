import React, { useCallback } from 'react'
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Icon } from './components/Icon'
import { PinIcon } from './components/MediaControls'
import { useLabels } from './hooks/useLabels'
import { useThemedStyles } from './hooks/useTheme'
import { IMessage, MessageLocationProps } from './Models'
import { ChatTheme } from './Theme'

const buildMapsUrl = (latitude: number, longitude: number) =>
  Platform.select({
    ios: `https://maps.apple.com/?ll=${latitude},${longitude}&q=${latitude},${longitude}`,
    android: `geo:${latitude},${longitude}?q=${latitude},${longitude}`,
    default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
  }) as string

/**
 * Default renderer for location messages. Dependency-free: shows a styled map
 * card and opens the coordinates in the system maps app on tap (override via
 * the `onPress` prop or `renderMessageLocation`).
 */
export function MessageLocation<TMessage extends IMessage = IMessage> ({
  currentMessage,
  position = 'left',
  containerStyle,
  locationStyle,
  onPress,
}: Partial<MessageLocationProps<TMessage>>) {
  const styles = useThemedStyles(position === 'right' ? createRightStyles : createLeftStyles)
  const labels = useLabels()

  const location = currentMessage?.location

  const handlePress = useCallback(() => {
    if (!location)
      return

    if (onPress) {
      onPress(location)
      return
    }

    Linking.openURL(buildMapsUrl(location.latitude, location.longitude)).catch(() => {})
  }, [location, onPress])

  if (!location)
    return null

  const coords = `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`

  return (
    <View style={[styles.container, containerStyle]}>
      <Pressable
        onPress={handlePress}
        accessibilityRole='button'
        accessibilityLabel={labels.openLocationAccessibility}
        style={[styles.card, locationStyle]}
      >
        <View style={styles.map}>
          <Icon name='pin' color='#fff' size={26} fallback={<PinIcon color='#fff' size={26} />} />
        </View>
        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={1}>{labels.location}</Text>
          <Text style={styles.coords} numberOfLines={1}>{coords}</Text>
        </View>
      </Pressable>
    </View>
  )
}

const makeStyles = (theme: ChatTheme, position: 'left' | 'right') => {
  const overlay = position === 'right' ? theme.colors.outgoingOverlay : theme.colors.reactionBackground
  const titleColor = position === 'right' ? theme.colors.outgoingText : theme.colors.incomingText
  const metaColor = position === 'right' ? theme.colors.outgoingMeta : theme.colors.incomingMeta

  return StyleSheet.create({
    container: {
      overflow: 'hidden',
    },
    card: {
      width: 220,
      borderRadius: 12,
      overflow: 'hidden',
      margin: 6,
      backgroundColor: overlay,
    },
    map: {
      height: 110,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.accent,
      opacity: 0.85,
    },
    meta: {
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    title: {
      fontSize: 14,
      fontWeight: '600',
      color: titleColor,
    },
    coords: {
      marginTop: 2,
      fontSize: 12,
      color: metaColor,
    },
  })
}

const createLeftStyles = (theme: ChatTheme) => makeStyles(theme, 'left')
const createRightStyles = (theme: ChatTheme) => makeStyles(theme, 'right')
