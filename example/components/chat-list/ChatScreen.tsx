import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Chat, defaultDarkTheme, defaultLightTheme, IMessage, TypingAction, TypingStatus, User } from '@kesha-antonov/react-native-chat'
import { ChatListAvatar } from '@kesha-antonov/react-native-chat'
import { useFocusEffect, useRouter } from 'expo-router'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useColorScheme } from '@/hooks/use-color-scheme'
import { Dialog, ME } from './data'
import { formatSubscribers } from './format'
import { chatStore, useDialog, useMessages, useTyping, useTypingAction } from './store'
import { useChatListColors } from './theme'

/**
 * One conversation from the Chats tab: a bare `<Chat>` fed from the demo store. Besides
 * `messages`, `onSend` and `user` it only passes what changes state the app owns (reactions,
 * edit, delete). Who is typing shows in the header, as a messenger does, not as a bubble in the list.
 */
export default function ChatScreen ({ id }: { id: string }) {
  const dialog = useDialog(id)
  const messages = useMessages(id)
  const typingUser = useTyping(id)
  const typingAction = useTypingAction(id)
  const background = (useColorScheme() === 'dark' ? defaultDarkTheme : defaultLightTheme).colors.background

  // Opening the chat reads it, so the unread count is taken once, before that: the
  // "Unread Messages" bar stays where it was until you leave the chat.
  const [firstUnreadMessageId] = useState(() => {
    const unread = Math.min(dialog?.unreadCount ?? 0, messages.length)
    return unread > 0 ? messages[unread - 1]._id : undefined
  })

  // The draft goes into the composer when the chat opens, and is saved when you leave (the list
  // shows it as "Draft:"). `onDraftChange` reports only the draft: editing a message sets it
  // aside, and sending clears it.
  const [initialDraft] = useState(() => dialog?.draft ?? '')
  const draftRef = useRef(initialDraft)
  const onDraftChange = useCallback((draft: string) => {
    draftRef.current = draft
  }, [])

  // Opening a chat reads it; while it is on screen, incoming messages do not count as unread.
  useFocusEffect(useCallback(() => {
    chatStore.open(id)
    return () => {
      chatStore.close(id)
      chatStore.setDraft(id, draftRef.current)
    }
  }, [id]))

  const onSend = useCallback((newMessages: IMessage[]) => chatStore.send(id, newMessages), [id])
  const reactions = useMemo(() => ({
    onReactionPress: (message: IMessage, emoji: string) => chatStore.toggleReaction(id, message, emoji),
  }), [id])
  const onEditMessage = useCallback((message: IMessage, text: string) => chatStore.editMessage(id, message, text), [id])
  const onDeleteMessage = useCallback((message: IMessage) => chatStore.deleteMessage(id, message), [id])
  const mediaTransfer = useMemo(() => ({
    onCancel: (message: IMessage) => chatStore.cancelUpload(id, message),
  }), [id])

  if (!dialog)
    return null

  return (
    // The chat's own background, so the screen is never black while the chat mounts.
    <View style={[styles.container, { backgroundColor: background }]}>
      <ChatHeader dialog={dialog} typingUser={typingUser} typingAction={typingAction} />
      <Chat
        messages={messages}
        onSend={onSend}
        mediaTransfer={mediaTransfer}
        user={ME}
        initialText={initialDraft}
        onDraftChange={onDraftChange}
        isGroupChat={dialog.kind === 'group'}
        reactions={reactions}
        onEditMessage={onEditMessage}
        onDeleteMessage={onDeleteMessage}
        firstUnreadMessageId={firstUnreadMessageId}
        // Only admins post in a channel; everyone else gets a mute button.
        renderInputToolbar={dialog.kind === 'channel' ? () => <ChannelBar dialog={dialog} /> : undefined}
      />
    </View>
  )
}

/**
 * The chat header: back arrow, a 42dp avatar 8dp after it,
 * the name in 18dp Medium and a 14dp status line - "typing…" and "online" in the accent color.
 */
function ChatHeader ({ dialog, typingUser, typingAction }: { dialog: Dialog, typingUser?: User, typingAction?: TypingAction }) {
  const colors = useChatListColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const isActive = !!typingUser || !!dialog.isOnline
  const subtitle = dialog.kind === 'group'
    ? `${(dialog.members?.length ?? 0) + 1} members`
    : dialog.kind === 'channel'
      ? formatSubscribers(dialog.subscribers ?? 0)
      : dialog.isOnline ? 'online' : dialog.lastSeen ?? 'last seen recently'

  const openMenu = () => {
    Alert.alert(dialog.title, undefined, [
      { text: dialog.isMuted ? 'Unmute' : 'Mute', onPress: () => chatStore.toggleMute(dialog.id) },
      { text: dialog.isPinned ? 'Unpin' : 'Pin', onPress: () => chatStore.togglePin(dialog.id) },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  return (
    <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.headerBackground }]}>
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} hitSlop={4} style={styles.headerButton} accessibilityRole='button' accessibilityLabel='Back'>
          <MaterialCommunityIcons name='arrow-left' size={24} color={colors.headerIcon} />
        </Pressable>
        <View style={styles.headerAvatar}>
          <ChatListAvatar id={dialog.id} title={dialog.title} uri={dialog.avatar} size={42} ringColor={colors.headerBackground} />
        </View>
        <View style={styles.headerText}>
          <View style={styles.headerTitleRow}>
            <Text style={[styles.headerTitle, { color: colors.headerTitle }]} numberOfLines={1}>{dialog.title}</Text>
            {dialog.isVerified && <MaterialCommunityIcons name='check-decagram' size={16} color={colors.verified} style={styles.headerTitleIcon} />}
            {dialog.isMuted && <MaterialCommunityIcons name='volume-off' size={15} color={colors.muteIcon} style={styles.headerTitleIcon} />}
          </View>
          {typingUser
            ? (
              <Animated.View key='typing' entering={FadeIn.duration(200)} exiting={FadeOut.duration(100)}>
                <TypingStatus users={[typingUser]} action={typingAction} isGroup={dialog.kind === 'group'} color={colors.subtitleActive} textStyle={styles.headerSubtitle} />
              </Animated.View>
            )
            : (
              <Animated.Text
                key={subtitle}
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(100)}
                style={[styles.headerSubtitle, { color: isActive ? colors.subtitleActive : colors.subtitle }]}
                numberOfLines={1}
              >
                {subtitle}
              </Animated.Text>
            )}
        </View>
        {dialog.kind === 'user' && (
          <Pressable style={styles.headerButton} hitSlop={4} accessibilityRole='button' accessibilityLabel='Call' onPress={() => Alert.alert('Calls are not part of this demo')}>
            <MaterialCommunityIcons name='phone-outline' size={24} color={colors.headerIcon} />
          </Pressable>
        )}
        <Pressable style={styles.headerButton} hitSlop={4} onPress={openMenu} accessibilityRole='button' accessibilityLabel='More'>
          <MaterialCommunityIcons name='dots-vertical' size={24} color={colors.headerIcon} />
        </Pressable>
      </View>
    </View>
  )
}

function ChannelBar ({ dialog }: { dialog: Dialog }) {
  const colors = useChatListColors()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.channelBar, { paddingBottom: insets.bottom + 9 }]}>
      <Pressable
        onPress={() => chatStore.toggleMute(dialog.id)}
        style={({ pressed }) => [styles.channelButton, { backgroundColor: colors.headerBackground, opacity: pressed ? 0.85 : 1 }]}
        accessibilityRole='button'
      >
        <Text style={[styles.channelButtonText, { color: colors.typing }]}>{dialog.isMuted ? 'Unmute' : 'Mute'}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    zIndex: 1,
    boxShadow: '0 0.5px 0 rgba(0, 0, 0, 0.12)',
  },
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatar: {
    marginStart: 4,
  },
  // The text starts 55dp after the avatar's left edge: 42 + 13.
  headerText: {
    flex: 1,
    marginStart: 13,
    justifyContent: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    flexShrink: 1,
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'left',
  },
  headerTitleIcon: {
    marginStart: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 1,
    textAlign: 'left',
  },
  channelBar: {
    paddingTop: 9,
    paddingHorizontal: 7,
  },
  // Sized like the composer island it replaces: 44dp, radius 22.
  channelButton: {
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
})
