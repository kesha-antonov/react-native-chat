import React from 'react'
import {
  StyleSheet,
  View,
  StyleProp,
  ViewStyle,
  TextStyle,
  Text } from 'react-native'
import { Color } from './Color'
import { ServiceSpinner } from './components/ServiceSpinner'
import { TouchableOpacity } from './components/TouchableOpacity'
import { useLabels } from './hooks/useLabels'
import { useThemedStyles } from './hooks/useTheme'
import stylesCommon from './styles'
import { ChatTheme } from './Theme'

export interface LoadEarlierMessagesProps {
  isAvailable: boolean
  isLoading: boolean
  onPress: () => void
  isInfiniteScrollEnabled?: boolean
  label?: string
  containerStyle?: StyleProp<ViewStyle>
  wrapperStyle?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  activityIndicatorStyle?: StyleProp<ViewStyle>
  /** Color of the spinner's arc; defaults to the date pill's text color. */
  activityIndicatorColor?: string
  /** @deprecated The spinner is Telegram's 28-wide arc in a 36 circle; this is ignored. */
  activityIndicatorSize?: number | 'small' | 'large'
}

/** Telegram's loading row is 44 tall around the 36 circle (`ChatLoadingCell.onMeasure`). */
const LOADING_ROW_HEIGHT = 44

export const LoadEarlierMessages: React.FC<LoadEarlierMessagesProps> = ({
  isLoading = false,
  isInfiniteScrollEnabled = false,
  onPress,
  label,
  containerStyle,
  wrapperStyle,
  textStyle,
  activityIndicatorColor,
  activityIndicatorStyle,
}) => {
  const styles = useThemedStyles(createStyles)
  const labels = useLabels()
  const resolvedLabel = label ?? labels.loadEarlier

  // Telegram has no button: while more history exists the list ends in its loading cell, a
  // spinner in a service circle, and reaching it loads the next page (`ChatActivity`'s
  // `loadingUpRow`). The labelled button stays for chats that load on tap.
  if (isLoading || isInfiniteScrollEnabled)
    return (
      <View style={[styles.loadingRow, containerStyle]}>
        <ServiceSpinner
          color={activityIndicatorColor}
          style={[wrapperStyle, activityIndicatorStyle]}
        />
      </View>
    )

  return (
    <TouchableOpacity
      style={[styles.container, containerStyle]}
      onPress={onPress}
      accessibilityRole='button'
    >
      <View style={[stylesCommon.centerItems, styles.wrapper, wrapperStyle]}>
        <View style={styles.textContainer}>
          <Text style={[styles.text, textStyle]}>
            {resolvedLabel}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 10,
  },
  wrapper: {
    backgroundColor: theme.colors.dayPillBackground,
    borderRadius: theme.radii.dayPill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  textContainer: {
    paddingTop: 3,
    paddingBottom: 4,
  },
  text: {
    backgroundColor: Color.backgroundTransparent,
    color: theme.colors.dayPillText,
    fontSize: 12,
    lineHeight: 13,
  },
  loadingRow: {
    height: LOADING_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
