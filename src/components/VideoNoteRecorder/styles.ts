import { StyleSheet } from 'react-native'

import { CONTROLS_HEIGHT } from './constants'

export const styles = StyleSheet.create({
  // Dim, not black: the conversation stays visible behind the recorder.
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    // Reserve the control strip so the circle centres in the space above it
    // rather than sitting under the shutter and the status bar.
    paddingBottom: CONTROLS_HEIGHT,
  },
  ringWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  round: {
    overflow: 'hidden',
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  placeholderText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  // Everything below the circle, pinned to the bottom of the screen.
  controls: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
    gap: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // White pill holding the flip / flash controls.
  utilityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  utilityButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  utilityColor: {
    color: '#1C1C1E',
  },
  pauseButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  // Red dot + tenths timer + centred CANCEL, in one white bar.
  statusBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  recDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#FF3B30',
    marginRight: 10,
  },
  statusTime: {
    width: 56,
    fontSize: 15,
    color: '#1C1C1E',
    fontVariant: ['tabular-nums'],
  },
  cancelWrap: {
    flex: 1,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#3390EC',
  },
  // Mirrors `statusTime` so CANCEL is centred against the bar, not the free space.
  statusSpacer: {
    width: 56,
  },
  sendButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3390EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Pre-recording state: the hold-to-record shutter and its hint.
  shutterRow: {
    flex: 1,
    alignItems: 'center',
    gap: 12,
  },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E74C3C',
  },
  recordButtonDisabled: {
    opacity: 0.4,
  },
  // Slid past the cancel threshold: the shutter reads as destructive.
  recordButtonCancelArmed: {
    borderColor: '#E74C3C',
  },
  closeButton: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
})
