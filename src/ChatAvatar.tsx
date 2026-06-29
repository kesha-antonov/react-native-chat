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
import { TouchableOpacity } from './components/TouchableOpacity'
import { useTheme, useThemedStyles } from './hooks/useTheme'
import { User } from './Models'
import stylesCommon from './styles'
import { ChatTheme } from './Theme'

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  avatarStyle: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarTransparent: {
    backgroundColor: Color.backgroundTransparent,
  },
  textStyle: {
    color: theme.avatar.textColor,
    fontSize: 16,
    backgroundColor: Color.backgroundTransparent,
    fontWeight: '100',
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

  const backgroundColor = useMemo(() => {
    let sumChars = 0
    if (user?.name)
      for (let i = 0; i < user.name.length; i += 1)
        sumChars += user.name.charCodeAt(i)

    // inspired by https://github.com/wbinnssmith/react-user-avatar
    // palette is themeable via theme.avatar.palette
    const colors = theme.avatar.palette

    return colors[sumChars % colors.length]
  }, [user?.name, theme])

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
        { backgroundColor },
        avatarStyle,
      ]}
      accessibilityRole='image'
    >
      {renderInitials()}
    </TouchableOpacity>
  )
}
