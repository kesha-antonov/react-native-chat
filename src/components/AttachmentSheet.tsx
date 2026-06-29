import React, { useCallback, useEffect, useRef } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useThemedStyles } from '../hooks/useTheme'
import { IconRenderer } from '../Icons'
import { ChatTheme } from '../Theme'

// Optional native bottom sheet (Telegram-style: native grabber, dimmed backdrop,
// drag-to-dismiss, detents). Resolved through a try/catch require so the bundle
// works whether or not it's installed; without it we fall back to a Modal sheet.
let trueSheetMod: any = null
try {
  trueSheetMod = require('@lodev09/react-native-true-sheet')
} catch {
  trueSheetMod = null
}
const TrueSheet = trueSheetMod?.TrueSheet ?? null

export const isTrueSheetAvailable = !!TrueSheet

export interface AttachmentAction {
  title: string
  action: () => void
  /** Render the title in the destructive color. */
  destructive?: boolean
  /** Optional icon - when any action has one, the sheet renders as a grid. */
  icon?: IconRenderer
  /** Tile tint for the grid icon (defaults to the theme accent). */
  color?: string
}

export interface AttachmentSheetProps {
  visible: boolean
  actions: AttachmentAction[]
  onClose: () => void
  /** Optional tint for the action labels (defaults to the theme accent). */
  tintColor?: string
}

type SheetStyles = ReturnType<typeof createStyles>

// Shared content (grid of tiles when any action has an icon, otherwise a list).
const SheetContent = ({
  actions,
  tintColor,
  onAction,
  styles,
}: {
  actions: AttachmentAction[]
  tintColor?: string
  onAction: (action: () => void) => void
  styles: SheetStyles
}) => {
  const isGrid = actions.some(a => a.icon)

  if (isGrid)
    return (
      <View style={styles.grid}>
        {actions.map((item, index) => (
          <Pressable
            key={`${item.title}-${index}`}
            onPress={() => onAction(item.action)}
            style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
          >
            <View style={[styles.tileIcon, { backgroundColor: item.color ?? styles.accent.color }]}>
              {item.icon?.({ color: '#fff', size: 26 })}
            </View>
            <Text style={styles.tileLabel} numberOfLines={1}>{item.title}</Text>
          </Pressable>
        ))}
      </View>
    )

  return (
    <View>
      {actions.map((item, index) => (
        <Pressable
          key={`${item.title}-${index}`}
          onPress={() => onAction(item.action)}
          style={({ pressed }) => [
            styles.row,
            index > 0 && styles.rowDivider,
            pressed && styles.rowPressed,
          ]}
        >
          <Text style={[styles.rowText, { color: item.destructive ? styles.destructive.color : (tintColor ?? styles.accent.color) }]}>
            {item.title}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

// Primary path: a real native bottom sheet via react-native-true-sheet.
const TrueSheetAttachment = ({ visible, actions, onClose, tintColor }: AttachmentSheetProps) => {
  const styles = useThemedStyles(createStyles)
  const insets = useSafeAreaInsets()
  const ref = useRef<any>(null)
  const presented = useRef(false)

  useEffect(() => {
    // Guard against dismissing before the first present (TrueSheet rejects with
    // "No sheet" otherwise) and swallow the returned promise's rejection.
    if (visible) {
      presented.current = true
      ref.current?.present()?.catch(() => {})
    } else if (presented.current) {
      presented.current = false
      ref.current?.dismiss()?.catch(() => {})
    }
  }, [visible])

  const onAction = useCallback((action: () => void) => {
    action()
    presented.current = false
    ref.current?.dismiss()?.catch(() => {})
  }, [])

  return (
    <TrueSheet
      ref={ref}
      sizes={['auto']}
      cornerRadius={16}
      grabber
      dimmed
      backgroundColor={styles.group.backgroundColor as string}
      onDismiss={onClose}
    >
      <View style={[styles.trueContent, { paddingBottom: insets.bottom + 12 }]}>
        <SheetContent actions={actions} tintColor={tintColor} onAction={onAction} styles={styles} />
      </View>
    </TrueSheet>
  )
}

// Fallback: a Modal sheet with a dimmed backdrop and a grab handle. Slides up,
// dismisses on backdrop tap (used when react-native-true-sheet isn't installed).
const ModalAttachment = ({ visible, actions, onClose, tintColor }: AttachmentSheetProps) => {
  const styles = useThemedStyles(createStyles)
  const insets = useSafeAreaInsets()

  const onAction = useCallback((action: () => void) => {
    action()
    onClose()
  }, [onClose])

  return (
    <Modal transparent visible={visible} animationType='slide' onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel='dismiss' />
      <View style={[styles.sheetWrapper, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.group}>
          <View style={styles.handle} />
          <SheetContent actions={actions} tintColor={tintColor} onAction={onAction} styles={styles} />
        </View>
      </View>
    </Modal>
  )
}

/**
 * Telegram-style attachment sheet. Uses the native `react-native-true-sheet`
 * when installed (native grabber, dimmed backdrop, drag-to-dismiss); otherwise
 * falls back to a dependency-free Modal sheet. No Cancel button - dismiss by
 * dragging down or tapping the backdrop.
 */
export const AttachmentSheet = (props: AttachmentSheetProps) =>
  isTrueSheetAvailable ? <TrueSheetAttachment {...props} /> : <ModalAttachment {...props} />

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetWrapper: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 0,
  },
  group: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
  },
  // Content padding inside the native sheet (which provides its own surface).
  trueContent: {
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.separator,
    marginTop: 8,
    marginBottom: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
  },
  tile: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  tilePressed: {
    opacity: 0.6,
  },
  tileIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  tileLabel: {
    fontSize: 12,
    color: theme.colors.incomingText,
  },
  row: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.separator,
  },
  rowPressed: {
    backgroundColor: theme.colors.reactionBackground,
  },
  rowText: {
    fontSize: 18,
  },
  accent: {
    color: theme.colors.accent,
  },
  destructive: {
    color: theme.colors.error,
  },
})
