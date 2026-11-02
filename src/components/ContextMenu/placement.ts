import {
  BAR_CELL,
  BAR_HEIGHT,
  BAR_INSET,
  BAR_OFFSET,
  BAR_PAD_BOTTOM,
  BAR_PAD_TOP,
  BAR_TO_MENU,
  BOTTOM_CLEARANCE,
  FINGER_GAP,
  MESSAGE_GAP,
  PANEL_COLUMNS,
  PANEL_MAX_HEIGHT,
  PILL_X,
  PILL_Y,
  ROW_HEIGHT,
  SIDE_INSET,
  TALL_POPUP,
  TOP_INSET,
} from './constants'
import { FlightTarget } from './types'

/** Where the pressed message is, and where the finger was, in window coordinates. */
export interface MenuAnchor {
  pageX: number
  pageY: number
  bubbleWidth: number
  bubbleHeight: number
  touchX: number
  touchY: number
}

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)))

// The center of a reactions bar cell, in window coordinates.
export const cellCenter = (index: number, barLeft: number, barWidth: number, isRTL: boolean) => isRTL
  ? barLeft + barWidth - BAR_INSET - index * BAR_CELL - BAR_CELL / 2
  : barLeft + BAR_INSET + index * BAR_CELL + BAR_CELL / 2

// The bar is sized from its cells; an accessory can widen it.
export const getBarWidth = (barSlots: number, accessoryWidth: number, screenWidth: number) =>
  Math.min(BAR_INSET * 2 + barSlots * BAR_CELL + accessoryWidth, screenWidth - SIDE_INSET * 2)

interface PopupBox {
  anchor: MenuAnchor
  containerLeft: number
  containerWidth: number
  containerHeight: number
  hasReactions: boolean
  minY: number
  maxY: number
}

// The popup is anchored at the finger, which near the bottom of the list (or beside a
// short bubble at the right edge) clamps it straight over the message it is for. When the
// card (or its reactions pill) would cover the lit message's text and it fits fully below or
// above that message, it moves there instead, keeping its horizontal placement.
const placeTop = (box: PopupBox, touchAt: number, messageTop: number, messageHeight: number) => {
  const { anchor, containerLeft, containerWidth, containerHeight, hasReactions, minY, maxY } = box
  let top = touchAt
  if (containerHeight > TALL_POPUP)
    top += TALL_POPUP - containerHeight
  top = clamp(top, minY, maxY)

  const messageBottom = messageTop + messageHeight
  const cardTop = hasReactions ? top + BAR_OFFSET : top
  const cardBottom = top + containerHeight
  const coversBubble = messageHeight > 0 &&
    cardTop < messageBottom && cardBottom > messageTop &&
    containerLeft < anchor.pageX + anchor.bubbleWidth && containerLeft + containerWidth > anchor.pageX
  if (coversBubble) {
    // Below: the reactions bar's tail reaches up to the bubble, as it does from the finger.
    const below = messageBottom + MESSAGE_GAP - (hasReactions ? BAR_OFFSET : 0)
    // Above: the card ends just over the bubble.
    const above = messageTop - MESSAGE_GAP - containerHeight
    if (below >= minY && below <= maxY)
      top = below
    else if (above >= minY && above <= maxY)
      top = above
  }
  return top
}

export interface MenuPlacementInput {
  /** The anchor as it was when the overlay opened. */
  openAnchor: MenuAnchor
  /** The message's live position, which the list can move while the overlay is up. */
  pageX: number
  pageY: number
  bubbleWidth: number
  bubbleHeight: number
  screenWidth: number
  screenHeight: number
  insets: { top: number, bottom: number }
  isRTL: boolean
  hasReactions: boolean
  barWidth: number
  rowCount: number
  menuWidth: number
}

export const placeMenu = ({
  openAnchor,
  pageX,
  pageY,
  bubbleWidth,
  bubbleHeight,
  screenWidth,
  screenHeight,
  insets,
  isRTL,
  hasReactions,
  barWidth,
  rowCount,
  menuWidth,
}: MenuPlacementInput) => {
  const hasMenu = rowCount > 0
  const menuHeight = rowCount * ROW_HEIGHT

  const containerWidth = Math.max(hasReactions ? barWidth : 0, hasMenu ? menuWidth : 0)
  const barBlockHeight = BAR_OFFSET + BAR_PAD_TOP + BAR_HEIGHT + BAR_PAD_BOTTOM
  const containerHeight = hasReactions
    ? (hasMenu ? BAR_OFFSET + BAR_TO_MENU + menuHeight : barBlockHeight)
    : menuHeight

  // Beside the finger, on the side away from the reading direction.
  const containerLeft = isRTL
    ? clamp(openAnchor.touchX + FINGER_GAP, SIDE_INSET, screenWidth - SIDE_INSET - containerWidth)
    : clamp(openAnchor.touchX - FINGER_GAP - containerWidth, SIDE_INSET, screenWidth - SIDE_INSET - containerWidth)

  const minY = insets.top + TOP_INSET
  const maxY = screenHeight - insets.bottom - containerHeight - BOTTOM_CLEARANCE

  const box: PopupBox = { anchor: openAnchor, containerLeft, containerWidth, containerHeight, hasReactions, minY, maxY }
  const containerTop = placeTop(box, openAnchor.touchY, openAnchor.pageY, openAnchor.bubbleHeight)

  // How far the message has moved since the overlay opened, kept on screen.
  const movedBy = pageY - openAnchor.pageY
  const followDy = movedBy === 0 ? 0 : placeTop(box, openAnchor.touchY + movedBy, pageY, bubbleHeight) - containerTop

  // The bar keeps to the container's far side, the card to its near side.
  const barLeft = isRTL ? containerLeft : containerLeft + containerWidth - barWidth
  const pillTop = containerTop + BAR_OFFSET + BAR_PAD_TOP
  const menuLeft = isRTL ? containerLeft + containerWidth - menuWidth : containerLeft
  const menuTop = hasReactions ? containerTop + BAR_OFFSET + BAR_TO_MENU : containerTop

  // The expanded panel keeps the bar's top and far side, moving up if it would not fit.
  const panelWidth = Math.min(Math.max(barWidth, PANEL_COLUMNS * 40 + BAR_INSET * 2), screenWidth - SIDE_INSET * 2)
  const panelHeight = Math.min(PANEL_MAX_HEIGHT, screenHeight - insets.top - insets.bottom - TOP_INSET * 2)
  const panelLeft = clamp(isRTL ? barLeft : barLeft + barWidth - panelWidth, SIDE_INSET, screenWidth - SIDE_INSET - panelWidth)
  const panelTop = clamp(pillTop, minY, screenHeight - insets.bottom - panelHeight - TOP_INSET)

  // The reaction is applied first and the emoji flies to its pill under the
  // message at its live position: a first reaction grows the bubble, so the target follows it.
  const flightTarget: FlightTarget = {
    toX: isRTL ? pageX + bubbleWidth - PILL_X : pageX + PILL_X,
    toY: pageY + bubbleHeight - PILL_Y,
  }

  return {
    hasMenu,
    containerLeft,
    containerWidth,
    containerTop,
    followDy,
    barLeft,
    pillTop,
    menuLeft,
    menuTop,
    panelWidth,
    panelHeight,
    panelLeft,
    panelTop,
    flightTarget,
  }
}
