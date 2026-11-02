import React, { useMemo, useState } from 'react'
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { ChatListAvatar, IMessage, User } from '@kesha-antonov/react-native-chat'
import { Href, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { dialogSubtitle } from './ChatScreen'
import { ME } from './data'
import { chatStore, useDialog, useMessages } from './store'
import { useChatListColors } from './theme'

type MediaTab = 'media' | 'files' | 'links'

const URL_PATTERN = /https?:\/\/[^\s]+/g
const MEDIA_COLUMNS = 3

/**
 * A chat's profile, opened from the chat header as in Telegram: the photo and name with the status
 * line, quick actions, what there is to know about the chat (a username, a bot's description, a
 * group's members), and the media, files and links shared in it.
 */
export default function ProfileScreen ({ id }: { id: string }) {
  const dialog = useDialog(id)
  const messages = useMessages(id)
  const colors = useChatListColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const [tab, setTab] = useState<MediaTab>('media')

  const shared = useMemo(() => {
    const media: IMessage[] = []
    const files: IMessage[] = []
    const links: { id: string, url: string, title?: string }[] = []
    for (const message of messages) {
      if (message.image || (message.video && !message.videoNote))
        media.push(message)
      if (message.file)
        files.push(message)
      if (message.linkPreview?.url)
        links.push({ id: String(message._id), url: message.linkPreview.url, title: message.linkPreview.title })
      else
        message.text?.match(URL_PATTERN)?.forEach((url, index) => links.push({ id: `${String(message._id)}-${index}`, url }))
    }
    return { media, files, links }
  }, [messages])

  if (!dialog)
    return null

  const isUser = dialog.kind === 'user' && !dialog.isBot
  const isActive = !!dialog.isOnline
  const cell = (width - 2 * (MEDIA_COLUMNS - 1)) / MEDIA_COLUMNS

  const actions: { key: string, icon: keyof typeof MaterialCommunityIcons.glyphMap, label: string, onPress: () => void }[] = [
    { key: 'message', icon: 'message-text-outline', label: 'Message', onPress: () => router.back() },
    {
      key: 'mute',
      icon: dialog.isMuted ? 'bell-outline' : 'bell-off-outline',
      label: dialog.isMuted ? 'Unmute' : 'Mute',
      onPress: () => chatStore.toggleMute(dialog.id),
    },
    ...(isUser ? [{ key: 'call', icon: 'phone-outline' as const, label: 'Call', onPress: () => Alert.alert('Calls are not part of this demo') }] : []),
  ]

  // A group's people: you, then the members, as the chat header counts them.
  const members: User[] = dialog.kind === 'group' ? [ME, ...(dialog.members ?? [])] : []

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.headerBackground }]}>
        <View style={styles.headerBar}>
          <Pressable onPress={() => router.back()} hitSlop={4} style={styles.headerButton} accessibilityRole='button' accessibilityLabel='Back'>
            <MaterialCommunityIcons name='arrow-left' size={24} color={colors.headerIcon} />
          </Pressable>
        </View>
        <View style={styles.hero}>
          <ChatListAvatar id={dialog.id} title={dialog.title} uri={dialog.avatar} size={96} ringColor={colors.headerBackground} />
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.headerTitle }]} numberOfLines={1}>{dialog.title}</Text>
            {dialog.isVerified && <MaterialCommunityIcons name='check-decagram' size={20} color={colors.verified} style={styles.titleIcon} />}
            {dialog.isMuted && <MaterialCommunityIcons name='volume-off' size={18} color={colors.muteIcon} style={styles.titleIcon} />}
          </View>
          <Text style={[styles.subtitle, { color: isActive ? colors.subtitleActive : colors.subtitle }]}>{dialogSubtitle(dialog)}</Text>
        </View>
        <View style={styles.actions}>
          {actions.map(action => (
            <Pressable
              key={action.key}
              onPress={action.onPress}
              style={({ pressed }) => [styles.action, { backgroundColor: colors.pressed, opacity: pressed ? 0.7 : 1 }]}
              accessibilityRole='button'
              accessibilityLabel={action.label}
            >
              <MaterialCommunityIcons name={action.icon} size={22} color={colors.headerTitle} />
              <Text style={[styles.actionLabel, { color: colors.headerTitle }]}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
        <View style={styles.section}>
          {isUser && dialog.peer && (
            <InfoRow label='Username' value={`@${String(dialog.peer._id)}`} colors={colors} />
          )}
          {dialog.isBot && dialog.botDescription && (
            <InfoRow label='About' value={dialog.botDescription} colors={colors} />
          )}
          {dialog.kind === 'channel' && (
            <InfoRow label='Link' value={`t.me/${dialog.id}`} colors={colors} />
          )}
          {members.map(member => (
            <View key={String(member._id)} style={styles.member}>
              <ChatListAvatar id={String(member._id)} title={member.name ?? ''} uri={typeof member.avatar === 'string' ? member.avatar : undefined} size={40} ringColor={colors.background} />
              <View style={styles.memberText}>
                <Text style={[styles.memberName, { color: colors.name }]}>{member._id === ME._id ? `${member.name} (you)` : member.name}</Text>
                <Text style={[styles.memberStatus, { color: colors.date }]}>{member._id === ME._id ? 'online' : 'last seen recently'}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.tabs, { borderBottomColor: colors.divider }]}>
          {(['media', 'files', 'links'] as MediaTab[]).map(key => (
            <Pressable key={key} onPress={() => setTab(key)} style={styles.tab} accessibilityRole='tab' accessibilityState={{ selected: tab === key }}>
              <Text style={[styles.tabLabel, { color: tab === key ? colors.subtitleActive : colors.date }]}>
                {key === 'media' ? 'Media' : key === 'files' ? 'Files' : 'Links'}
              </Text>
              {tab === key && <View style={[styles.tabIndicator, { backgroundColor: colors.subtitleActive }]} />}
            </Pressable>
          ))}
        </View>

        {tab === 'media' && (
          shared.media.length > 0
            ? (
              <View style={styles.grid}>
                {shared.media.map(message => (
                  <Pressable
                    key={String(message._id)}
                    onPress={() => router.push(`/chats/${dialog.id}` as Href)}
                    style={{ width: cell, height: cell }}
                    accessibilityRole='imagebutton'
                  >
                    {message.image
                      ? <Image source={{ uri: message.image }} style={StyleSheet.absoluteFill} />
                      : (
                        <View style={[StyleSheet.absoluteFill, styles.videoCell]}>
                          <MaterialCommunityIcons name='play' size={32} color='#fff' />
                        </View>
                      )}
                  </Pressable>
                ))}
              </View>
            )
            : <Empty text='No media shared yet' colors={colors} />
        )}
        {tab === 'files' && (
          shared.files.length > 0
            ? shared.files.map(message => (
              <View key={String(message._id)} style={styles.listRow}>
                <View style={[styles.fileIcon, { backgroundColor: colors.subtitleActive }]}>
                  <MaterialCommunityIcons name='file-document-outline' size={22} color='#fff' />
                </View>
                <Text style={[styles.listText, { color: colors.name }]} numberOfLines={1}>{message.file?.name}</Text>
              </View>
            ))
            : <Empty text='No files shared yet' colors={colors} />
        )}
        {tab === 'links' && (
          shared.links.length > 0
            ? shared.links.map(link => (
              <Pressable key={link.id} onPress={() => Linking.openURL(link.url)} style={styles.listRow} accessibilityRole='link'>
                <View style={[styles.fileIcon, { backgroundColor: colors.pressed }]}>
                  <MaterialCommunityIcons name='link-variant' size={22} color={colors.subtitleActive} />
                </View>
                <View style={styles.memberText}>
                  {!!link.title && <Text style={[styles.listText, { color: colors.name }]} numberOfLines={1}>{link.title}</Text>}
                  <Text style={[styles.linkUrl, { color: colors.subtitleActive }]} numberOfLines={1}>{link.url}</Text>
                </View>
              </Pressable>
            ))
            : <Empty text='No links shared yet' colors={colors} />
        )}
      </ScrollView>
    </View>
  )
}

type Colors = ReturnType<typeof useChatListColors>

const InfoRow = ({ label, value, colors }: { label: string, value: string, colors: Colors }) => (
  <View style={styles.infoRow}>
    <Text style={[styles.infoValue, { color: colors.name }]}>{value}</Text>
    <Text style={[styles.infoLabel, { color: colors.date }]}>{label}</Text>
  </View>
)

const Empty = ({ text, colors }: { text: string, colors: Colors }) => (
  <Text style={[styles.empty, { color: colors.date }]}>{text}</Text>
)

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingBottom: 16,
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
  hero: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
  },
  titleIcon: {
    marginStart: 6,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  actionLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    paddingVertical: 8,
  },
  infoRow: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  infoValue: {
    fontSize: 16,
  },
  infoLabel: {
    fontSize: 13,
    marginTop: 2,
  },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  memberText: {
    flex: 1,
    marginStart: 14,
  },
  memberName: {
    fontSize: 16,
  },
  memberStatus: {
    fontSize: 13,
    marginTop: 2,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 24,
    right: 24,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    paddingTop: 2,
  },
  videoCell: {
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  fileIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listText: {
    flex: 1,
    marginStart: 14,
    fontSize: 15,
  },
  linkUrl: {
    fontSize: 14,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 32,
    fontSize: 15,
  },
})
