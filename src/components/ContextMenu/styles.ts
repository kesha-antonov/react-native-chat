import { StyleSheet } from 'react-native'

import { ChatTheme } from '../../Theme'
import {
  BAR_CELL,
  BAR_EMOJI,
  BAR_EMOJI_BOX,
  BAR_HEIGHT,
  BAR_INSET,
  MENU_MIN_WIDTH,
  MENU_RADIUS,
  PANEL_RADIUS,
  ROW_HEIGHT,
  ROW_PADDING,
  SELECTED_SCALE,
  TAIL_BIG,
  TAIL_SMALL,
  TITLE_GAP,
} from './constants'

export type Styles = ReturnType<typeof createStyles>

export const createStyles = (theme: ChatTheme) => {
  const colors = theme.contextMenu
  // The 9-patch's soft shadow, and the glass variant's .
  const shadow = {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 8,
  }
  return StyleSheet.create({
    root: {
      flex: 1,
    },
    scrim: {
      backgroundColor: colors.scrim,
    },
    preview: {
      position: 'absolute',
    },
    hidden: {
      opacity: 0,
    },
    menu: {
      position: 'absolute',
      minWidth: MENU_MIN_WIDTH,
    },
    menuBackground: {
      ...StyleSheet.absoluteFill,
      borderRadius: MENU_RADIUS,
      backgroundColor: colors.background,
      ...shadow,
    },
    menuClip: {
      borderRadius: MENU_RADIUS,
      overflow: 'hidden',
    },
    row: {
      height: ROW_HEIGHT,
      justifyContent: 'center',
      paddingHorizontal: ROW_PADDING,
    },
    rowPressed: {
      backgroundColor: colors.pressed,
    },
    iconSlot: {
      position: 'absolute',
      left: ROW_PADDING,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
    rowLabel: {
      fontSize: 16,
      color: colors.text,
    },
    rowLabelWithIcon: {
      paddingLeft: TITLE_GAP,
    },
    tail: {
      ...StyleSheet.absoluteFill,
    },
    tailBig: {
      position: 'absolute',
      width: TAIL_BIG * 2,
      height: TAIL_BIG * 2,
      borderRadius: TAIL_BIG,
      backgroundColor: colors.background,
      ...shadow,
    },
    tailSmall: {
      position: 'absolute',
      width: TAIL_SMALL * 2,
      height: TAIL_SMALL * 2,
      borderRadius: TAIL_SMALL,
      backgroundColor: colors.background,
      ...shadow,
    },
    bar: {
      position: 'absolute',
    },
    barClip: {
      position: 'absolute',
      top: 0,
      bottom: 0,
    },
    alignEnd: {
      right: 0,
    },
    alignStart: {
      left: 0,
    },
    barBackground: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.background,
      ...shadow,
    },
    barItems: {
      position: 'absolute',
      top: 0,
      height: BAR_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: BAR_INSET,
    },
    barItemsLTR: {
      right: 0,
    },
    barItemsRTL: {
      left: 0,
      flexDirection: 'row-reverse',
    },
    reactionCell: {
      width: BAR_CELL,
      height: BAR_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reactionBox: {
      width: BAR_EMOJI_BOX,
      height: BAR_EMOJI_BOX,
      borderRadius: BAR_EMOJI_BOX / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reactionBoxSelected: {
      backgroundColor: colors.reactionSelected,
    },
    reactionEmoji: {
      fontSize: BAR_EMOJI,
      lineHeight: BAR_EMOJI_BOX,
      textAlign: 'center',
      color: '#000',
    },
    reactionEmojiSelected: {
      transform: [{ scale: SELECTED_SCALE }],
    },
    panelContent: {
      ...StyleSheet.absoluteFill,
      borderRadius: PANEL_RADIUS,
      overflow: 'hidden',
    },
    panelContentInner: {
      position: 'absolute',
      top: 0,
    },
    panelInnerEnd: {
      right: 0,
    },
    panelInnerStart: {
      left: 0,
    },
    flight: {
      position: 'absolute',
      width: BAR_EMOJI_BOX,
      height: BAR_EMOJI_BOX,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
}
