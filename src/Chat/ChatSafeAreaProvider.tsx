import React, { useContext, useLayoutEffect, useRef, useState } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import {
  Metrics,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context'

type Frame = Metrics['frame']

const ZERO_INSETS = { top: 0, left: 0, right: 0, bottom: 0 }

/**
 * The insets a provider at `frame` will measure: whatever part of the window's safe area the
 * frame still overlaps. A chat under a navigator header starts below the top inset, and a chat
 * above a tab bar ends above the home indicator, so both come out 0 there.
 */
export const insetsForFrame = (
  frame: Frame,
  window: { height: number },
  windowInsets: { top: number, bottom: number }
) => ({
  ...ZERO_INSETS,
  top: Math.max(0, windowInsets.top - frame.y),
  bottom: Math.max(0, windowInsets.bottom - (window.height - (frame.y + frame.height))),
})

/**
 * Chat's own SafeAreaProvider, seeded with the insets it is about to measure.
 *
 * react-native-safe-area-context only knows a nested provider's insets after the native view
 * has been laid out, so the first frame runs on `initialMetrics`. Any fixed seed is wrong
 * somewhere: zero dropped the composer onto the home indicator for a frame in a full-screen
 * chat (it then jumped up by the inset while the screen slid in), and the window's insets did
 * the opposite under a header or above a tab bar. The chat's place in the window is known
 * before anything is painted - a layout effect can measure synchronously - so the seed is
 * computed from that, and the native measurement then confirms it instead of moving anything.
 */
export function ChatSafeAreaProvider ({ children }: { children: React.ReactNode }) {
  const parentInsets = useContext(SafeAreaInsetsContext)
  const ref = useRef<React.ComponentRef<typeof View>>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)

  useLayoutEffect(() => {
    if (metrics)
      return

    let isSettled = false
    ref.current?.measureInWindow?.((x, y, width, height) => {
      // A platform that answers asynchronously (web) already got the fallback below, and the
      // provider only reads `initialMetrics` when it mounts.
      if (isSettled)
        return

      isSettled = true
      const frame = { x, y, width, height }
      const windowInsets = {
        top: Math.max(parentInsets?.top ?? 0, initialWindowMetrics?.insets.top ?? 0),
        bottom: Math.max(parentInsets?.bottom ?? 0, initialWindowMetrics?.insets.bottom ?? 0),
      }
      setMetrics({ frame, insets: insetsForFrame(frame, Dimensions.get('window'), windowInsets) })
    })

    if (!isSettled) {
      isSettled = true
      setMetrics({
        frame: initialWindowMetrics?.frame ?? { x: 0, y: 0, width: 0, height: 0 },
        insets: ZERO_INSETS,
      })
    }
  }, [metrics, parentInsets])

  return (
    <View ref={ref} style={styles.fill} collapsable={false}>
      {metrics && (
        <SafeAreaProvider initialMetrics={metrics}>
          {children}
        </SafeAreaProvider>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
})
