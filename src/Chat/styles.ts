import { StyleSheet } from 'react-native'

export default StyleSheet.create({
  fill: {
    flex: 1,
  },
  contentContainer: {
    overflow: 'hidden',
  },
  hidden: {
    opacity: 0,
  },
  // The composer under the selection bar: still mounted, out of layout.
  composerAway: {
    display: 'none',
  },
  // Centers the empty-chat card in the list's area, above the composer.
  emptyOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
})
