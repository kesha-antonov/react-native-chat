import Animated from 'react-native-reanimated'

// Optional high-performance list engine. Resolved through a try/catch require so
// the bundle works whether or not the consumer installed `@shopify/flash-list`
// (Metro treats try/catch-wrapped requires as optional dependencies).
let flashList: any = null
try {
  flashList = require('@shopify/flash-list')
} catch {
  flashList = null
}

const FlashListComponent = flashList?.FlashList ?? null

export const isFlashListAvailable = !!FlashListComponent

/**
 * FlashList wrapped by Reanimated so the messages container can keep driving the
 * floating day header and the scroll-to-bottom button from a single
 * `useAnimatedScrollHandler`, exactly like it does with FlatList.
 * `null` when `@shopify/flash-list` is not installed.
 */
export const AnimatedFlashList: any = FlashListComponent
  ? Animated.createAnimatedComponent(FlashListComponent)
  : null
