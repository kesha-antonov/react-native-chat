import React, { ReactNode, useContext, useMemo } from 'react'
import { ColorSchemeName, Pressable, StyleProp, StyleSheet, Text, useColorScheme, View, ViewStyle } from 'react-native'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'

import { ChatContext, IChatContext } from './ChatContext'
import { ChatListAvatar } from './ChatList/ChatListAvatar'
import { Icon } from './components/Icon'
import { TypingAction, TypingStatus } from './components/TypingStatus'
import { normalizeColorScheme } from './hooks/useColorScheme'
import { ChatLabels, resolveLabels } from './i18n'
import { ChatIcons } from './Icons'
import { User } from './Models'
import { isRTLLocale } from './rtl'
import { PartialChatTheme, resolveTheme } from './Theme'

const HEADER_HEIGHT = 56
const AVATAR_SIZE = 42

export interface ChatHeaderProps {
  /** The chat's name, on one line. */
  title: string
  /** The line under the name: "online", "last seen recently", "3 members"... */
  subtitle?: string
  /** Draws the subtitle in the accent color, as for "online". */
  isSubtitleActive?: boolean
  /** Shown in place of the subtitle while someone types: "typing", "Anna is typing"... */
  typingUsers?: User[]
  typingAction?: TypingAction
  /** Names the people typing, as a group does. */
  isGroup?: boolean
  /** The avatar: a photo, or initials on the chat's color picked by `id`. Hidden without it. */
  avatar?: { id: string | number, uri?: string }
  /** Shows the back arrow. */
  onBack?: () => void
  /** Makes the avatar and the name a button, e.g. to open the profile. */
  onPressTitle?: () => void
  /** Buttons at the end of the bar: a call, a menu. */
  renderRight?: () => ReactNode
  /** Replaces the name and the subtitle, e.g. with a search field. */
  renderTitle?: () => ReactNode
  /** Pads the bar by the top safe-area inset. Default true; turn off when it sits below the status bar already. */
  isTopInsetApplied?: boolean
  style?: StyleProp<ViewStyle>
  theme?: PartialChatTheme
  darkTheme?: PartialChatTheme
  colorScheme?: ColorSchemeName
  locale?: string
  labels?: Partial<ChatLabels>
  icons?: ChatIcons
}

/**
 * A chat screen's top bar, as a messenger draws it: back arrow, a 42 avatar, the name in 18 medium
 * with a 14 status line under it ("online" and "typing" in the accent color), and buttons at the
 * end. Colors come from `theme.chatList` (`headerBackground`, `headerText`, `headerSubtitle`,
 * `headerSubtitleActive`), so it matches `ChatList`'s header.
 */
export function ChatHeader (props: ChatHeaderProps) {
  const { theme, darkTheme, colorScheme: colorSchemeProp, locale, labels, icons } = props
  const systemColorScheme = useColorScheme()
  const colorScheme = normalizeColorScheme(colorSchemeProp !== undefined ? colorSchemeProp : systemColorScheme)
  const resolvedTheme = useMemo(() => resolveTheme(colorScheme, theme, darkTheme), [colorScheme, theme, darkTheme])
  const resolvedLabels = useMemo(() => resolveLabels(locale, labels), [locale, labels])
  const isRTL = useMemo(() => isRTLLocale(locale), [locale])
  const context = useMemo<IChatContext>(() => ({
    actionSheet: () => ({ showActionSheetWithOptions: () => {} }),
    getLocale: () => locale ?? 'en',
    getIsRTL: () => isRTL,
    getColorScheme: () => colorScheme,
    getTheme: () => resolvedTheme,
    getIcons: () => icons,
    getLabels: () => resolvedLabels,
  }), [locale, isRTL, colorScheme, resolvedTheme, icons, resolvedLabels])

  return (
    <ChatContext.Provider value={context}>
      <ChatHeaderContent {...props} />
    </ChatContext.Provider>
  )
}

function ChatHeaderContent ({
  title,
  subtitle,
  isSubtitleActive = false,
  typingUsers,
  typingAction,
  isGroup = false,
  avatar,
  onBack,
  onPressTitle,
  renderRight,
  renderTitle,
  isTopInsetApplied = true,
  style,
}: ChatHeaderProps) {
  const { getTheme, getLabels } = useContext(ChatContext)
  const colors = getTheme!()!.chatList
  const labels = getLabels!()!
  const insets = useContext(SafeAreaInsetsContext)
  const topInset = isTopInsetApplied ? insets?.top ?? 0 : 0
  const isTyping = !!typingUsers?.length

  const renderText = () => (
    <View style={styles.text}>
      <Text style={[styles.title, { color: colors.headerText }]} numberOfLines={1}>{title}</Text>
      {isTyping
        ? <TypingStatus users={typingUsers!} action={typingAction} isGroup={isGroup} color={colors.headerSubtitleActive} textStyle={styles.subtitle} />
        : !!subtitle && (
          <Text
            style={[styles.subtitle, { color: isSubtitleActive ? colors.headerSubtitleActive : colors.headerSubtitle }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
    </View>
  )

  return (
    <View style={[styles.header, { paddingTop: topInset, backgroundColor: colors.headerBackground }, style]}>
      <View style={styles.bar}>
        {onBack
          ? (
            <Pressable onPress={onBack} hitSlop={4} style={styles.button} accessibilityRole='button' accessibilityLabel={labels.chatListBack}>
              <Icon name='arrowLeft' size={24} color={colors.headerText} fallback={<Text style={{ color: colors.headerText }}>{'<'}</Text>} />
            </Pressable>
          )
          : <View style={styles.edge} />}
        {renderTitle
          ? <View style={styles.titleArea}>{renderTitle()}</View>
          : (
            <Pressable
              onPress={onPressTitle}
              disabled={!onPressTitle}
              style={styles.titleArea}
              accessibilityRole={onPressTitle ? 'button' : undefined}
            >
              {!!avatar && (
                <View style={styles.avatar}>
                  <ChatListAvatar id={avatar.id} title={title} uri={avatar.uri} size={AVATAR_SIZE} ringColor={colors.headerBackground} />
                </View>
              )}
              {renderText()}
            </Pressable>
          )}
        {renderRight?.()}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    zIndex: 1,
    boxShadow: '0 0.5px 0 rgba(0, 0, 0, 0.12)',
  },
  bar: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  button: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  edge: {
    width: 10,
  },
  titleArea: {
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    marginStart: 4,
  },
  // The text starts 55 after the avatar's left edge: 42 + 13.
  text: {
    flex: 1,
    marginStart: 13,
    justifyContent: 'center',
  },
  title: {
    flexShrink: 1,
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 1,
    textAlign: 'left',
  },
})
