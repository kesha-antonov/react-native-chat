import {
  clipsDuration,
  clipsLevels,
  createClip,
  encodeWav,
  renderClips,
  trimClips,
} from '../components/voiceEditing'

describe('voiceEditing', () => {
  // Two clips of a resumed take: 2s then 3s, one amplitude per 100ms.
  const first = createClip('file:///cache/a.m4a', 2000, new Array(20).fill(0.2))
  const second = createClip('file:///cache/b.m4a', 3000, new Array(30).fill(0.8))

  it('adds the clips up into one timeline', () => {
    expect(clipsDuration([first, second])).toBe(5000)
    expect(clipsLevels([first, second])).toHaveLength(50)
  })

  it('keeps the whole take when the range covers it', () => {
    expect(trimClips([first, second], 0, 5000)).toEqual([first, second])
  })

  it('cuts a range that crosses two clips', () => {
    const kept = trimClips([first, second], 1500, 3000)

    expect(kept).toHaveLength(2)
    expect(kept[0]).toMatchObject({ uri: first.uri, startMs: 1500, endMs: 2000 })
    expect(kept[0].levels).toHaveLength(5)
    expect(kept[1]).toMatchObject({ uri: second.uri, startMs: 0, endMs: 1000 })
    expect(kept[1].levels).toHaveLength(10)
    expect(clipsDuration(kept)).toBe(1500)
  })

  it('drops a clip that falls outside the range', () => {
    const kept = trimClips([first, second], 2500, 4000)

    expect(kept).toHaveLength(1)
    expect(kept[0]).toMatchObject({ uri: second.uri, startMs: 500, endMs: 2000 })
  })

  it('trims an already trimmed take relative to what is left', () => {
    const once = trimClips([first, second], 1000, 4000)
    const twice = trimClips(once, 500, 1500)

    expect(twice).toHaveLength(2)
    expect(twice[0]).toMatchObject({ uri: first.uri, startMs: 1500, endMs: 2000 })
    expect(twice[1]).toMatchObject({ uri: second.uri, startMs: 0, endMs: 500 })
    expect(clipsDuration(twice)).toBe(1000)
  })

  it('sends a single untouched clip as it was recorded', async () => {
    await expect(renderClips([first])).resolves.toBe(first.uri)
  })

  it('writes mono 16-bit PCM WAV', () => {
    const bytes = encodeWav([new Float32Array([0, 1]), new Float32Array([-1])], 24000)
    const view = new DataView(bytes.buffer)
    const ascii = (at: number) => String.fromCharCode(...bytes.slice(at, at + 4))

    expect(bytes).toHaveLength(44 + 3 * 2)
    expect(ascii(0)).toBe('RIFF')
    expect(ascii(8)).toBe('WAVE')
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(24000)
    expect(view.getUint16(34, true)).toBe(16)
    expect(view.getUint32(40, true)).toBe(6)
    expect(view.getInt16(44, true)).toBe(0)
    expect(view.getInt16(46, true)).toBe(0x7fff)
    expect(view.getInt16(48, true)).toBe(-0x8000)
  })
})
