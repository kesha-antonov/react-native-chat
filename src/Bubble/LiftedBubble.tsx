import React, { useContext, useEffect } from 'react'
import { Keyboard, StyleProp, View, ViewStyle } from 'react-native'

import { LiftedPlaybackContext, MediaPlaybackContext } from '../components/mediaPlayback'

// A lifted copy must not undo the original's margins: the overlay places it by
// the measured bubble box, which excludes them.
export const LIFTED_RESET: ViewStyle = {
  margin: 0,
  marginTop: 0,
  marginBottom: 0,
  marginLeft: 0,
  marginRight: 0,
  marginStart: 0,
  marginEnd: 0,
  marginHorizontal: 0,
  marginVertical: 0,
}

/** Long enough for the list to finish following the keyboard down (250ms) and lay out. */
const KEYBOARD_SETTLE_MS = 350

/**
 * The copy of a bubble that the long-press overlay draws above its backdrop.
 * While it is mounted the original is hidden, so the message seems to lift out
 * of the list and land back in it - and a custom picker that never renders the
 * copy leaves the original alone. It sits outside the media playback context:
 * a second player must not register in the playlist under the same message id
 * and unregister the real one when the overlay closes.
 */
export const LiftedBubble = ({
  onLiftChange,
  onRemeasure,
  style,
  children,
}: {
  onLiftChange: (isLifted: boolean) => void
  onRemeasure: () => void
  style: StyleProp<ViewStyle>
  children: React.ReactNode
}) => {
  // Presenting the overlay's Modal dismisses the keyboard (and iOS brings it
  // back when the Modal goes), so the list moves under the copy. Follow the
  // original, so the copy flies back to where it really is.
  //
  // The event alone is not enough: on Android the keyboard can be gone before this copy has
  // subscribed, and the list is still sliding down (keyboard-controller animates it) when the
  // event arrives - either way the copy stayed where the message had been, over another one,
  // with the original's slot left empty. So it also measures once the slide has had time to
  // finish; when nothing moved, that measure lands exactly where the copy already is.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const remeasureSoon = () => {
      onRemeasure()
      timers.push(setTimeout(onRemeasure, KEYBOARD_SETTLE_MS))
    }
    // Unconditionally: by the time this runs the keyboard may already report hidden while the
    // list is still on its way down.
    timers.push(setTimeout(onRemeasure, KEYBOARD_SETTLE_MS))
    const subscriptions = [
      Keyboard.addListener('keyboardDidHide', remeasureSoon),
      Keyboard.addListener('keyboardDidShow', remeasureSoon),
    ]
    return () => {
      subscriptions.forEach(subscription => subscription.remove())
      timers.forEach(clearTimeout)
    }
  }, [onRemeasure])

  useEffect(() => {
    // The Modal holding this copy reaches the screen a frame or two after it
    // mounts; hiding the original right away would blink the message out.
    // Waiting is invisible, since the copy opens exactly over the original.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => onLiftChange(true))
    })
    return () => {
      cancelAnimationFrame(frame)
      onLiftChange(false)
    }
  }, [onLiftChange])

  // The copy must not drive playback (claim it, register notes, report a grown one), so it sees no
  // controller; its media reads the chat's through `LiftedPlaybackContext` to mirror the original.
  const playback = useContext(MediaPlaybackContext)
  return (
    <MediaPlaybackContext.Provider value={null}>
      <LiftedPlaybackContext.Provider value={playback}>
        <View style={style}>
          {children}
        </View>
      </LiftedPlaybackContext.Provider>
    </MediaPlaybackContext.Provider>
  )
}
