import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useLabels } from '../hooks/useLabels'
import { useThemedStyles } from '../hooks/useTheme'
import { ChatTheme } from '../Theme'
import { Icon } from './Icon'

/**
 * The "Unread Messages" bar: a full-width strip above the
 * first message you have not read, with the label in the middle and a small down arrow at the
 * right.
 */
export function UnreadSeparator () {
  const styles = useThemedStyles(createStyles)
  const labels = useLabels()

  return (
    <View style={styles.cell} testID='unread-separator' accessibilityRole='header'>
      <View style={styles.bar}>
        <View style={styles.arrow}>
          <Icon name='chevronDown' size={18} color={styles.arrowColor.color} fallback={null} />
        </View>
      </View>
      <Text style={styles.text} numberOfLines={1}>{labels.unreadMessages}</Text>
    </View>
  )
}

// A 40dp cell; the bar is 27 tall, 7 from the top, full width; the label is 14dp
// bold, centered in the cell with 32 either side; the arrow sits 10 from the right edge.
const createStyles = (theme: ChatTheme) => StyleSheet.create({
  cell: {
    height: 40,
    justifyContent: 'center',
    marginBottom: 2,
  },
  bar: {
    position: 'absolute',
    top: 7,
    left: 0,
    right: 0,
    height: 27,
    justifyContent: 'center',
    alignItems: 'flex-end',
    backgroundColor: theme.colors.unreadSeparatorBackground,
    // `newmsg_divider` has a hairline shadow along both edges.
    boxShadow: '0 0.5px 0.5px rgba(0, 0, 0, 0.08)',
  },
  arrow: {
    marginRight: 10,
    paddingTop: 2,
  },
  arrowColor: {
    color: theme.colors.unreadSeparatorArrow,
  },
  text: {
    marginHorizontal: 32,
    paddingBottom: 1,
    alignSelf: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.unreadSeparatorText,
  },
})
