import React from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { ChatListAvatar } from '@kesha-antonov/react-native-chat'
import { Href, useRouter } from 'expo-router'
import { Touchable } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CONTACTS } from './data'
import { chatStore } from './store'
import { useChatListColors } from './theme'

/** What the pencil opens: a contact list to start a chat from. */
export default function NewMessageScreen () {
  const colors = useChatListColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[{ paddingTop: insets.top, backgroundColor: colors.headerBackground }]}>
        <View style={styles.headerBar}>
          <Pressable onPress={() => router.back()} hitSlop={4} style={styles.headerButton} accessibilityRole='button' accessibilityLabel='Back'>
            <MaterialCommunityIcons name='arrow-left' size={24} color={colors.headerIcon} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.headerTitle }]}>New Message</Text>
        </View>
      </View>
      <FlatList
        data={CONTACTS}
        keyExtractor={user => String(user._id)}
        contentContainerStyle={{ paddingBottom: insets.bottom }}
        renderItem={({ item }) => (
          <Touchable
            style={styles.row}
            underlayColor={colors.pressed}
            activeUnderlayOpacity={1}
            onPress={() => router.replace(`/chats/${chatStore.ensureDialog(item)}` as Href)}
            accessibilityRole='button'
            accessibilityLabel={item.name}
          >
            <ChatListAvatar id={String(item._id)} title={item.name ?? ''} uri={typeof item.avatar === 'string' ? item.avatar : undefined} size={46} />
            <Text style={[styles.name, { color: colors.name }]} numberOfLines={1}>{item.name}</Text>
          </Touchable>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '500',
    marginStart: 8,
  },
  // Contact rows, a little shorter than chat rows (`UserCell` is not in the referenced sources).
  row: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  name: {
    flex: 1,
    marginStart: 17,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'left',
  },
})
