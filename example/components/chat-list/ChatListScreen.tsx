import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, BackHandler, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Href, useRouter } from 'expo-router'
import { Touchable } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useColorScheme } from '@/hooks/use-color-scheme'

import { ChatListShimmer, SHIMMER_COLORS } from './ChatListShimmer'
import { Dialog } from './data'
import { DialogAvatar } from './DialogAvatar'
import { DialogCell, ROW_HEIGHT } from './DialogCell'
import { chatStore, startChatListDemo, useDialogs } from './store'
import { useChatListColors } from './theme'

/** Rows move with Telegram's list item animator: 250ms, bezier(0.199, 0.011, 0.279, 0.91). */
const LIST_TRANSITION = LinearTransition.duration(250).easing(Easing.bezier(0.199, 0.011, 0.279, 0.91))
/** `FragmentFloatingButton` hides and shows over 380ms on EASE_OUT_QUINT, moving 40dp... */
const FAB_TIMING = { duration: 380, easing: Easing.bezier(0.23, 1, 0.32, 1) }
/** ...but it has to clear its 14dp margin too, so it travels its size plus that. */
const FAB_SIZE = 48
const FAB_HIDDEN_OFFSET = FAB_SIZE + 14 + 40

const ARCHIVE_ROW_ID = '__archive__'

type Row = Dialog | { id: typeof ARCHIVE_ROW_ID }

// Telegram shows its flicker placeholder while the dialogs load; the demo plays it once, on
// the first open of the tab in a session, for a short simulated load.
const SIMULATED_LOAD_MS = 1500
let hasLoadedDialogs = false

export default function ChatListScreen () {
  const colors = useChatListColors()
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const [isLoading, setIsLoading] = useState(!hasLoadedDialogs)

  useEffect(() => {
    if (hasLoadedDialogs)
      return
    const timer = setTimeout(() => {
      hasLoadedDialogs = true
      setIsLoading(false)
    }, SIMULATED_LOAD_MS)
    return () => clearTimeout(timer)
  }, [])
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const [isArchiveOpen, setIsArchiveOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [query, setQuery] = useState<string | null>(null)

  const mainDialogs = useDialogs(false)
  const archivedDialogs = useDialogs(true)
  const isSelectionMode = selectedIds.length > 0

  useEffect(() => {
    startChatListDemo()
  }, [])

  const rows = useMemo<Row[]>(() => {
    const source = isArchiveOpen ? archivedDialogs : mainDialogs
    if (query) {
      const needle = query.trim().toLowerCase()
      return source.filter(dialog => dialog.title.toLowerCase().includes(needle))
    }
    // The archive sits on top of the list as a folder row, as in Telegram.
    if (!isArchiveOpen && archivedDialogs.length)
      return [{ id: ARCHIVE_ROW_ID }, ...source]
    return source
  }, [isArchiveOpen, archivedDialogs, mainDialogs, query])

  // Read fresh on every render: an action changes the dialogs under the selection.
  const selectedDialogs = selectedIds.map(id => chatStore.getDialog(id)).filter(Boolean)

  const clearSelection = useCallback(() => setSelectedIds([]), [])

  // Android's back closes selection, search and the archive before leaving the tab.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isSelectionMode)
        clearSelection()
      else if (query !== null)
        setQuery(null)
      else if (isArchiveOpen)
        setIsArchiveOpen(false)
      else
        return false
      return true
    })
    return () => subscription.remove()
  }, [isSelectionMode, query, isArchiveOpen, clearSelection])

  const toggleSelected = useCallback((dialog: Dialog) => {
    setSelectedIds(ids => (ids.includes(dialog.id) ? ids.filter(id => id !== dialog.id) : [...ids, dialog.id]))
  }, [])

  const onPressDialog = useCallback((dialog: Dialog) => {
    if (isSelectionMode) {
      toggleSelected(dialog)
      return
    }
    router.push(`/chats/${dialog.id}` as Href)
  }, [isSelectionMode, router, toggleSelected])

  // A long-press selects the chat (`DialogCell` checkbox) instead of opening a menu.
  const onLongPressDialog = useCallback((dialog: Dialog) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    toggleSelected(dialog)
  }, [toggleSelected])

  const onSwipeDialog = useCallback((dialog: Dialog) => {
    chatStore.toggleArchive(dialog.id)
  }, [])

  const runOnSelection = useCallback((action: (id: string) => void) => {
    selectedIds.forEach(action)
    clearSelection()
  }, [selectedIds, clearSelection])

  const onDeleteSelected = useCallback(() => {
    const count = selectedIds.length
    Alert.alert(
      count === 1 ? 'Delete chat' : `Delete ${count} chats`,
      'Are you sure you want to delete the selected chats?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => runOnSelection(chatStore.deleteDialog) },
      ]
    )
  }, [selectedIds, runOnSelection])

  // The pencil hides while you scroll down the list and comes back on the way up.
  const fabOffset = useSharedValue(0)
  const lastScrollY = useSharedValue(0)
  const onScroll = useAnimatedScrollHandler(event => {
    const y = event.contentOffset.y
    const delta = y - lastScrollY.value
    lastScrollY.value = y
    if (Math.abs(delta) < 2)
      return
    const target = delta > 0 && y > ROW_HEIGHT ? FAB_HIDDEN_OFFSET : 0
    if (target !== fabOffset.value)
      fabOffset.value = withTiming(target, FAB_TIMING)
  })
  const fabStyle = useAnimatedStyle(() => ({ transform: [{ translateY: fabOffset.value }] }))

  const renderItem = useCallback(({ item, index }: { item: Row, index: number }) => {
    if (item.id === ARCHIVE_ROW_ID)
      return <ArchiveRow dialogs={archivedDialogs} onPress={() => setIsArchiveOpen(true)} />
    const dialog = item as Dialog
    return (
      <DialogCell
        dialog={dialog}
        isSelected={selectedIds.includes(dialog.id)}
        isSelectionMode={isSelectionMode}
        onPress={onPressDialog}
        onLongPress={onLongPressDialog}
        onSwipe={onSwipeDialog}
        isLast={index === rows.length - 1}
      />
    )
  }, [archivedDialogs, selectedIds, isSelectionMode, onPressDialog, onLongPressDialog, onSwipeDialog, rows.length])

  const isAllPinned = selectedDialogs.every(dialog => dialog?.isPinned)
  const isAllMuted = selectedDialogs.every(dialog => dialog?.isMuted)

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.headerBackground }]}>
        <View style={styles.headerBar}>
          {isSelectionMode
            ? (
              <Animated.View key='selection' entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={styles.headerContent}>
                <HeaderButton icon='close' color={colors.headerIcon} onPress={clearSelection} label='Clear selection' />
                <Text style={[styles.headerTitle, styles.selectionCount, { color: colors.headerTitle }]}>{selectedIds.length}</Text>
                <View style={styles.spacer} />
                {!isArchiveOpen && (
                  <HeaderButton
                    icon={isAllPinned ? 'pin-off-outline' : 'pin-outline'}
                    color={colors.headerIcon}
                    label={isAllPinned ? 'Unpin' : 'Pin'}
                    onPress={() => runOnSelection(id => {
                      if (!!chatStore.getDialog(id).isPinned === isAllPinned)
                        chatStore.togglePin(id)
                    })}
                  />
                )}
                <HeaderButton
                  icon={isAllMuted ? 'volume-high' : 'volume-off'}
                  color={colors.headerIcon}
                  label={isAllMuted ? 'Unmute' : 'Mute'}
                  onPress={() => runOnSelection(id => {
                    if (!!chatStore.getDialog(id).isMuted === isAllMuted)
                      chatStore.toggleMute(id)
                  })}
                />
                <HeaderButton
                  icon={isArchiveOpen ? 'archive-arrow-up-outline' : 'archive-arrow-down-outline'}
                  color={colors.headerIcon}
                  label={isArchiveOpen ? 'Unarchive' : 'Archive'}
                  onPress={() => runOnSelection(chatStore.toggleArchive)}
                />
                <HeaderButton icon='delete-outline' color={colors.headerIcon} label='Delete' onPress={onDeleteSelected} />
              </Animated.View>
            )
            : query !== null
              ? (
                <Animated.View key='search' entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={styles.headerContent}>
                  <HeaderButton icon='arrow-left' color={colors.headerIcon} onPress={() => setQuery(null)} label='Close search' />
                  <TextInput
                    autoFocus
                    value={query}
                    onChangeText={setQuery}
                    placeholder='Search'
                    placeholderTextColor={colors.message}
                    style={[styles.searchInput, { color: colors.headerTitle }]}
                  />
                </Animated.View>
              )
              : (
                <Animated.View key={isArchiveOpen ? 'archive' : 'main'} entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={styles.headerContent}>
                  {isArchiveOpen && <HeaderButton icon='arrow-left' color={colors.headerIcon} onPress={() => setIsArchiveOpen(false)} label='Back' />}
                  <Text style={[styles.headerTitle, !isArchiveOpen && styles.headerTitleStart, { color: colors.headerTitle }]}>
                    {isArchiveOpen ? 'Archive' : 'Chats'}
                  </Text>
                  <View style={styles.spacer} />
                  <HeaderButton icon='magnify' color={colors.headerIcon} onPress={() => setQuery('')} label='Search' />
                </Animated.View>
              )}
        </View>
      </View>

      <Animated.FlatList
        data={isLoading ? EMPTY_ROWS : rows}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        itemLayoutAnimation={LIST_TRANSITION}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps='handled'
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={isLoading
          ? undefined
          : (
            <Text style={[styles.empty, { color: colors.message }]}>
              {query ? 'No chats found' : 'No chats here yet'}
            </Text>
          )}
      />
      {isLoading && (
        // The list fades its rows in over the placeholder (`setAnimateEmptyView(true, ALPHA)`).
        <Animated.View exiting={FadeOut.duration(150)} style={[styles.shimmer, { top: insets.top + 56 }]} pointerEvents='none'>
          <ChatListShimmer colors={SHIMMER_COLORS[colorScheme]} />
        </Animated.View>
      )}

      {!isArchiveOpen && !isSelectionMode && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[styles.fabWrap, fabStyle]}>
          <Touchable
            style={[styles.fab, { backgroundColor: colors.fab }]}
            activeScale={0.9}
            onPress={() => router.push('/chats/new' as Href)}
            accessibilityRole='button'
            accessibilityLabel='New message'
          >
            <MaterialCommunityIcons name='pencil' size={24} color='#FFFFFF' />
          </Touchable>
        </Animated.View>
      )}
    </View>
  )
}

function HeaderButton ({ icon, color, label, onPress }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'], color: string, label: string, onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={4} style={styles.headerButton} accessibilityRole='button' accessibilityLabel={label}>
      <MaterialCommunityIcons name={icon} size={24} color={color} />
    </Pressable>
  )
}

/** The "Archived Chats" folder row: a grey archive avatar and the names inside. */
function ArchiveRow ({ dialogs, onPress }: { dialogs: Dialog[], onPress: () => void }) {
  const colors = useChatListColors()
  const unread = dialogs.reduce((sum, dialog) => sum + dialog.unreadCount, 0)

  return (
    <Touchable style={[styles.archiveRow, { backgroundColor: colors.background }]} underlayColor={colors.pressed} activeUnderlayOpacity={1} onPress={onPress} accessibilityRole='button' accessibilityLabel='Archived Chats'>
      <View style={styles.archiveAvatar}>
        <DialogAvatar id='archive' title='Archive' size={52} kind='archive' />
      </View>
      <View style={styles.archiveContent}>
        <Text style={[styles.archiveTitle, { color: colors.name }]} numberOfLines={1}>Archived Chats</Text>
        <View style={styles.archiveBottom}>
          <Text style={[styles.archivePreview, { color: colors.message }]} numberOfLines={1}>
            {dialogs.map(dialog => dialog.title).join(', ')}
          </Text>
          {unread > 0 && (
            <View style={[styles.archiveBadge, { backgroundColor: colors.badgeMuted }]}>
              <Text style={styles.archiveBadgeText}>{unread}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={[styles.archiveDivider, { backgroundColor: colors.divider }]} />
    </Touchable>
  )
}

const EMPTY_ROWS: Row[] = []

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  shimmer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  header: {
    zIndex: 1,
  },
  // `ActionBar`: 56dp in portrait.
  headerBar: {
    height: 56,
  },
  headerContent: {
    ...StyleSheet.absoluteFill,
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
  // The action bar title: 20dp bold in portrait (`ActionBar.java`).
  headerTitle: {
    fontSize: 20,
    fontWeight: '500',
    marginStart: 8,
  },
  headerTitleStart: {
    marginStart: 14,
  },
  selectionCount: {
    fontSize: 18,
    marginStart: 14,
  },
  spacer: {
    flex: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 18,
    marginStart: 8,
    textAlign: 'auto',
  },
  listContent: {
    paddingBottom: FAB_SIZE + 40,
  },
  empty: {
    textAlign: 'center',
    marginTop: 48,
    fontSize: 15,
  },
  // Right 20dp and bottom 14dp (`FragmentFloatingButton.createDefaultLayoutParams`).
  fabWrap: {
    position: 'absolute',
    end: 20,
    bottom: 14,
  },
  // A 48dp circle, almost flat (`translationZ` 0.5dp).
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
  },
  archiveRow: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
  },
  archiveAvatar: {
    position: 'absolute',
    start: 11,
    top: 9,
  },
  archiveContent: {
    flex: 1,
    marginStart: 76,
    paddingEnd: 15,
  },
  archiveTitle: {
    marginTop: 14,
    height: 19,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'left',
  },
  archiveBottom: {
    marginTop: 5,
    height: 20.666,
    flexDirection: 'row',
    alignItems: 'center',
  },
  archivePreview: {
    flex: 1,
    fontSize: 15,
    textAlign: 'left',
  },
  archiveBadge: {
    minWidth: 20.666,
    height: 20.666,
    borderRadius: 11.5,
    paddingHorizontal: 6.333,
    marginStart: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  archiveBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  archiveDivider: {
    position: 'absolute',
    start: 72,
    end: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
})
