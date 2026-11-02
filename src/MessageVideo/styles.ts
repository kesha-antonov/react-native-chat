import { StyleSheet } from 'react-native'
import { ROUND_TRANSCRIBE_SIZE } from '../components/roundNoteChrome'

export const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  // A round note floats without bubble chrome (the Bubble strips its
  // background). It must not clip: a playing note shifts past its row.
  noteContainer: {
    overflow: 'visible',
  },
  noteLeft: {
    alignSelf: 'flex-start',
  },
  noteRight: {
    alignSelf: 'flex-end',
  },
  video: {
    width: 220,
    height: 140,
    borderRadius: 12,
    margin: 6,
    // Dark placeholder so the bubble reads as a video while the first frame
    // loads, instead of flashing a white void.
    backgroundColor: '#000',
  },
  note: {
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  // Drawn above the avatar when shifted over it while playing.
  noteWrapper: {
    zIndex: 1,
  },
  videoOverlay: {
    margin: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  noteButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteColumnLeft: {
    alignItems: 'flex-start',
  },
  noteColumnRight: {
    alignItems: 'flex-end',
  },
  transcribe: {
    position: 'absolute',
    width: ROUND_TRANSCRIBE_SIZE,
    height: ROUND_TRANSCRIBE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcribeBackground: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: ROUND_TRANSCRIBE_SIZE / 2,
  },
  transcription: {
    borderRadius: 16,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
})
