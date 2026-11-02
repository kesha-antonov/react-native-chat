import { StyleSheet } from 'react-native'

import { ChatTheme } from '../Theme'

export const createStyles = (theme: ChatTheme) => StyleSheet.create({
  // Camera preview when the toolbar is used outside a Chat: a tall square
  // above the toolbar instead of the message-list overlay.
  detachedOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
    height: 420,
  },
  // The composer is a floating island over the wallpaper: 7 from the sides, 9 above
  // the bottom inset; the band around it stays transparent.
  container: {
    backgroundColor: theme.colors.inputBarBackground,
    paddingTop: 4,
    paddingLeft: theme.spacing.screenEdge.left,
    paddingRight: theme.spacing.screenEdge.right,
  },
  // The island itself: a 44 capsule (radius 22) that grows upward with the text and holds the
  // reply banner on top. It does not clip, so the record button can grow out of it.
  // The send / record button sits outside the field's capsule, in its own 44 cell to the right.
  islandRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  island: {
    flex: 1,
    minHeight: theme.composer.minHeight,
    borderRadius: theme.radii.inputField,
  },
  islandSurface: {
    borderRadius: theme.radii.inputField,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    // positioned parent for the voice recorder's overlay bar
    position: 'relative',
  },
  // Mirrors `primary`/`fieldGroup`/`recordingBar` for RTL. All three space their
  // children with `gap` rather than manual margins, so reversing direction is
  // enough - no per-child left/right swap needed.
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  // The paused take's bar, sized like the field so the row height does not jump.
  recordingBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: theme.composer.minHeight,
    paddingHorizontal: theme.composer.fieldPaddingH,
  },
  // Locked state: a real delete target (44pt) instead of a text link.
  recTrash: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recTrashColor: {
    color: theme.colors.error,
  },
  previewBar: {
    gap: 6,
    paddingHorizontal: 0,
  },
  previewContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // The paused round take's length, in the same pill as the voice preview.
  videoPreviewPill: {
    flex: 1,
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'flex-end',
    backgroundColor: theme.colors.accent,
  },
  videoPreviewTime: {
    fontSize: 12,
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  // Everything sits inside the island now, so the field group draws nothing of its own:
  // [emoji 44] [text] [attach 44], with the send/mic cell after it.
  fieldGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: theme.composer.minHeight,
    paddingHorizontal: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  // A row, so a custom composer's `flex: 1` still means width, as it did
  // directly in the field group.
  composerSlot: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginHorizontal: 4,
  },
  // With no emoji button the text starts 14 in; with no paperclip it ends 8 short of the send cell.
  composerSlotStartInset: {
    marginLeft: 12,
  },
  composerSlotEndInset: {
    marginRight: 8,
  },
  // The emoji button's 44 cell.
  insetCell: {
    width: 44,
    height: theme.composer.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightSlot: {
    alignSelf: 'flex-end',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardFallback: {
    fontSize: 22,
  },
  // Carries inset icon color + size (kept out of JSX): `glass_defaultIcon`.
  insetColor: {
    color: theme.colors.composerIcon,
    fontSize: 26,
  },
})
