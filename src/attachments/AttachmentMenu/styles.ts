import { StyleSheet } from 'react-native'

import { withAlpha } from '../../colorUtils'
import { ChatTheme } from '../../Theme'
import {
  CHECK_INSET,
  CHECK_SIZE,
  GRID_GAP,
  GRID_RADIUS,
  SEND_SIZE,
  SHEET_RADIUS,
  TAB_PILL,
  TABS_ROW,
} from './constants'

export type Styles = ReturnType<typeof createStyles>

export const createStyles = (theme: ChatTheme) => {
  const colors = theme.attachments
  return StyleSheet.create({
    dim: {
      backgroundColor: colors.dim,
    },
    background: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      borderTopLeftRadius: SHEET_RADIUS,
      borderTopRightRadius: SHEET_RADIUS,
      backgroundColor: colors.background,
      alignItems: 'center',
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      marginTop: 8,
      backgroundColor: colors.handle,
    },
    grid: {
      paddingHorizontal: GRID_GAP,
    },
    gridRow: {
      gap: GRID_GAP,
      marginBottom: GRID_GAP,
    },
    rowReverse: {
      flexDirection: 'row-reverse',
    },
    textRTL: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    cell: {
      overflow: 'hidden',
      backgroundColor: colors.cellBackground,
    },
    cornerTopLeft: {
      borderTopLeftRadius: GRID_RADIUS,
    },
    cornerTopRight: {
      borderTopRightRadius: GRID_RADIUS,
    },
    cameraCell: {
      backgroundColor: '#1F1F1F',
      alignItems: 'center',
      justifyContent: 'center',
    },
    duration: {
      position: 'absolute',
      left: 4,
      bottom: 4,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
      backgroundColor: theme.colors.mediaTimeBackground,
    },
    durationText: {
      fontSize: 12,
      color: '#FFFFFF',
    },
    checkRing: {
      position: 'absolute',
      top: CHECK_INSET,
      right: CHECK_INSET,
      width: CHECK_SIZE,
      height: CHECK_SIZE,
      borderRadius: CHECK_SIZE / 2,
      borderWidth: 1.5,
      borderColor: '#FFFFFF',
      backgroundColor: 'rgba(0, 0, 0, 0.18)',
    },
    checkDisc: {
      position: 'absolute',
      top: CHECK_INSET,
      right: CHECK_INSET,
      width: CHECK_SIZE,
      height: CHECK_SIZE,
      borderRadius: CHECK_SIZE / 2,
      borderWidth: 1.5,
      borderColor: '#FFFFFF',
      backgroundColor: colors.checkbox,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkStart: {
      right: undefined,
      left: CHECK_INSET,
    },
    checkNumber: {
      fontSize: 14,
      lineHeight: 17,
      fontWeight: '700',
      color: colors.checkboxCheck,
    },
    checkNumberSmall: {
      fontSize: 10,
    },
    panel: {
      position: 'absolute',
      left: 0,
      right: 0,
      paddingHorizontal: 16,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 10,
    },
    locationIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    locationText: {
      flex: 1,
      gap: 2,
    },
    locationTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.tabSelectedText,
    },
    locationSubtitle: {
      fontSize: 13,
      color: colors.secondaryText,
    },
    galleryPanel: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
    },
    panelText: {
      fontSize: 15,
      textAlign: 'center',
      color: colors.secondaryText,
    },
    panelButton: {
      paddingHorizontal: 18,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      backgroundColor: colors.sendButton,
    },
    panelButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.sendButtonIcon,
    },
    tabsRow: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: TABS_ROW,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabPill: {
      height: TAB_PILL,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 4,
      borderRadius: TAB_PILL / 2,
      backgroundColor: colors.tabBackground,
      borderWidth: StyleSheet.hairlineWidth,
      // A stroke rather than a shadow: a shadow on a translucent fill is drawn the slow way.
      borderColor: 'rgba(0, 0, 0, 0.08)',
    },
    tab: {
      height: TAB_PILL - 8,
    },
    tabInner: {
      flex: 1,
      alignItems: 'center',
      paddingTop: 4,
    },
    tabCapsule: {
      ...StyleSheet.absoluteFill,
      borderRadius: (TAB_PILL - 8) / 2,
      backgroundColor: withAlpha(colors.tabSelected, 0.09),
    },
    tabLabel: {
      marginTop: 1,
      fontSize: 11,
      fontWeight: '700',
    },
    tabLabelSelected: {
      fontWeight: '800',
    },
    captionRow: {
      position: 'absolute',
      left: 8,
      right: 8,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
    },
    captionPill: {
      flex: 1,
      minHeight: SEND_SIZE,
      maxHeight: 120,
      borderRadius: SEND_SIZE / 2,
      paddingHorizontal: 16,
      justifyContent: 'center',
      // The tab pill's fill and stroke: it floats over the grid, so a faint cell tint let the
      // photo under it show through the text.
      backgroundColor: colors.tabBackground,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(0, 0, 0, 0.08)',
    },
    captionInput: {
      fontSize: 16,
      paddingTop: 13,
      paddingBottom: 13,
      color: colors.text,
    },
    sendButton: {
      width: SEND_SIZE,
      height: SEND_SIZE,
      borderRadius: SEND_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.sendButton,
    },
    sendFallback: {
      fontSize: 20,
      color: colors.sendButtonIcon,
    },
    sendBadge: {
      position: 'absolute',
      top: -4,
      left: -4,
      minWidth: 22,
      height: 22,
      paddingHorizontal: 5,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.background,
      backgroundColor: colors.sendButton,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.sendButtonIcon,
    },
  })
}
