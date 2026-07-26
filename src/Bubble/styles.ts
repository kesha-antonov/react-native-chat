import { StyleSheet } from 'react-native'
import { Color } from '../Color'

const styles = StyleSheet.create({
  // Fills the message row so the pressable surface reaches the far edge, with
  // the bubble itself pinned to the sender's side.
  container: {
    flex: 1,
  },
  container_left: {
    alignItems: 'flex-start',
  },
  container_right: {
    alignItems: 'flex-end',
  },

  // Full-width band holding the bubble - this is what the reactions gesture is
  // attached to, so the whole row responds and not just the bubble.
  rowSurface: {
    alignSelf: 'stretch',
  },
  rowSurface_left: {
    alignItems: 'flex-start',
  },
  rowSurface_right: {
    alignItems: 'flex-end',
  },

  wrapper: {
    borderRadius: 15,
    minHeight: 20,
    maxWidth: '70%',
  },
  wrapper_left: {
    backgroundColor: Color.leftBubbleBackground,
    justifyContent: 'flex-end',
  },
  wrapper_right: {
    backgroundColor: Color.defaultBlue,
    justifyContent: 'flex-end',
  },

  bottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingBottom: 5,
  },

  containerToNext_left: {
    borderBottomLeftRadius: 3,
  },
  containerToNext_right: {
    borderBottomRightRadius: 3,
  },

  containerToPrevious_left: {
    borderTopLeftRadius: 3,
  },
  containerToPrevious_right: {
    borderTopRightRadius: 3,
  },

  messageTimeAndStatusContainer: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  messageStatusContainer: {
    flexDirection: 'row',
    marginLeft: 5,
  },
  messageStatus: {
    fontSize: 10,
    color: Color.white,
  },

  usernameContainer: {
    flexDirection: 'row',
    marginRight: 5,
  },
  username: {
    fontSize: 12,
    color: '#aaa',
  },
})

export default styles
