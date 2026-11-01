import { getExpoHaptics } from '../optional'

// Optional haptics (`expo-haptics`), resolved on the first tick.

/** An impact tick, or nothing when `expo-haptics` is missing. Never throws. */
export const impactHaptic = (style: 'Light' | 'Medium' | 'Heavy' = 'Light') => {
  try {
    const expoHaptics = getExpoHaptics()
    const result = expoHaptics?.impactAsync?.(expoHaptics?.ImpactFeedbackStyle?.[style])
    result?.catch?.(() => {})
  } catch {
    // haptics are a nicety; never fail an interaction over them
  }
}

/** The selection tick (`UISelectionFeedbackGenerator`), or nothing. Never throws. */
export const selectionHaptic = () => {
  try {
    const expoHaptics = getExpoHaptics()
    const result = expoHaptics?.selectionAsync?.()
    result?.catch?.(() => {})
  } catch {
    // haptics are a nicety; never fail an interaction over them
  }
}
