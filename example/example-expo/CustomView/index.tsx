import React, { useCallback } from 'react'
import { Platform, View, Text } from 'react-native'
import * as Linking from 'expo-linking'
import { RectButton } from 'react-native-gesture-handler'
import styles from './styles'
import type { CustomViewProps } from './types'

const CustomView = ({
  currentMessage,
  containerStyle,
  mapViewStyle,
}: CustomViewProps) => {
  const openMapAsync = useCallback(async () => {
    if (Platform.OS === 'web') {
      alert('Opening the map is not supported.')
      return
    }

    const { location } = currentMessage

    if (location == null)
      return

    const url = Platform.select({
      ios: `http://maps.apple.com/?ll=${location.latitude},${location.longitude}`,
      default: `http://maps.google.com/?q=${location.latitude},${location.longitude}`,
    })

    try {
      const supported = await Linking.canOpenURL(url)
      if (supported)
        return Linking.openURL(url)

      alert('Opening the map is not supported.')
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    }
  }, [currentMessage])

  if (currentMessage.location) {
    const { latitude, longitude } = currentMessage.location

    // Dependency-free location card (no native map dependency). Tap to open the
    // coordinates in the system Maps app.
    return (
      <RectButton
        style={containerStyle}
        onPress={openMapAsync}
      >
        <View style={[styles.mapView, mapViewStyle]}>
          <Text style={styles.pin}>📍</Text>
          <Text style={styles.coords}>
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </Text>
          <Text style={styles.hint}>Tap to open in Maps</Text>
        </View>
      </RectButton>
    )
  }

  return null
}

export default CustomView
