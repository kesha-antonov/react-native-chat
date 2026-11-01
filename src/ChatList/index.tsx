import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import {
  Alert,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native'
import { GestureHandlerRootView, Touchable } from 'react-native-gesture-handler'
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
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'

import { ChatContext, IChatContext } from '../ChatContext'
import { impactHaptic } from '../components/haptics'
import { Icon } from '../components/Icon'
import { normalizeColorScheme } from '../hooks/useColorScheme'
import { formatLabel, resolveLabels } from '../i18n'
import { IconName } from '../Icons'
import { isRTLLocale } from '../rtl'
import { ChatTheme, resolveTheme } from '../Theme'
import { ChatListAvatar } from './ChatListAvatar'
import { CHAT_LIST_ROW_HEIGHT, ChatListCell } from './ChatListCell'
import { ChatListShimmer } from './ChatListShimmer'
import { ChatListDrag, ChatListItem, ChatListProps, ChatListReorder } from './types'
import { matchesChatQuery, sortChats } from './utils'

export * from './types'
export { ChatListAvatar } from './ChatListAvatar'
export { ChatListCell, CHAT_LIST_ROW_HEIGHT } from './ChatListCell'
export { ChatListShimmer } from './ChatListShimmer'
export { formatChatListDate, getChatPreview, getInitials, matchesChatQuery, sortChats } from './utils'
export { useChatList } from './useChatList'

/** Rows move over 250ms on bezier(0.199, 0.011, 0.279, 0.91). */
const LIST_TRANSITION = LinearTransition.duration(250).easing(Easing.bezier(0.199, 0.011, 0.279, 0.91))
/** The new-chat button hides and shows over 380ms on an ease-out-quint curve... */
const FAB_TIMING = { duration: 380, easing: Easing.bezier(0.23, 1, 0.32, 1) }
/** ...moving its size, its 14 margin and 40 more. */
const FAB_SIZE = 48
const FAB_HIDDEN_OFFSET = FAB_SIZE + 14 + 40
const HEADER_HEIGHT = 56

const ARCHIVE_ROW_ID = '__chat-list-archive__'
type Row<TChat> = TChat | { id: typeof ARCHIVE_ROW_ID }

const isArchiveRow = <TChat, >(row: Row<TChat>): row is { id: typeof ARCHIVE_ROW_ID } =>
  (row as { id: unknown }).id === ARCHIVE_ROW_ID

/**
 * A list of chats with everything a messenger's main screen has: a header with search and a
 * selection bar (pin, mute, archive, delete), an "Archived Chats" folder, swipe to archive,
 * pinned chats you can drag into order, unread counters, typing and drafts, a loading
 * placeholder and a new-chat button. Feed it your chats and wire the callbacks to your backend.
 */
export function ChatList<TChat extends ChatListItem = ChatListItem> (props: ChatListProps<TChat>) {
  const {
    theme,
    darkTheme,
    colorScheme: colorSchemeProp,
    locale,
    labels,
    icons,
  } = props
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
    <GestureHandlerRootView style={styles.fill}>
      <ChatContext.Provider value={context}>
        <ChatListContent<TChat> {...props} resolvedTheme={resolvedTheme} />
      </ChatContext.Provider>
    </GestureHandlerRootView>
  )
}

function ChatListContent<TChat extends ChatListItem> ({
  chats,
  user,
  onPressChat,
  onLongPressChat,
  onPinChats,
  onMuteChats,
  onArchiveChats,
  onDeleteChats,
  onReorderPinnedChats,
  onPressNewChat,
  isDeleteConfirmed = true,
  isSwipeEnabled = true,
  isLoading = false,
  isSortEnabled = true,
  isHeaderVisible = true,
  title,
  renderHeaderRight,
  isTopInsetApplied = true,
  isSearchEnabled = true,
  filterChat = matchesChatQuery,
  onSearchChange,
  isArchiveOpen: isArchiveOpenProp,
  onArchiveOpenChange,
  renderChat,
  renderEmpty,
  listProps,
  style,
  resolvedTheme,
}: ChatListProps<TChat> & { resolvedTheme: ChatTheme }) {
  const colors = resolvedTheme.chatList
  const { getLabels } = useContext(ChatContext)
  const labels = getLabels!()!
  const insets = useContext(SafeAreaInsetsContext)
  const topInset = isHeaderVisible && isTopInsetApplied ? insets?.top ?? 0 : 0

  const [isArchiveOpenState, setIsArchiveOpenState] = useState(false)
  const isArchiveOpen = isArchiveOpenProp ?? isArchiveOpenState
  const setIsArchiveOpen = useCallback((isOpen: boolean) => {
    setIsArchiveOpenState(isOpen)
    onArchiveOpenChange?.(isOpen)
  }, [onArchiveOpenChange])

  const [selectedIds, setSelectedIds] = useState<TChat['id'][]>([])
  const [query, setQueryState] = useState<string | null>(null)
  const setQuery = useCallback((next: string | null) => {
    setQueryState(next)
    onSearchChange?.(next)
  }, [onSearchChange])
  const isSelectionMode = selectedIds.length > 0

  const sorted = useMemo(() => (isSortEnabled ? sortChats(chats) : chats), [chats, isSortEnabled])
  const mainChats = useMemo(() => sorted.filter(chat => !chat.isArchived), [sorted])
  const archivedChats = useMemo(() => sorted.filter(chat => chat.isArchived), [sorted])

  const rows = useMemo<Row<TChat>[]>(() => {
    const source = isArchiveOpen ? archivedChats : mainChats
    if (query)
      return source.filter(chat => filterChat(chat, query))
    // The archive sits on top of the list as a folder row.
    if (!isArchiveOpen && archivedChats.length)
      return [{ id: ARCHIVE_ROW_ID }, ...source]
    return source
  }, [isArchiveOpen, archivedChats, mainChats, query, filterChat])

  // Selected chats that are gone (deleted, or moved by an action) drop out of the selection.
  useEffect(() => {
    setSelectedIds(ids => {
      const kept = ids.filter(id => chats.some(chat => chat.id === id))
      return kept.length === ids.length ? ids : kept
    })
  }, [chats])
  const selectedChats = useMemo(
    () => selectedIds.map(id => chats.find(chat => chat.id === id)).filter((chat): chat is TChat => !!chat),
    [selectedIds, chats]
  )
  const clearSelection = useCallback(() => setSelectedIds([]), [])

  // Android's back closes selection, search and the archive before leaving the screen.
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
  }, [isSelectionMode, query, isArchiveOpen, clearSelection, setQuery, setIsArchiveOpen])

  const toggleSelected = useCallback((chat: TChat) => {
    setSelectedIds(ids => (ids.includes(chat.id) ? ids.filter(id => id !== chat.id) : [...ids, chat.id]))
  }, [])

  const onPressRow = useCallback((chat: TChat) => {
    if (isSelectionMode) {
      toggleSelected(chat)
      return
    }
    onPressChat?.(chat)
  }, [isSelectionMode, onPressChat, toggleSelected])

  // A long-press selects the chat instead of opening a menu.
  const onLongPressRow = useCallback((chat: TChat) => {
    if (onLongPressChat) {
      onLongPressChat(chat)
      return
    }
    impactHaptic('Medium')
    toggleSelected(chat)
  }, [onLongPressChat, toggleSelected])

  const onSwipeRow = useCallback((chat: TChat) => {
    onArchiveChats?.([chat], !chat.isArchived)
  }, [onArchiveChats])

  // Pinned chats in the main list can be dragged into a new order.
  const pinnedIds = useMemo(() => mainChats.filter(chat => chat.isPinned).map(chat => chat.id), [mainChats])
  const canReorder = !!onReorderPinnedChats && !isArchiveOpen && !query
  const dragId = useSharedValue('')
  const dragFrom = useSharedValue(0)
  const dragY = useSharedValue(0)
  const isDragActive = useSharedValue(false)
  const drag = useMemo<ChatListDrag>(() => ({ id: dragId, from: dragFrom, y: dragY, isActive: isDragActive }), [dragId, dragFrom, dragY, isDragActive])
  // While a row is lifted, and for the frame it lands in, the list does not animate its own
  // layout: the rows are already where the new order puts them.
  const [liftedId, setLiftedId] = useState<string | null>(null)
  const [isSettling, setIsSettling] = useState(false)
  const [dropCount, setDropCount] = useState(0)

  const onDragStart = useCallback((chat: TChat) => {
    setLiftedId(String(chat.id))
    setIsSettling(true)
    if (!selectedIds.includes(chat.id)) {
      impactHaptic('Medium')
      toggleSelected(chat)
    }
  }, [selectedIds, toggleSelected])

  const onDrop = useCallback((chat: TChat, toIndex: number) => {
    const order = pinnedIds.filter(id => id !== chat.id)
    order.splice(toIndex, 0, chat.id)
    if (order.some((id, index) => id !== pinnedIds[index]))
      onReorderPinnedChats?.(order)
    setLiftedId(null)
    setDropCount(count => count + 1)
  }, [pinnedIds, onReorderPinnedChats])

  // Committed with the new order: the rows drop their offsets in the same frame.
  useLayoutEffect(() => {
    if (!dropCount)
      return
    isDragActive.value = false
    dragY.value = 0
    dragId.value = ''
    const timer = setTimeout(() => setIsSettling(false), 50)
    return () => clearTimeout(timer)
  }, [dropCount, isDragActive, dragY, dragId])

  const reorderFor = useCallback((chat: TChat): ChatListReorder<TChat> | undefined => {
    const index = pinnedIds.indexOf(chat.id)
    if (!canReorder || index < 0)
      return undefined
    return { index, count: pinnedIds.length, drag, onStart: onDragStart, onDrop }
  }, [pinnedIds, canReorder, drag, onDragStart, onDrop])

  const runOnSelection = useCallback((action: (selection: TChat[]) => void) => {
    action(selectedChats)
    clearSelection()
  }, [selectedChats, clearSelection])

  const onDeleteSelected = useCallback(() => {
    if (!onDeleteChats)
      return
    if (!isDeleteConfirmed) {
      runOnSelection(onDeleteChats)
      return
    }
    const count = selectedChats.length
    Alert.alert(
      count === 1 ? labels.chatListDeleteTitle : formatLabel(labels.chatListDeleteManyTitle, { count }),
      labels.chatListDeleteMessage,
      [
        { text: labels.cancel, style: 'cancel' },
        { text: labels.actionDelete, style: 'destructive', onPress: () => runOnSelection(onDeleteChats) },
      ]
    )
  }, [onDeleteChats, isDeleteConfirmed, selectedChats.length, labels, runOnSelection])

  // The new-chat button hides while you scroll down the list and comes back on the way up.
  const fabOffset = useSharedValue(0)
  const lastScrollY = useSharedValue(0)
  const onScroll = useAnimatedScrollHandler(event => {
    const y = event.contentOffset.y
    const delta = y - lastScrollY.value
    lastScrollY.value = y
    if (Math.abs(delta) < 2)
      return
    const target = delta > 0 && y > CHAT_LIST_ROW_HEIGHT ? FAB_HIDDEN_OFFSET : 0
    if (target !== fabOffset.value)
      fabOffset.value = withTiming(target, FAB_TIMING)
  })
  const fabStyle = useAnimatedStyle(() => ({ transform: [{ translateY: fabOffset.value }] }))

  const renderItem = useCallback(({ item, index }: { item: Row<TChat>, index: number }) => {
    if (isArchiveRow(item))
      return <ArchiveRow chats={archivedChats} onPress={() => setIsArchiveOpen(true)} />
    const cellProps = {
      chat: item,
      user,
      isSelected: selectedIds.includes(item.id),
      isSelectionMode,
      onPress: onPressRow,
      onLongPress: onLongPressRow,
      onSwipe: onArchiveChats && isSwipeEnabled ? onSwipeRow : undefined,
      isLast: index === rows.length - 1,
      reorder: reorderFor(item),
      isReordering: isSelectionMode && canReorder && pinnedIds.length > 1 && !!item.isPinned,
    }
    return renderChat ? <>{renderChat(cellProps)}</> : <ChatListCell<TChat> {...cellProps} />
  }, [archivedChats, setIsArchiveOpen, user, selectedIds, isSelectionMode, onPressRow, onLongPressRow, onArchiveChats, isSwipeEnabled, onSwipeRow, rows.length, reorderFor, canReorder, pinnedIds.length, renderChat])

  const isAllPinned = selectedChats.length > 0 && selectedChats.every(chat => chat.isPinned)
  const isAllMuted = selectedChats.length > 0 && selectedChats.every(chat => chat.isMuted)
  const headerTitle = isArchiveOpen ? labels.chatListArchived : title ?? labels.chatListTitle

  const empty = renderEmpty
    ? <>{renderEmpty(!!query)}</>
    : <Text style={[styles.empty, { color: colors.message }]}>{query ? labels.chatListNoResults : labels.chatListEmpty}</Text>

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }, style]}>
      {isHeaderVisible && (
        <View style={[styles.header, { paddingTop: topInset, backgroundColor: colors.headerBackground }]}>
          <View style={styles.headerBar}>
            {isSelectionMode
              ? (
                <Animated.View key='selection' entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={styles.headerContent}>
                  <HeaderButton icon='close' color={colors.headerText} onPress={clearSelection} label={labels.cancelSelection} />
                  <Text style={[styles.headerTitle, styles.selectionCount, { color: colors.headerText }]}>{selectedIds.length}</Text>
                  <View style={styles.spacer} />
                  {onPinChats && !isArchiveOpen && (
                    <HeaderButton
                      icon={isAllPinned ? 'pinOff' : 'pushpin'}
                      color={colors.headerText}
                      label={isAllPinned ? labels.actionUnpin : labels.actionPin}
                      onPress={() => runOnSelection(selection => onPinChats(selection, !isAllPinned))}
                    />
                  )}
                  {onMuteChats && (
                    <HeaderButton
                      icon={isAllMuted ? 'unmute' : 'mute'}
                      color={colors.headerText}
                      label={isAllMuted ? labels.chatListUnmute : labels.chatListMute}
                      onPress={() => runOnSelection(selection => onMuteChats(selection, !isAllMuted))}
                    />
                  )}
                  {onArchiveChats && (
                    <HeaderButton
                      icon={isArchiveOpen ? 'unarchive' : 'archive'}
                      color={colors.headerText}
                      label={isArchiveOpen ? labels.chatListUnarchive : labels.chatListArchive}
                      onPress={() => runOnSelection(selection => onArchiveChats(selection, !isArchiveOpen))}
                    />
                  )}
                  {onDeleteChats && (
                    <HeaderButton icon='trash' color={colors.headerText} label={labels.actionDelete} onPress={onDeleteSelected} />
                  )}
                </Animated.View>
              )
              : query !== null
                ? (
                  <Animated.View key='search' entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={styles.headerContent}>
                    <HeaderButton icon='arrowLeft' color={colors.headerText} onPress={() => setQuery(null)} label={labels.chatListBack} />
                    <TextInput
                      autoFocus
                      value={query}
                      onChangeText={setQuery}
                      placeholder={labels.chatListSearch}
                      placeholderTextColor={colors.message}
                      style={[styles.searchInput, { color: colors.headerText }]}
                      returnKeyType='search'
                    />
                  </Animated.View>
                )
                : (
                  <Animated.View key={isArchiveOpen ? 'archive' : 'main'} entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={styles.headerContent}>
                    {isArchiveOpen && <HeaderButton icon='arrowLeft' color={colors.headerText} onPress={() => setIsArchiveOpen(false)} label={labels.chatListBack} />}
                    <Text style={[styles.headerTitle, !isArchiveOpen && styles.headerTitleStart, { color: colors.headerText }]} numberOfLines={1}>
                      {headerTitle}
                    </Text>
                    <View style={styles.spacer} />
                    {renderHeaderRight?.()}
                    {isSearchEnabled && <HeaderButton icon='search' color={colors.headerText} onPress={() => setQuery('')} label={labels.chatListSearch} />}
                  </Animated.View>
                )}
          </View>
        </View>
      )}

      <View style={styles.fill}>
        <Animated.FlatList<Row<TChat>>
          data={isLoading ? EMPTY_ROWS as Row<TChat>[] : rows}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          itemLayoutAnimation={isSettling ? undefined : LIST_TRANSITION}
          extraData={liftedId}
          // The lifted row passes over the rows below it too.
          CellRendererComponentStyle={({ item }: { item: Row<TChat> }) => (String(item.id) === liftedId ? styles.liftedCell : undefined)}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps='handled'
          contentContainerStyle={onPressNewChat ? styles.listContentWithFab : undefined}
          ListEmptyComponent={isLoading ? undefined : empty}
          {...listProps as object}
        />
        {isLoading && (
          // The rows fade in over the placeholder.
          <Animated.View exiting={FadeOut.duration(150)} style={StyleSheet.absoluteFill} pointerEvents='none'>
            <ChatListShimmer />
          </Animated.View>
        )}
      </View>

      {onPressNewChat && !isArchiveOpen && !isSelectionMode && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[styles.fabWrap, fabStyle]}>
          <Touchable
            style={[styles.fab, { backgroundColor: colors.fab }]}
            activeScale={0.9}
            onPress={onPressNewChat}
            accessibilityRole='button'
            accessibilityLabel={labels.chatListNewChat}
          >
            <Icon name='pencil' size={24} color={colors.fabIcon} fallback={<Text style={{ color: colors.fabIcon }}>+</Text>} />
          </Touchable>
        </Animated.View>
      )}
    </View>
  )
}

function HeaderButton ({ icon, color, label, onPress }: { icon: IconName, color: string, label: string, onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={4} style={styles.headerButton} accessibilityRole='button' accessibilityLabel={label}>
      <Icon name={icon} size={24} color={color} fallback={<Text style={{ color }}>{label.slice(0, 1)}</Text>} />
    </Pressable>
  )
}

/** The "Archived Chats" folder row: a grey archive avatar and the names inside. */
function ArchiveRow ({ chats, onPress }: { chats: ChatListItem[], onPress: () => void }) {
  const { getTheme, getLabels } = useContext(ChatContext)
  const colors = getTheme!()!.chatList
  const labels = getLabels!()!
  const unread = chats.reduce((sum, chat) => sum + (chat.unreadCount ?? 0), 0)

  return (
    <Touchable
      style={[styles.archiveRow, { backgroundColor: colors.background }]}
      underlayColor={colors.pressed}
      activeUnderlayOpacity={1}
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel={labels.chatListArchived}
    >
      <View style={styles.archiveAvatar}>
        <ChatListAvatar id='archive' title={labels.chatListArchived} size={52} isArchive />
      </View>
      <View style={styles.archiveContent}>
        <Text style={[styles.archiveTitle, { color: colors.name }]} numberOfLines={1}>{labels.chatListArchived}</Text>
        <View style={styles.archiveBottom}>
          <Text style={[styles.archivePreview, { color: colors.message }]} numberOfLines={1}>
            {chats.map(chat => chat.title).join(', ')}
          </Text>
          {unread > 0 && (
            <View style={[styles.archiveBadge, { backgroundColor: colors.badgeMuted }]}>
              <Text style={[styles.archiveBadgeText, { color: colors.badgeText }]}>{unread}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={[styles.archiveDivider, { backgroundColor: colors.divider }]} />
    </Touchable>
  )
}

const EMPTY_ROWS: unknown[] = []

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  liftedCell: {
    zIndex: 1,
  },
  header: {
    zIndex: 1,
  },
  headerBar: {
    height: HEADER_HEIGHT,
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
  headerTitle: {
    flexShrink: 1,
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
  listContentWithFab: {
    paddingBottom: FAB_SIZE + 40,
  },
  empty: {
    textAlign: 'center',
    marginTop: 48,
    fontSize: 15,
  },
  // 20 from the end, 14 from the bottom.
  fabWrap: {
    position: 'absolute',
    end: 20,
    bottom: 14,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
  },
  archiveRow: {
    height: CHAT_LIST_ROW_HEIGHT,
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
