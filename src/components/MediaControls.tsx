import React, { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

export interface MediaIconProps {
  color?: string
  /** Icon height; defaults to 14. */
  size?: number
}

/** Right-pointing play triangle drawn with borders (no SVG dependency). */
export const PlayIcon = ({ color = '#fff', size = 14 }: MediaIconProps) => {
  const styles = useMemo(() => createPlayStyles(color, size), [color, size])
  return <View style={styles.triangle} />
}

/** Two-bar pause glyph. */
export const PauseIcon = ({ color = '#fff', size = 14 }: MediaIconProps) => {
  const styles = useMemo(() => createPauseStyles(color, size), [color, size])
  return (
    <View style={styles.row}>
      <View style={styles.bar} />
      <View style={styles.bar} />
    </View>
  )
}

const createPlayStyles = (color: string, size: number) => StyleSheet.create({
  triangle: {
    width: 0,
    height: 0,
    borderTopWidth: size / 2,
    borderBottomWidth: size / 2,
    borderLeftWidth: size * 0.85,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: color,
    // optical centering inside a circle
    marginLeft: size * 0.15,
  },
})

const createPauseStyles = (color: string, size: number) => StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  bar: {
    width: Math.max(2, size * 0.28),
    height: size,
    marginHorizontal: size * 0.1,
    borderRadius: 1,
    backgroundColor: color,
  },
})

/** An "X" close glyph drawn with two crossed bars. */
export const CloseIcon = ({ color = '#fff', size = 18 }: MediaIconProps) => {
  const styles = useMemo(() => createCloseStyles(color, size), [color, size])
  return (
    <View style={styles.wrapper}>
      <View style={styles.bar1} />
      <View style={styles.bar2} />
    </View>
  )
}

/** A chevron drawn with two borders. `direction` points it left or down. */
export const ChevronIcon = ({ color = '#fff', size = 14, direction = 'left' }: MediaIconProps & { direction?: 'left' | 'down' }) => {
  const styles = useMemo(() => createChevronStyles(color, size, direction), [color, size, direction])
  return <View style={styles.chevron} />
}

/** A "+" glyph drawn with two crossed bars. */
export const PlusIcon = ({ color = '#fff', size = 18 }: MediaIconProps) => {
  const styles = useMemo(() => createPlusStyles(color, size), [color, size])
  return (
    <View style={styles.wrapper}>
      <View style={styles.horizontal} />
      <View style={styles.vertical} />
    </View>
  )
}

/** A simple map-pin (teardrop head + inner dot) drawn with Views. */
export const PinIcon = ({ color = '#fff', size = 18 }: MediaIconProps) => {
  const styles = useMemo(() => createPinStyles(color, size), [color, size])
  return (
    <View style={styles.wrapper}>
      <View style={styles.head}>
        <View style={styles.hole} />
      </View>
      <View style={styles.point} />
    </View>
  )
}

/** Microphone glyph (capsule body + stand) drawn with Views. */
export const MicIcon = ({ color = '#fff', size = 22 }: MediaIconProps) => {
  const styles = useMemo(() => createMicStyles(color, size), [color, size])
  return (
    <View style={styles.wrapper}>
      <View style={styles.body} />
      <View style={styles.stem} />
      <View style={styles.base} />
    </View>
  )
}

/** Camera glyph (body + lens) drawn with Views. */
export const CameraIcon = ({ color = '#fff', size = 22 }: MediaIconProps) => {
  const styles = useMemo(() => createCameraStyles(color, size), [color, size])
  return (
    <View style={styles.body}>
      <View style={styles.lens} />
    </View>
  )
}

const createMicStyles = (color: string, size: number) => StyleSheet.create({
  wrapper: {
    width: size,
    height: size,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    width: size * 0.4,
    height: size * 0.56,
    borderRadius: size * 0.2,
    backgroundColor: color,
  },
  stem: {
    width: Math.max(2, size * 0.09),
    height: size * 0.16,
    backgroundColor: color,
  },
  base: {
    width: size * 0.5,
    height: Math.max(2, size * 0.09),
    borderRadius: 2,
    backgroundColor: color,
  },
})

const createCameraStyles = (color: string, size: number) => StyleSheet.create({
  body: {
    width: size,
    height: size * 0.72,
    borderRadius: size * 0.16,
    backgroundColor: color,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lens: {
    width: size * 0.34,
    height: size * 0.34,
    borderRadius: size * 0.17,
    borderWidth: Math.max(1.5, size * 0.08),
    borderColor: 'rgba(0,0,0,0.35)',
  },
})

const createCloseStyles = (color: string, size: number) => {
  const thickness = Math.max(1.5, Math.round(size * 0.12))
  const bar = {
    position: 'absolute' as const,
    width: size,
    height: thickness,
    borderRadius: thickness / 2,
    backgroundColor: color,
  }
  return StyleSheet.create({
    wrapper: {
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bar1: { ...bar, transform: [{ rotate: '45deg' }] },
    bar2: { ...bar, transform: [{ rotate: '-45deg' }] },
  })
}

const createChevronStyles = (color: string, size: number, direction: 'left' | 'down') => {
  const thickness = Math.max(1.5, Math.round(size * 0.16))
  return StyleSheet.create({
    chevron: {
      width: size * 0.6,
      height: size * 0.6,
      borderColor: color,
      borderRightWidth: thickness,
      borderBottomWidth: thickness,
      // 45deg points down; +90deg (135deg) rotates that chevron to point left.
      transform: [{ rotate: direction === 'down' ? '45deg' : '135deg' }],
    },
  })
}

const createPlusStyles = (color: string, size: number) => {
  const thickness = Math.max(2, Math.round(size * 0.14))
  return StyleSheet.create({
    wrapper: {
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
    },
    horizontal: {
      position: 'absolute',
      width: size,
      height: thickness,
      borderRadius: thickness / 2,
      backgroundColor: color,
    },
    vertical: {
      position: 'absolute',
      width: thickness,
      height: size,
      borderRadius: thickness / 2,
      backgroundColor: color,
    },
  })
}

const createPinStyles = (color: string, size: number) => {
  const head = size * 0.8
  return StyleSheet.create({
    wrapper: {
      width: size,
      height: size,
      alignItems: 'center',
    },
    head: {
      width: head,
      height: head,
      borderRadius: head / 2,
      backgroundColor: color,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hole: {
      width: head * 0.36,
      height: head * 0.36,
      borderRadius: head * 0.18,
      backgroundColor: 'rgba(0,0,0,0.25)',
    },
    point: {
      width: 0,
      height: 0,
      marginTop: -size * 0.18,
      borderLeftWidth: head * 0.28,
      borderRightWidth: head * 0.28,
      borderTopWidth: head * 0.42,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: color,
    },
  })
}

/** A smiley face (circle outline + eyes + mouth). */
export const EmojiIcon = ({ color = '#fff', size = 24 }: MediaIconProps) => {
  const styles = useMemo(() => createEmojiStyles(color, size), [color, size])
  return (
    <View style={styles.face}>
      <View style={styles.eyes}>
        <View style={styles.eye} />
        <View style={styles.eye} />
      </View>
      <View style={styles.mouth} />
    </View>
  )
}

/** A paperclip approximation: a rounded three-sided loop, tilted. */
export const PaperclipIcon = ({ color = '#fff', size = 24 }: MediaIconProps) => {
  const styles = useMemo(() => createClipStyles(color, size), [color, size])
  return (
    <View style={styles.wrapper}>
      <View style={styles.clip} />
    </View>
  )
}

/** A reply corner-arrow. */
export const ReplyArrowIcon = ({ color = '#fff', size = 20 }: MediaIconProps) => {
  const styles = useMemo(() => createReplyStyles(color, size), [color, size])
  return (
    <View style={styles.wrapper}>
      <View style={styles.arrow} />
      <View style={styles.line} />
    </View>
  )
}

/** A pencil (tilted body + tip). */
export const PencilIcon = ({ color = '#fff', size = 18 }: MediaIconProps) => {
  const styles = useMemo(() => createPencilStyles(color, size), [color, size])
  return (
    <View style={styles.wrapper}>
      <View style={styles.body} />
    </View>
  )
}

/** A padlock (body + shackle). */
export const LockIcon = ({ color = '#fff', size = 16 }: MediaIconProps) => {
  const styles = useMemo(() => createLockStyles(color, size), [color, size])
  return (
    <View style={styles.wrapper}>
      <View style={styles.shackle} />
      <View style={styles.body} />
    </View>
  )
}

/** A trash can (lid bar + body). */
export const TrashIcon = ({ color = '#fff', size = 18 }: MediaIconProps) => {
  const styles = useMemo(() => createTrashStyles(color, size), [color, size])
  return (
    <View style={styles.wrapper}>
      <View style={styles.lid} />
      <View style={styles.body} />
    </View>
  )
}

const createEmojiStyles = (color: string, size: number) => {
  const t = Math.max(1.5, Math.round(size * 0.08))
  return StyleSheet.create({
    face: {
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: t,
      borderColor: color,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eyes: {
      flexDirection: 'row',
      gap: size * 0.18,
      marginTop: -size * 0.06,
    },
    eye: {
      width: t,
      height: t,
      borderRadius: t,
      backgroundColor: color,
    },
    mouth: {
      width: size * 0.4,
      height: size * 0.2,
      marginTop: size * 0.04,
      borderBottomWidth: t,
      borderLeftWidth: t,
      borderRightWidth: t,
      borderColor: color,
      borderBottomLeftRadius: size * 0.2,
      borderBottomRightRadius: size * 0.2,
    },
  })
}

const createClipStyles = (color: string, size: number) => {
  const t = Math.max(1.5, Math.round(size * 0.09))
  return StyleSheet.create({
    wrapper: {
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clip: {
      width: size * 0.5,
      height: size * 0.78,
      borderWidth: t,
      borderColor: color,
      borderRadius: size * 0.25,
      borderBottomWidth: 0,
      transform: [{ rotate: '35deg' }],
    },
  })
}

const createReplyStyles = (color: string, size: number) => {
  const t = Math.max(1.5, Math.round(size * 0.12))
  return StyleSheet.create({
    wrapper: {
      width: size,
      height: size,
      justifyContent: 'center',
    },
    arrow: {
      position: 'absolute',
      left: 0,
      top: size * 0.28,
      width: size * 0.34,
      height: size * 0.34,
      borderLeftWidth: t,
      borderBottomWidth: t,
      borderColor: color,
      transform: [{ rotate: '45deg' }],
    },
    line: {
      position: 'absolute',
      left: size * 0.12,
      top: size * 0.46,
      width: size * 0.7,
      height: t,
      backgroundColor: color,
      borderRadius: t / 2,
    },
  })
}

const createPencilStyles = (color: string, size: number) => StyleSheet.create({
  wrapper: {
    width: size,
    height: size,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    width: size * 0.28,
    height: size * 0.86,
    backgroundColor: color,
    borderRadius: size * 0.06,
    transform: [{ rotate: '45deg' }],
  },
})

const createLockStyles = (color: string, size: number) => {
  const t = Math.max(1.5, Math.round(size * 0.12))
  return StyleSheet.create({
    wrapper: {
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shackle: {
      width: size * 0.5,
      height: size * 0.4,
      borderWidth: t,
      borderColor: color,
      borderBottomWidth: 0,
      borderTopLeftRadius: size * 0.25,
      borderTopRightRadius: size * 0.25,
      marginBottom: -t,
    },
    body: {
      width: size * 0.74,
      height: size * 0.5,
      borderRadius: size * 0.1,
      backgroundColor: color,
    },
  })
}

const createTrashStyles = (color: string, size: number) => {
  const t = Math.max(1.5, Math.round(size * 0.1))
  return StyleSheet.create({
    wrapper: {
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lid: {
      width: size * 0.7,
      height: t,
      backgroundColor: color,
      borderRadius: t / 2,
      marginBottom: t,
    },
    body: {
      width: size * 0.56,
      height: size * 0.6,
      borderWidth: t,
      borderColor: color,
      borderTopWidth: 0,
      borderBottomLeftRadius: size * 0.12,
      borderBottomRightRadius: size * 0.12,
    },
  })
}
