import { StyleSheet } from 'react-native'

import { ChatTheme } from '../../Theme'
import { LOCK_OFFSET, LOCK_WIDTH, ONCE_GAP, ONCE_SIZE } from './constants'

export const createStyles = (theme: ChatTheme) => StyleSheet.create({
  container: {
    // Matches Send's wrapper so the mic and the send button share a baseline -
    // otherwise the control jumps 4pt the moment the first character is typed.
    minHeight: theme.composer.minHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    width: theme.sendButton.size,
    height: theme.sendButton.size,
    borderRadius: theme.radii.sendButton,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  modeIcon: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockPill: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -LOCK_WIDTH / 2,
    marginTop: -LOCK_OFFSET,
    width: LOCK_WIDTH,
    borderRadius: LOCK_WIDTH / 2,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.inputFieldBorder,
    alignItems: 'center',
    overflow: 'hidden',
    zIndex: 4,
  },
  // The top 36pt of the pill: the padlock, later the pause bars.
  lockSlot: {
    width: LOCK_WIDTH,
    height: LOCK_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockSlotOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeButton: {
    position: 'absolute',
    bottom: theme.sendButton.size + 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.inputFieldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  lockColor: {
    color: theme.colors.placeholder,
  },
  onceButton: {
    position: 'absolute',
    width: ONCE_SIZE,
    height: ONCE_SIZE,
    borderRadius: ONCE_SIZE / 2,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.inputFieldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  // Above the lock pill, which is 36 tall once locked.
  onceLocked: {
    top: '50%',
    marginTop: -LOCK_OFFSET - ONCE_GAP - ONCE_SIZE,
  },
  // Previewing, above the resume button.
  oncePreview: {
    bottom: theme.sendButton.size + 12 + 34 + ONCE_GAP,
  },
  onceBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.placeholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onceBadgeOn: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent,
  },
  onceText: {
    color: theme.colors.placeholder,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
  onceTextOn: {
    color: '#fff',
  },
  tooltip: {
    position: 'absolute',
    right: 0,
    maxWidth: 240,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    zIndex: 5,
  },
  // Beside the lock, pointing at it.
  lockTooltip: {
    top: '50%',
    marginTop: -LOCK_OFFSET + 6,
    right: 44,
    width: 160,
  },
  pauseTooltip: {
    top: '50%',
    marginTop: -LOCK_OFFSET,
    right: 44,
    width: 160,
  },
  onceTooltip: {
    top: '50%',
    marginTop: -LOCK_OFFSET - ONCE_GAP - ONCE_SIZE,
    right: 44,
    width: 180,
  },
  onceTooltipPreview: {
    bottom: theme.sendButton.size + 12 + 34 + ONCE_GAP,
    right: 44,
    width: 180,
  },
  tooltipBold: {
    fontWeight: '700',
  },
  hintTooltip: {
    bottom: theme.sendButton.size + 10,
    width: 240,
  },
  tooltipText: {
    color: '#fff',
    fontSize: 13,
  },
})

export type RecordButtonStyles = ReturnType<typeof createStyles>
