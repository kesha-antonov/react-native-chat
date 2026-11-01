import Animated from 'react-native-reanimated'
import { getFlashList } from '../optional'

// Optional high-performance list engine. Resolved through the optional-peer registry (`src/optional`) so
// the bundle works whether or not the consumer installed `@shopify/flash-list`
// (Metro treats try/catch-wrapped requires as optional dependencies).
const FlashListComponent = getFlashList()?.FlashList ?? null

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
