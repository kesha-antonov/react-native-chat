import React from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  View,
  StyleProp,
  ViewStyle,
  TextStyle,
  Text } from 'react-native'
import { Color } from './Color'
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
  activityIndicatorColor?: string
  activityIndicatorSize?: number | 'small' | 'large'
}

export const LoadEarlierMessages: React.FC<LoadEarlierMessagesProps> = ({
  isLoading = false,
  onPress,
  label,
  containerStyle,
  wrapperStyle,
  textStyle,
  activityIndicatorColor = 'white',
  activityIndicatorSize = 'small',
  activityIndicatorStyle,
}) => {
  const styles = useThemedStyles(createStyles)
  const labels = useLabels()
  const resolvedLabel = label ?? labels.loadEarlier

  return (
    <TouchableOpacity
      style={[styles.container, containerStyle]}
      onPress={onPress}
      enabled={!isLoading}
      accessibilityRole='button'
    >
      <View style={[stylesCommon.centerItems, styles.wrapper, wrapperStyle]}>
        {
          isLoading
            ? (
              <ActivityIndicator
                color={activityIndicatorColor}
                size={activityIndicatorSize}
                style={[styles.activityIndicator, activityIndicatorStyle]}
              />
            )
            : (
              <View style={styles.textContainer}>
                <Text style={[styles.text, textStyle]}>
                  {resolvedLabel}
                </Text>
              </View>
            )
        }
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
  activityIndicator: {
    paddingHorizontal: 20,
  },
})
