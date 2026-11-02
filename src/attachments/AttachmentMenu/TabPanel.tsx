import React from 'react'
import { Pressable, Text, View } from 'react-native'

import { Icon } from '../../components/Icon'
import { PinIcon } from '../../components/MediaControls'
import { Spinner } from '../../components/Spinner'
import { useIsRTL } from '../../hooks/useIsRTL'
import { useLabels } from '../../hooks/useLabels'
import { useTheme, useThemedStyles } from '../../hooks/useTheme'
import { formatLabel } from '../../i18n'
import { hasImagePicker } from '../../optional'
import { CurrentLocation, pickFromSystemGallery } from '../buildMessages'
import { GalleryStatus } from '../gallery'
import { AttachmentTab, PickedAttachment } from '../types'
import { createStyles } from './styles'

/**
 * What the sheet shows when there is no grid: the location row, or the gallery's fallback (a
 * message and a button for the system picker).
 */
export function TabPanel ({ activeTab, location, onSendLocation, hasGrid, galleryStatus, runPicker }: {
  activeTab: AttachmentTab
  location: CurrentLocation | 'locating' | null
  onSendLocation: () => void
  hasGrid: boolean
  galleryStatus: GalleryStatus
  runPicker: (picker: () => Promise<PickedAttachment[]>) => void
}) {
  const styles = useThemedStyles(createStyles)
  const theme = useTheme()
  const labels = useLabels()
  const isRTL = useIsRTL()

  if (activeTab === 'location') {
    const subtitle = location === 'locating' || location == null
      ? labels.attachLocating
      : location.status === 'located'
        ? (location.accuracy ? formatLabel(labels.attachLocationAccuracy, { meters: Math.round(location.accuracy) }) : '')
        : location.status === 'denied' ? labels.attachLocationDenied : ''
    return (
      <Pressable onPress={onSendLocation} style={[styles.locationRow, isRTL && styles.rowReverse]} accessibilityRole='button' accessibilityLabel={labels.attachSendLocation}>
        <View style={styles.locationIcon}>
          <Icon name='location' color='#FFFFFF' size={24} fallback={<PinIcon color='#FFFFFF' size={24} />} />
        </View>
        <View style={styles.locationText}>
          <Text style={[styles.locationTitle, isRTL && styles.textRTL]} numberOfLines={1}>{labels.attachSendLocation}</Text>
          {!!subtitle && <Text style={[styles.locationSubtitle, isRTL && styles.textRTL]} numberOfLines={2}>{subtitle}</Text>}
        </View>
        {/* No spinner: "Locating…" under the title is the whole fetching state. */}
      </Pressable>
    )
  }

  // The gallery without a grid to show: no library peer, no access, or no photos.
  const message = !hasGrid
    ? null
    : galleryStatus === 'denied'
      ? labels.attachPhotosAccess
      : galleryStatus === 'ready' ? labels.attachNoPhotos : null
  return (
    <View style={styles.galleryPanel}>
      {!!message && <Text style={styles.panelText}>{message}</Text>}
      {hasImagePicker() && (
        <Pressable onPress={() => runPicker(pickFromSystemGallery)} style={styles.panelButton} accessibilityRole='button'>
          <Text style={styles.panelButtonText}>{labels.attachChooseFromGallery}</Text>
        </Pressable>
      )}
      {/* A 40 spinner in the accent color while the gallery loads. */}
      {galleryStatus === 'loading' && <Spinner size={40} color={theme.colors.accent} />}
    </View>
  )
}
