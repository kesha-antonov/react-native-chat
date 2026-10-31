import {
  DEFAULT_FLOATING_DOCK,
  FLOATING_NOTE_MARGIN,
  FLOATING_NOTE_SIZE,
  clampDrag,
  dockPoint,
  dragAlpha,
  settleFloatingNote,
} from '../components/floatingNoteMath'
import { claimPlayback, createMediaPlaybackController, stopAllPlayback } from '../components/mediaPlayback'
import { NotePlayer, createNotePlayerCache, detachRoundNote } from '../components/roundNotePlayers'

const area = { width: 400, height: 800 }
const size = FLOATING_NOTE_SIZE
const rightX = area.width - size - FLOATING_NOTE_MARGIN
const bottomY = area.height - size - FLOATING_NOTE_MARGIN

const fakePlayer = (): NotePlayer & { listeners: Map<string, () => void> } => {
  const listeners = new Map<string, () => void>()
  const player = {
    listeners,
    playing: false,
    muted: true,
    loop: false,
    currentTime: 3,
    playbackRate: 1,
    duration: 10,
    play: jest.fn(() => {
      player.playing = true
    }),
    pause: jest.fn(() => {
      player.playing = false
    }),
    release: jest.fn(),
    addListener: jest.fn((event: string, listener: () => void) => {
      listeners.set(event, listener)
      return { remove: () => listeners.delete(event) }
    }),
  }
  return player
}

describe('floating round note geometry', () => {
  it('docks top right, 10pt from the edges, by default', () => {
    expect(dockPoint(DEFAULT_FLOATING_DOCK, area)).toEqual({ x: rightX, y: FLOATING_NOTE_MARGIN })
  })

  it('keeps a free position as a fraction across the area', () => {
    const point = dockPoint({ sideX: 'free', px: 0.5, sideY: 'free', py: 0.5 }, area)
    expect(point.x).toBe(Math.round((area.width - size - 20) * 0.5) + 10)
    expect(point.y).toBe(Math.round((area.height - size - 20) * 0.5) + 10)
  })

  it('lets a drag pass a side by half its width, never the top or bottom', () => {
    expect(clampDrag(-500, -50, area)).toEqual({ x: -size / 2, y: 0 })
    expect(clampDrag(5000, 5000, area)).toEqual({ x: area.width - size / 2, y: area.height - size })
  })

  it('fades down to half at the furthest it may go past a side', () => {
    expect(dragAlpha(50, area.width)).toBe(1)
    expect(dragAlpha(-size / 2, area.width)).toBe(0.5)
    expect(dragAlpha(area.width - size / 2, area.width)).toBe(0.5)
  })

  it('snaps to a side within 20pt and to the top or bottom within 20pt', () => {
    const left = settleFloatingNote(25, 300, 0, area, DEFAULT_FLOATING_DOCK)
    expect(left).toMatchObject({ x: FLOATING_NOTE_MARGIN, y: 300, isClosing: false })
    expect(left.dock).toMatchObject({ sideX: 'start', sideY: 'free' })

    const bottomRight = settleFloatingNote(rightX - 15, bottomY + 15, 0, area, DEFAULT_FLOATING_DOCK)
    expect(bottomRight).toMatchObject({ x: rightX, y: bottomY })
    expect(bottomRight.dock).toEqual({ sideX: 'end', px: 0, sideY: 'end', py: 0 })
  })

  it('stays where it is put in between', () => {
    const settle = settleFloatingNote(150, 300, 0, area, DEFAULT_FLOATING_DOCK)
    expect(settle).toMatchObject({ x: 150, y: 300, isClosing: false })
    expect(settle.dock.sideX).toBe('free')
    expect(settle.dock.px).toBeCloseTo((150 - 10) / (rightX - 10))
  })

  it('snaps back when less than a quarter past a side', () => {
    expect(settleFloatingNote(-size / 4 + 1, 300, 0, area, DEFAULT_FLOATING_DOCK).isClosing).toBe(false)
  })

  it('slides out and closes when dragged further past a side, keeping the old dock', () => {
    const dock = { sideX: 'start' as const, px: 0, sideY: 'start' as const, py: 0 }
    const settle = settleFloatingNote(-size / 2, 300, 0, area, dock)
    expect(settle).toMatchObject({ x: -size, isClosing: true })
    expect(settle.dock).toBe(dock)

    expect(settleFloatingNote(area.width - size / 2, 300, 0, area, dock)).toMatchObject({ x: area.width, isClosing: true })
  })

  it('closes on a fling off a side from mid-screen', () => {
    expect(settleFloatingNote(200, 300, 3000, area, DEFAULT_FLOATING_DOCK).isClosing).toBe(true)
    expect(settleFloatingNote(200, 300, 300, area, DEFAULT_FLOATING_DOCK).isClosing).toBe(false)
  })
})

describe('round note player cache', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    stopAllPlayback()
  })

  it('creates once per key and releases after its last row, past the grace period', () => {
    const cache = createNotePlayerCache(100)
    const player = fakePlayer()
    const create = jest.fn(() => player)

    expect(cache.get('a', create)).toBe(player)
    expect(cache.get('a', create)).toBe(player)
    expect(create).toHaveBeenCalledTimes(1)

    cache.retain('a')
    cache.release('a')
    // Strict effects: mounted straight back.
    cache.retain('a')
    jest.advanceTimersByTime(200)
    expect(player.release).not.toHaveBeenCalled()

    cache.release('a')
    jest.advanceTimersByTime(200)
    expect(player.release).toHaveBeenCalled()
  })

  it('keeps a current note past its row', () => {
    const cache = createNotePlayerCache(100)
    const player = fakePlayer()
    cache.get('a', () => player)
    cache.retain('a')
    cache.keep('a', true)
    cache.release('a')
    jest.advanceTimersByTime(500)
    expect(player.release).not.toHaveBeenCalled()

    cache.keep('a', false)
    jest.advanceTimersByTime(500)
    expect(player.release).toHaveBeenCalled()
  })

  it('releases a player created by a render that never committed', () => {
    const cache = createNotePlayerCache(100)
    const player = fakePlayer()
    cache.get('a', () => player)
    jest.advanceTimersByTime(200)
    expect(player.release).toHaveBeenCalled()
  })
})

describe('detached round note', () => {
  afterEach(() => {
    stopAllPlayback()
  })

  const setUp = () => {
    const cache = createNotePlayerCache(100)
    const player = fakePlayer()
    cache.get('a', () => player)
    cache.keep('a', true)
    player.playing = true
    const report = jest.fn()
    const onEnded = jest.fn()
    const rateListeners = new Set<(rate: number) => void>()
    const detached = detachRoundNote('a', player, true, {
      cache,
      claim: claimPlayback,
      unclaim: jest.fn(),
      getRate: () => 1.5,
      subscribeRate: listener => {
        rateListeners.add(listener)
        return () => rateListeners.delete(listener)
      },
      report,
      onEnded,
    })
    return { cache, player, report, onEnded, detached, rateListeners }
  }

  it('keeps reporting and toggles the same player', () => {
    const { player, report } = setUp()
    expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ isPlaying: true }))

    report.mock.lastCall[0].toggle()
    expect(player.pause).toHaveBeenCalled()
    expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ isPlaying: false }))

    report.mock.lastCall[0].toggle()
    expect(player.play).toHaveBeenCalled()
    expect(player.playbackRate).toBe(1.5)
  })

  it('ends when another note starts', () => {
    const { player, report, cache } = setUp()
    claimPlayback('other', jest.fn())
    expect(report).toHaveBeenLastCalledWith(null)
    expect(player.pause).toHaveBeenCalled()
    expect(cache.takeDetached('a')).toBeNull()
  })

  it('hands over to the next note on its natural end', () => {
    const { player, report, onEnded } = setUp()
    player.listeners.get('playToEnd')?.()
    expect(report).toHaveBeenLastCalledWith(null)
    expect(onEnded).toHaveBeenCalled()
  })

  it('goes back to its row, which learns whether it was playing', () => {
    const { cache, report, rateListeners } = setUp()
    const detached = cache.takeDetached('a')
    expect(detached?.adopt()).toBe(true)
    expect(rateListeners.size).toBe(0)
    report.mockClear()
    // Another note starting no longer touches it: the row owns it now.
    claimPlayback('other', jest.fn())
    expect(report).not.toHaveBeenCalled()
  })

  it('ends with the chat', () => {
    const { cache, report } = setUp()
    cache.setActive(false)
    expect(report).toHaveBeenLastCalledWith(null)
    expect(cache.isActive()).toBe(false)
  })
})

describe('message viewability', () => {
  it('is unknown until the list reports, then tracks the rows on screen', () => {
    const controller = createMediaPlaybackController()
    const listener = jest.fn()
    controller.subscribeViewable(listener)

    expect(controller.isMessageViewable(1)).toBeUndefined()
    controller.setViewableMessages([1, 2])
    expect(controller.isMessageViewable(1)).toBe(true)
    expect(controller.isMessageViewable(3)).toBe(false)
    expect(listener).toHaveBeenCalledTimes(1)

    controller.setViewableMessages([2, 1])
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
