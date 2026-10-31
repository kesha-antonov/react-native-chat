import React, { createContext, ReactNode, useContext, useState } from 'react'
import { StyleSheet, View } from 'react-native'

/*
 * A layer over the message list that the composer can draw into.
 *
 * The round video recorder used to open in a `Modal`, and a modal is a new
 * native window: the press that opened it is cancelled the moment it appears,
 * so a note took two presses - hold the camera to open it, then hold its
 * shutter. Telegram records on the first hold, with the finger still on the
 * button (`InstantCameraView` is a view inside the chat). Drawing the camera
 * into this slot keeps it in the same window, so the toolbar's gesture lives on.
 *
 * Two contexts so that only the slot re-renders when the content changes: the
 * setter is stable, and the provider's children are the same elements.
 */
const SetOverlayContext = createContext<((node: ReactNode) => void) | null>(null)
const OverlayNodeContext = createContext<ReactNode>(null)

export function ChatOverlayProvider ({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<ReactNode>(null)

  return (
    <SetOverlayContext.Provider value={setNode}>
      <OverlayNodeContext.Provider value={node}>
        {children}
      </OverlayNodeContext.Provider>
    </SetOverlayContext.Provider>
  )
}

/** Where the overlay is drawn: over the message list, never over the composer. */
export function ChatOverlaySlot () {
  const node = useContext(OverlayNodeContext)
  if (!node)
    return null

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents='box-none'>
      {node}
    </View>
  )
}

/** The overlay setter, or `null` when rendered outside a `Chat`. */
export const useChatOverlay = () => useContext(SetOverlayContext)
