import React, { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import {
  MEDIA_BUTTON_SIZE,
  MEDIA_LOADER_BACKGROUND,
  MEDIA_LOADER_ICON,
  MediaInfoPill,
  transferLabel,
} from '../components/MediaLoader'
import { transferState, useCanTransfer, useMediaTransfer } from '../components/mediaTransfer'
import { RadialProgress } from '../components/RadialProgress'
import { IMessage } from '../Models'
import { styles } from './styles'

export interface VideoTransferOverlayProps {
  message: IMessage
  accessibilityLabel?: string
}

/**
 * A video's media button while it uploads or waits to download (`transfer`,
 * `isDownloadRequired`): a 48 ring over the frame and the size pill. A tap on the
 * video is then the button's.
 */
export const VideoTransferOverlay = ({ message, accessibilityLabel }: VideoTransferOverlayProps) => {
  const mediaTransfer = useMediaTransfer()
  const state = transferState(message)
  const canPress = useCanTransfer(state?.icon)
  const [hasShown, setHasShown] = useState(!!state)
  if (state && !hasShown)
    setHasShown(true)
  if (!hasShown)
    return null

  const defaultLabel = state?.icon === 'cancel'
    ? message.transfer?.type === 'upload' ? 'cancel upload' : 'cancel download'
    : 'download video'
  const label = message.transfer ? transferLabel(state?.progress ?? 0, message.transfer.totalBytes) : null
  return (
    <Pressable
      style={[StyleSheet.absoluteFill, styles.videoOverlay]}
      pointerEvents={canPress ? 'auto' : 'none'}
      disabled={!canPress}
      accessible={canPress}
      accessibilityElementsHidden={!canPress}
      importantForAccessibility={canPress ? 'yes' : 'no-hide-descendants'}
      accessibilityRole={canPress ? 'button' : undefined}
      accessibilityLabel={canPress ? accessibilityLabel ?? defaultLabel : undefined}
      onPress={() => {
        if (message.transfer)
          mediaTransfer.onCancel(message)
        else if (message.isDownloadRequired)
          mediaTransfer.onDownload(message)
      }}
    >
      <RadialProgress
        icon={state?.icon ?? 'none'}
        progress={state?.progress ?? 0}
        size={MEDIA_BUTTON_SIZE}
        color={MEDIA_LOADER_ICON}
        backgroundColor={MEDIA_LOADER_BACKGROUND}
      />
      {label != null && <View style={styles.videoPill}><MediaInfoPill label={label} /></View>}
    </Pressable>
  )
}
