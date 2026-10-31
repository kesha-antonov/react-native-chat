// Optional haptics. Resolved through a try/catch require so the bundle works
// whether or not the consumer installed `expo-haptics`.
let expoHaptics: any = null
try {
  expoHaptics = require('expo-haptics')
} catch {
  expoHaptics = null
}

/** An impact tick, or nothing when `expo-haptics` is missing. Never throws. */
export const impactHaptic = (style: 'Light' | 'Medium' | 'Heavy' = 'Light') => {
  try {
    const result = expoHaptics?.impactAsync?.(expoHaptics?.ImpactFeedbackStyle?.[style])
    result?.catch?.(() => {})
  } catch {
    // haptics are a nicety; never fail an interaction over them
  }
}

/** The selection tick (`UISelectionFeedbackGenerator`), or nothing. Never throws. */
export const selectionHaptic = () => {
  try {
    const result = expoHaptics?.selectionAsync?.()
    result?.catch?.(() => {})
  } catch {
    // haptics are a nicety; never fail an interaction over them
  }
}
