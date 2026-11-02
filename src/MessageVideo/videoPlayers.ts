import { getExpoVideo } from '../optional'

// Optional inline player. Resolved through the optional-peer registry (`src/optional`) so the bundle
// works whether or not the consumer installed `expo-video` - Metro treats
// try/catch-wrapped requires as optional dependencies and won't fail the build
// when the module is absent. When present, messages render a real inline
// player; otherwise they fall back to a tappable MediaCard.
export const expoVideo = getExpoVideo()

export const isExpoVideoAvailable = !!(expoVideo?.VideoView && expoVideo?.useVideoPlayer)
// Round notes create their players directly, so a playing one can outlive its
// row (see roundNotePlayers.ts).
export const isRoundNotePlayerAvailable = isExpoVideoAvailable && !!expoVideo?.createVideoPlayer

// The player is a native handle shared across rows, not React state: it is written through
// here so the compiler does not take these writes for mutations of a render value.
export const setPlayer = (player: any, props: Record<string, unknown>) => {
  Object.assign(player, props)
}

// Outside the component: the compiler cannot yet lower `||` inside a `try`.
export const playerTime = (player: any): number => {
  try {
    return player.currentTime || 0
  } catch {
    return 0
  }
}

// Inline (not round) video players, by message, so the long-press copy of a message shows the
// player its original is playing instead of a fresh one stopped at the start.
export const inlineVideoPlayers = new Map<string, unknown>()

export const videoPlayerKey = (messageId: string | number | undefined, uri: string) =>
  messageId != null ? `${String(messageId)}\u0000${uri}` : undefined
