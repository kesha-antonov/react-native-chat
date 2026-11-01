import React, { useCallback, useMemo } from 'react'
import {
  Image,
  View,
  StyleSheet,
  StyleProp,
  ImageStyle,
  TextStyle,
  Text } from 'react-native'
import { Color } from './Color'
import { linearGradientStyle } from './components/BubbleBackground'
import { TouchableOpacity } from './components/TouchableOpacity'
import { useTheme, useThemedStyles } from './hooks/useTheme'
import { User } from './Models'
import stylesCommon from './styles'
import { ChatTheme, getUserColorIndex } from './Theme'

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  avatarStyle: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarTransparent: {
    backgroundColor: Color.backgroundTransparent,
  },
  // Initials: 18 Medium for a 42 avatar, scaled with the size.
  textStyle: {
    color: theme.avatar.textColor,
    fontSize: Math.round(theme.avatar.size * 0.43),
    backgroundColor: Color.backgroundTransparent,
    fontWeight: '500',
  },
})

export interface ChatAvatarProps {
  user?: User
  avatarStyle?: StyleProp<ImageStyle>
  textStyle?: StyleProp<TextStyle>
  onPress?: (props: ChatAvatarProps) => void
  onLongPress?: (props: ChatAvatarProps) => void
}

export function ChatAvatar (
  props: ChatAvatarProps
) {
  const {
    user,
    avatarStyle,
    textStyle,
    onPress,
  } = props

  const theme = useTheme()
  const styles = useThemedStyles(createStyles)

  const avatarName = useMemo(() => {
    const userName = user?.name || ''
    const name = userName.toUpperCase().split(' ')

    if (name.length === 1)
      return `${name[0].charAt(0)}`
    else if (name.length > 1)
      return `${name[0].charAt(0)}${name[1].charAt(0)}`
    else
      return ''
  }, [user?.name])

  // The color is picked by user id (`abs(id % 7)`) and drawn as a vertical gradient;
  // `theme.avatar.paletteEnd` empty draws it flat.
  const fillStyle = useMemo(() => {
    const { palette, paletteEnd } = theme.avatar
    if (!palette.length)
      return undefined

    const index = getUserColorIndex(user?._id ?? user?.name, palette.length)
    const top = palette[index]
    const bottom = paletteEnd[index]
    return bottom
      ? [{ backgroundColor: bottom }, linearGradientStyle([top, bottom])]
      : { backgroundColor: top }
  }, [user?._id, user?.name, theme])

  const renderAvatar = useCallback(() => {
    switch (typeof user?.avatar) {
      case 'function':
        return user.avatar([stylesCommon.centerItems, styles.avatarStyle, avatarStyle])
      case 'string':
        return (
          <Image
            source={{ uri: user.avatar }}
            style={[stylesCommon.centerItems, styles.avatarStyle, avatarStyle]}
          />
        )
      case 'number':
        return (
          <Image
            source={user.avatar}
            style={[stylesCommon.centerItems, styles.avatarStyle, avatarStyle]}
          />
        )
      default:
        return null
    }
  }, [user, avatarStyle, styles])

  const renderInitials = useCallback(() => {
    return (
      <Text style={[styles.textStyle, textStyle]}>
        {avatarName}
      </Text>
    )
  }, [textStyle, avatarName, styles])

  const handleOnPress = useCallback(() => {
    const {
      onPress,
      ...rest
    } = props

    onPress?.(rest)
  }, [props])

  const handleOnLongPress = useCallback(() => {
    const {
      onLongPress,
      ...rest
    } = props

    if (onLongPress)
      onLongPress(rest)
  }, [props])

  const placeholderView = useMemo(() => (
    <View
      style={[
        stylesCommon.centerItems,
        styles.avatarStyle,
        styles.avatarTransparent,
        avatarStyle,
      ]}
      accessibilityRole='image'
    />
  ), [avatarStyle, styles])

  if (!user || (!user.name && !user.avatar))
    return placeholderView

  if (user.avatar)
    return (
      <TouchableOpacity
        enabled={!!onPress}
        onPress={handleOnPress}
        onLongPress={handleOnLongPress}
        accessibilityRole='image'
      >
        {renderAvatar()}
      </TouchableOpacity>
    )

  return (
    <TouchableOpacity
      enabled={!!onPress}
      onPress={handleOnPress}
      onLongPress={handleOnLongPress}
      style={[
        stylesCommon.centerItems,
        styles.avatarStyle,
        fillStyle,
        avatarStyle,
      ]}
      accessibilityRole='image'
    >
      {renderInitials()}
    </TouchableOpacity>
  )
}
