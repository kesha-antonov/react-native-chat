import { createContext } from 'react'
import Animated, { AnimatedRef } from 'react-native-reanimated'

/**
 * The emoji boxes of a message's reaction pills, by reaction key, so the long-press overlay can
 * land a picked reaction on its own pill. Only the message in the list provides one: the lifted
 * copy in the overlay draws the same pills and must not replace them.
 */
export type ReactionPillRefs = Map<string, AnimatedRef<Animated.View>>

export const ReactionPillRefsContext = createContext<ReactionPillRefs | null>(null)
