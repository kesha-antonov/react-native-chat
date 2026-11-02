import React from 'react'
import { View } from 'react-native'
import { act, fireEvent, render as renderPlain } from '@testing-library/react-native'

import { Chat, LoadEarlierMessages } from '..'
import { MessageStatus } from '../components/MessageStatus'
import { arcPath, radialFrame, transitionDuration } from '../components/RadialProgress'
import { spinnerFrame } from '../components/Spinner'
import { WaveformPlayer } from '../components/WaveformPlayer'
import { MessageFile } from '../MessageFile'
import { MessageImage } from '../MessageImage'
import { IMessage } from '../Models'
import { render } from './renderWithGestureRoot'
import { waitForRows } from './waitForRows'

jest.mock('react-native-reanimated', () => {
  const {
    createJSReanimatedModule,
  } = require('react-native-reanimated/src/ReanimatedModule/js-reanimated/JSReanimated')
  Object.getPrototypeOf(createJSReanimatedModule()).setCSSEventHandler = () => {}

  const { useRef } = require('react')
  const mock = require('react-native-reanimated/mock')
  return {
    ...mock,
    __esModule: true,
    useSharedValue: (init: unknown) => {
      const ref = useRef(null)
      if (!ref.current)
        ref.current = mock.useSharedValue(init)
      return ref.current
    },
  }
})

jest.mock('react-native-audio-api', () => ({
  AudioContext: function AudioContext (this: any) {
    this.currentTime = 0
    this.destination = {}
    this.decodeAudioData = () => Promise.resolve({
      duration: 12,
      getChannelData: () => new Float32Array(1200).fill(0.5),
    })
    this.createBufferSource = () => ({ playbackRate: { value: 1 }, connect: jest.fn(), start: jest.fn(), stop: jest.fn() })
    this.close = jest.fn()
  },
}), { virtual: true })

const mountChat = async (ui: React.ReactElement) => {
  jest
    .spyOn(View.prototype as unknown as { measureInWindow: unknown }, 'measureInWindow' as never)
    .mockImplementation(((callback: (x: number, y: number) => void) => callback(0, 0)) as never)
  const utils = await renderPlain(ui)
  await fireEvent(utils.getByTestId('GC_WRAPPER'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
  })
  await waitForRows()
  return utils
}

const PLAY = 0
const DOWNLOAD = 2
const CANCEL = 3
const NONE = 4

const user = { _id: 1 }
const other = { _id: 2 }
const base = { text: '', createdAt: new Date(2024, 0, 1, 12, 0), user: other }

describe('RadialProgress geometry', () => {
  it('uses the loading transition lengths', () => {
    expect(transitionDuration('download', 'cancel')).toBe(400)
    expect(transitionDuration('play', 'pause')).toBe(300)
    expect(transitionDuration('cancel', 'play')).toBe(220)
    expect(transitionDuration('cancel', 'none')).toBe(220)
  })

  it('draws the download arrow at rest and nothing else', () => {
    const frame = radialFrame(DOWNLOAD, DOWNLOAD, 1, 1, 0, 0, 48, false)
    expect(frame.arrow).not.toBe('')
    expect(frame.arrowAlpha).toBe(1)
    expect(frame.arc).toBe('')
    expect(frame.glyphAlpha).toBe(0)
  })

  it('draws the cancel cross with at least a 4-degree arc, growing with progress', () => {
    const empty = radialFrame(CANCEL, CANCEL, 1, 1, 0, 112, 48, false)
    expect(empty.cross).not.toBe('')
    expect(empty.crossAlpha).toBe(1)
    expect(empty.arc).not.toBe('')

    // The arc of a 48 drawable is inset 4: radius 20 around the centre.
    expect(empty.arc).toContain('A20 20')
    const half = radialFrame(CANCEL, CANCEL, 1, 1, 0.5, 0, 48, false)
    // 180 degrees from 3 o'clock ends at 9 o'clock.
    expect(half.arc.trim().endsWith('4 24')).toBe(true)
  })

  it('shrinks the cross and grows the play glyph from cancel to play', () => {
    const mid = radialFrame(CANCEL, PLAY, 0.5, 1, 1, 0, 44, false)
    expect(mid.glyphScale).toBeCloseTo(0.5)
    expect(mid.glyphAlpha).toBeCloseTo(0.5)
    expect(mid.crossAlpha).toBeCloseTo(1)
    const late = radialFrame(CANCEL, PLAY, 0.9, 1, 1, 0, 44, false)
    expect(late.crossAlpha).toBeCloseTo(0.2)
  })

  it('fades the cross out to no icon', () => {
    const mid = radialFrame(CANCEL, NONE, 0.25, 1, 1, 0, 48, false)
    expect(mid.crossAlpha).toBeCloseTo(0.75)
    expect(mid.arcAlpha).toBeCloseTo(0.75)
  })

  it('gives the strokes and arc as numbers for drawing without react-native-svg', () => {
    const arrow = radialFrame(DOWNLOAD, DOWNLOAD, 1, 1, 0, 0, 48, false)
    // The stem and the two strokes of the head.
    expect(arrow.arrowLines).toHaveLength(12)
    const cancel = radialFrame(CANCEL, CANCEL, 1, 1, 0.25, 112, 48, false)
    expect(cancel.crossLines).toHaveLength(8)
    expect(cancel.arcStart).toBe(112)
    expect(cancel.arcSweep).toBe(90)
    expect(cancel.arcRadius).toBe(20)
  })

  it('draws the ring and the cross from views when react-native-svg is missing', async () => {
    const { RadialProgress } = jest.requireActual('../components/RadialProgress')
    const { toJSON } = await renderPlain(<RadialProgress icon='cancel' progress={0.5} color='#fff' />)
    const tree = JSON.stringify(toJSON())
    // The two half rings, and the cross's two strokes.
    expect(tree.match(/"borderTopColor":"#fff"/g)).toHaveLength(2)
    expect(tree.match(/"backgroundColor":"#fff"/g)?.length).toBeGreaterThanOrEqual(5)
  })

  it('never lets a full ring collapse into a dot', () => {
    const ring = arcPath(24, 24, 20, 20, 90, 360)
    // Two half arcs, ending back where they started.
    expect(ring.match(/A/g)).toHaveLength(2)
    expect(ring.startsWith('M24 44')).toBe(true)
    expect(ring.trim().endsWith('24 44')).toBe(true)
  })
})

describe('Spinner', () => {
  it('breathes between 4 and 270 degrees in 500ms phases', () => {
    expect(spinnerFrame(0).sweep).toBeCloseTo(4)
    expect(spinnerFrame(499.99).sweep).toBeCloseTo(270, 0)
    expect(spinnerFrame(500).sweep).toBeCloseTo(-266)
    expect(spinnerFrame(999.99).sweep).toBeCloseTo(4, 0)
  })

  it('turns once every 2 seconds, jumping 270 degrees as the arc starts to shrink', () => {
    expect(spinnerFrame(0).start).toBe(0)
    expect(spinnerFrame(500).start).toBeCloseTo((90 + 270) % 360)
  })
})

describe('loading earlier messages (ChatLoadingCell)', () => {
  it('ends the list in a service spinner instead of a button with infinite scroll', async () => {
    const { getByTestId, queryByText } = await renderPlain(
      <LoadEarlierMessages isAvailable isLoading={false} isInfiniteScrollEnabled onPress={() => {}} />
    )
    expect(getByTestId('service-spinner')).toBeTruthy()
    expect(queryByText('Load earlier messages')).toBeNull()
  })

  it('swaps the button for the spinner while loading', async () => {
    const { getByTestId } = await renderPlain(<LoadEarlierMessages isAvailable isLoading onPress={() => {}} />)
    expect(getByTestId('service-spinner')).toBeTruthy()
  })

  it('keeps the button when loading on tap', async () => {
    const { getByText, queryByTestId } = await render(<LoadEarlierMessages isAvailable isLoading={false} onPress={() => {}} />)
    expect(getByText('Load earlier messages')).toBeTruthy()
    expect(queryByTestId('service-spinner')).toBeNull()
  })
})

describe('Chat isLoading', () => {
  it('shows the centred spinner over an empty chat instead of the empty card', async () => {
    const { getByTestId, queryByTestId } = await mountChat(
      <Chat messages={[]} onSend={() => {}} user={user} isLoading />
    )
    expect(getByTestId('chat-loading')).toBeTruthy()
    expect(queryByTestId('chat-empty')).toBeNull()
  })

  it('does not cover messages that are already there', async () => {
    const { queryByTestId } = await mountChat(
      <Chat messages={[{ _id: 1, ...base, text: 'hi' }]} onSend={() => {}} user={user} isLoading />
    )
    expect(queryByTestId('chat-loading')).toBeNull()
  })
})

describe('MessageStatus', () => {
  it('draws the animated clock while sending', async () => {
    const { getByTestId } = await renderPlain(<MessageStatus status='pending' color='#000' errorColor='red' />)
    expect(getByTestId('pending-clock')).toBeTruthy()
  })

  it('moves on to the check, then the red badge', async () => {
    const { getByTestId, rerender } = await renderPlain(<MessageStatus status='pending' color='#000' errorColor='red' />)
    await rerender(<MessageStatus status='sent' color='#000' errorColor='red' />)
    expect(getByTestId('message-status-sent')).toBeTruthy()
    await rerender(<MessageStatus status='failed' color='#000' errorColor='red' />)
    expect(getByTestId('message-status-error-badge')).toBeTruthy()
  })
})

describe('media transfer', () => {
  // The photo's press goes through gesture-handler's BaseButton, which has no Jest mock, so
  // these check what is drawn rather than pressing.
  it('photo: an upload shows the cancel ring and size pill', async () => {
    const message: IMessage = {
      _id: 'p',
      ...base,
      image: 'file:///photo.jpg',
      transfer: { type: 'upload', progress: 0.5, totalBytes: 2 * 1024 * 1024 },
    }
    const { getByTestId, getByText, getByLabelText } = await mountChat(
      <Chat messages={[message]} onSend={() => {}} user={user} />
    )
    expect(getByTestId('media-info-pill')).toBeTruthy()
    expect(getByText('1.0 MB / 2.0 MB')).toBeTruthy()
    expect(getByLabelText('cancel upload')).toBeTruthy()
  })

  it('photo: one that waits for a tap shows the download arrow and does not load', async () => {
    const message: IMessage = { _id: 'd', ...base, image: 'https://example.com/a.jpg', isDownloadRequired: true }
    const { getByLabelText, queryByTestId } = await render(<MessageImage currentMessage={message} />)
    expect(getByLabelText('download photo')).toBeTruthy()
    expect(queryByTestId('message-image')).toBeNull()
  })

  it('photo: a remote image loads behind the ring, and a failed one offers a retry', async () => {
    const message: IMessage = { _id: 'r', ...base, image: 'https://example.com/b.jpg' }
    const { getByLabelText, getByTestId } = await render(<MessageImage currentMessage={message} />)
    expect(getByLabelText('cancel download')).toBeTruthy()
    expect(getByTestId('message-image-placeholder')).toBeTruthy()

    await fireEvent(getByTestId('message-image'), 'error')
    expect(getByLabelText('download photo')).toBeTruthy()
  })

  it('photo: a loaded image drops the ring', async () => {
    const message: IMessage = { _id: 'l', ...base, image: 'https://example.com/c.jpg' }
    const { getByTestId, queryByLabelText } = await render(<MessageImage currentMessage={message} />)
    await fireEvent(getByTestId('message-image'), 'load')
    expect(queryByLabelText('cancel download')).toBeNull()
  })

  it('file: a download shows "loaded / total" in place of the size', async () => {
    const message: IMessage = {
      _id: 'f',
      ...base,
      file: { uri: 'https://example.com/r.pdf', name: 'r.pdf', size: 4 * 1024 * 1024 },
      transfer: { type: 'download', progress: 0.25 },
    }
    const { getByText } = await render(<MessageFile currentMessage={message} />)
    expect(getByText('1.0 MB / 4.0 MB')).toBeTruthy()
  })

  it('voice: an app-driven download shows the cancel button; the arrow asks the app', async () => {
    const onDownload = jest.fn()
    const downloading: IMessage = { _id: 'v1', ...base, audio: 'https://example.com/v.m4a', transfer: { type: 'download', progress: 0.3 } }
    const { getByLabelText, rerender } = await mountChat(
      <Chat messages={[downloading]} onSend={() => {}} user={user} mediaTransfer={{ onDownload }} />
    )
    expect(getByLabelText('cancel download')).toBeTruthy()

    const waiting: IMessage = { _id: 'v1', ...base, audio: 'https://example.com/v.m4a', isDownloadRequired: true }
    await rerender(<Chat messages={[waiting]} onSend={() => {}} user={user} mediaTransfer={{ onDownload }} />)
    await fireEvent.press(getByLabelText('download'))
    expect(onDownload).toHaveBeenCalledWith(expect.objectContaining({ _id: 'v1' }))
  })

  it('voice: a remote note fetches itself with progress, then turns to play', async () => {
    const requests: any[] = []
    const OriginalXHR = global.XMLHttpRequest
    // @ts-expect-error a minimal stand-in
    global.XMLHttpRequest = function XHR (this: any) {
      this.open = jest.fn()
      this.send = jest.fn()
      this.abort = jest.fn()
      requests.push(this)
    }
    try {
      const { getByLabelText } = await render(
        <WaveformPlayer uri='https://example.com/note.mp3' position='left' duration={12} />
      )
      expect(requests).toHaveLength(1)
      expect(getByLabelText('cancel download')).toBeTruthy()

      await act(async () => {
        requests[0].onprogress({ lengthComputable: true, loaded: 50, total: 100 })
        requests[0].status = 200
        requests[0].response = new ArrayBuffer(8)
        requests[0].onload()
      })
      expect(getByLabelText('play')).toBeTruthy()
    } finally {
      global.XMLHttpRequest = OriginalXHR
    }
  })

  it('voice: cancelling the fetch leaves the download arrow, which fetches again', async () => {
    const requests: any[] = []
    const OriginalXHR = global.XMLHttpRequest
    // @ts-expect-error a minimal stand-in
    global.XMLHttpRequest = function XHR (this: any) {
      this.open = jest.fn()
      this.send = jest.fn()
      this.abort = jest.fn()
      requests.push(this)
    }
    try {
      const { getByLabelText } = await render(
        <WaveformPlayer uri='https://example.com/note.mp3' position='left' duration={12} />
      )
      await fireEvent.press(getByLabelText('cancel download'))
      expect(requests[0].abort).toHaveBeenCalled()
      expect(getByLabelText('download')).toBeTruthy()

      await fireEvent.press(getByLabelText('download'))
      expect(requests).toHaveLength(2)
    } finally {
      global.XMLHttpRequest = OriginalXHR
    }
  })
})
