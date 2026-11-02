import React, { useEffect, useMemo } from 'react'
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { useIsRTL } from '../hooks/useIsRTL'
import { useThemedStyles } from '../hooks/useTheme'
import {
  ATTACH_HIDE,
  CONTROLS_MS,
  ReturnAnimations,
  attachOut,
  attachOutRTL,
  emojiOut,
  textOut,
  textOutRTL,
} from './animations'
import { createStyles } from './styles'

/** The paperclip steps aside while there is text. */
export function useAttachStyle (hasText: boolean) {
  const attachShown = useSharedValue(hasText ? 0 : 1)
  useEffect(() => {
    attachShown.value = withTiming(hasText ? 0 : 1, ATTACH_HIDE)
  }, [hasText, attachShown])
  return useAnimatedStyle(() => ({
    opacity: attachShown.value,
    transform: [{ scale: 0.5 + 0.5 * attachShown.value }],
  }))
}

interface FieldGroupProps {
  emojiFragment: React.ReactNode
  composerFragment: React.ReactNode
  actionsFragment: React.ReactNode
  videoFragment: React.ReactNode
  /** The paperclip's step aside while there is text. */
  attachStyle: ReturnType<typeof useAttachStyle>
  hasText: boolean
  /** A take has been recorded since mount, so the field fades back in. */
  hasHadTake: boolean
  /** A take can take the field away, so its parts animate out. */
  canTakeAway: boolean
  /** How the parts come back after a take; null on first mount. */
  returning: ReturnAnimations | null
}

/** The field inside the island: [emoji 44] [text] [attach 44], and the inset camera. */
export function FieldGroup ({
  emojiFragment,
  composerFragment,
  actionsFragment,
  videoFragment,
  attachStyle,
  hasText,
  hasHadTake,
  canTakeAway,
  returning,
}: FieldGroupProps) {
  const styles = useThemedStyles(createStyles)
  const isRTL = useIsRTL()

  const fieldGroupStyles = useMemo(() => [
    styles.fieldGroup,
    isRTL && styles.rowReverse,
  ], [styles, isRTL])

  return (
    <Animated.View
      style={fieldGroupStyles}
      // The pill itself only fades; its parts move on their own.
      entering={hasHadTake ? FadeIn.duration(CONTROLS_MS) : undefined}
      exiting={canTakeAway ? FadeOut.duration(CONTROLS_MS) : undefined}
    >
      {emojiFragment && (
        <Animated.View entering={returning?.emoji} exiting={canTakeAway ? emojiOut : undefined}>
          {emojiFragment}
        </Animated.View>
      )}
      <Animated.View
        style={[
          styles.composerSlot,
          !emojiFragment && (isRTL ? styles.composerSlotEndInset : styles.composerSlotStartInset),
          !actionsFragment && !videoFragment && (isRTL ? styles.composerSlotStartInset : styles.composerSlotEndInset),
        ]}
        entering={returning?.text}
        exiting={canTakeAway ? (isRTL ? textOutRTL : textOut) : undefined}
      >
        {composerFragment}
      </Animated.View>
      {actionsFragment && (
        <Animated.View entering={returning?.attach} exiting={canTakeAway ? (isRTL ? attachOutRTL : attachOut) : undefined}>
          <Animated.View style={attachStyle} pointerEvents={hasText ? 'none' : 'auto'}>
            {actionsFragment}
          </Animated.View>
        </Animated.View>
      )}
      {videoFragment}
    </Animated.View>
  )
}
