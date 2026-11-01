/**
 * Telegram's chat wallpaper gradient, ported from `Utilities.generateGradient`
 * (`TMessagesProj/jni/image.cpp:1091-1200`): four colors placed at four of eight fixed spots,
 * each pixel swirled around the centre and then colored by inverse-distance weights. Telegram
 * renders it into a 60x80 bitmap and lets the GPU scale it up; this does the same into an
 * uncompressed PNG, so React Native's `Image` can draw it with no dependency.
 */
import { parseColor } from '../colorUtils'

export const WALLPAPER_WIDTH = 60
export const WALLPAPER_HEIGHT = 80
export const WALLPAPER_PHASES = 8

// The eight spots, `image.cpp:1131`; y is flipped when they are gathered.
const POSITIONS: Array<[number, number]> = [
  [0.80, 0.10],
  [0.60, 0.20],
  [0.35, 0.25],
  [0.25, 0.60],
  [0.20, 0.90],
  [0.40, 0.80],
  [0.65, 0.75],
  [0.75, 0.40],
]

/** Where the four colors sit in a phase: color `i` at spot `(phase + 2i) mod 8` (`gatherPositions`). */
export function gatherPositions (phase: number): Array<[number, number]> {
  const result: Array<[number, number]> = []
  for (let i = 0; i < 4; i += 1) {
    const [x, y] = POSITIONS[(((phase + i * 2) % 8) + 8) % 8]
    result.push([x, 1 - y])
  }
  return result
}

/**
 * The gradient's pixels as RGB bytes, row by row. `progress` moves the colors from the
 * previous phase's spots (`phase + 1`) to this one's, as Telegram animates a step.
 */
export function generateWallpaperPixels (
  colors: string[],
  phase: number,
  progress = 1,
  width = WALLPAPER_WIDTH,
  height = WALLPAPER_HEIGHT
): Uint8Array {
  const parsed = colors.slice(0, 4).map(color => parseColor(color) ?? { r: 0, g: 0, b: 0, a: 1 })
  const count = parsed.length
  const pixels = new Uint8Array(width * height * 3)
  if (count === 0)
    return pixels

  const previous = gatherPositions((phase + 1) % 8)
  const current = gatherPositions(phase)
  const spots = previous.map(([px, py], i) => [
    px + (current[i][0] - px) * progress,
    py + (current[i][1] - py) * progress,
  ])

  let offset = 0
  for (let y = 0; y < height; y += 1) {
    const centerDistanceY = y / height - 0.5
    for (let x = 0; x < width; x += 1) {
      const centerDistanceX = x / width - 0.5
      const centerDistance = Math.sqrt(centerDistanceX * centerDistanceX + centerDistanceY * centerDistanceY)
      const swirlFactor = 0.35 * centerDistance
      const theta = swirlFactor * swirlFactor * 0.8 * 8
      const sinTheta = Math.sin(theta)
      const cosTheta = Math.cos(theta)
      const pixelX = Math.max(0, Math.min(1, 0.5 + centerDistanceX * cosTheta - centerDistanceY * sinTheta))
      const pixelY = Math.max(0, Math.min(1, 0.5 + centerDistanceX * sinTheta + centerDistanceY * cosTheta))

      let distanceSum = 0
      let r = 0
      let g = 0
      let b = 0
      for (let i = 0; i < count; i += 1) {
        const distanceX = pixelX - spots[i][0]
        const distanceY = pixelY - spots[i][1]
        let distance = Math.max(0, 0.9 - Math.sqrt(distanceX * distanceX + distanceY * distanceY))
        distance = distance * distance * distance * distance
        distanceSum += distance
        r += distance * parsed[i].r
        g += distance * parsed[i].g
        b += distance * parsed[i].b
      }

      const scale = distanceSum > 0 ? 1 / distanceSum : 0
      pixels[offset] = Math.round(r * scale)
      pixels[offset + 1] = Math.round(g * scale)
      pixels[offset + 2] = Math.round(b * scale)
      offset += 3
    }
  }

  return pixels
}

let crcTable: Uint32Array | null = null
const getCrcTable = () => {
  if (crcTable)
    return crcTable

  crcTable = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1)
      c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    crcTable[n] = c >>> 0
  }
  return crcTable
}

const crc32 = (bytes: Uint8Array, start: number, end: number) => {
  const table = getCrcTable()
  let crc = 0xFFFFFFFF
  for (let i = start; i < end; i += 1)
    crc = table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

const writeUint32 = (bytes: Uint8Array, offset: number, value: number) => {
  bytes[offset] = (value >>> 24) & 0xFF
  bytes[offset + 1] = (value >>> 16) & 0xFF
  bytes[offset + 2] = (value >>> 8) & 0xFF
  bytes[offset + 3] = value & 0xFF
}

/** An RGB image as a PNG with a stored (uncompressed) deflate stream - small images only. */
export function encodePng (pixels: Uint8Array, width: number, height: number): Uint8Array {
  const rowLength = width * 3 + 1
  const raw = new Uint8Array(rowLength * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * rowLength] = 0
    raw.set(pixels.subarray(y * width * 3, (y + 1) * width * 3), y * rowLength + 1)
  }

  // zlib: header, stored blocks of at most 65535 bytes, Adler-32.
  const blockCount = Math.max(1, Math.ceil(raw.length / 65535))
  const zlib = new Uint8Array(2 + raw.length + blockCount * 5 + 4)
  zlib[0] = 0x78
  zlib[1] = 0x01
  let zOffset = 2
  for (let block = 0; block < blockCount; block += 1) {
    const start = block * 65535
    const length = Math.min(65535, raw.length - start)
    zlib[zOffset] = block === blockCount - 1 ? 1 : 0
    zlib[zOffset + 1] = length & 0xFF
    zlib[zOffset + 2] = (length >>> 8) & 0xFF
    zlib[zOffset + 3] = ~length & 0xFF
    zlib[zOffset + 4] = (~length >>> 8) & 0xFF
    zlib.set(raw.subarray(start, start + length), zOffset + 5)
    zOffset += 5 + length
  }
  let a = 1
  let b = 0
  for (let i = 0; i < raw.length; i += 1) {
    a = (a + raw[i]) % 65521
    b = (b + a) % 65521
  }
  writeUint32(zlib, zOffset, ((b << 16) | a) >>> 0)

  const chunks: Array<[string, Uint8Array]> = []
  const header = new Uint8Array(13)
  writeUint32(header, 0, width)
  writeUint32(header, 4, height)
  header[8] = 8 // bit depth
  header[9] = 2 // truecolor RGB
  chunks.push(['IHDR', header], ['IDAT', zlib], ['IEND', new Uint8Array(0)])

  const total = 8 + chunks.reduce((sum, [, data]) => sum + 12 + data.length, 0)
  const png = new Uint8Array(total)
  png.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0)
  let offset = 8
  for (const [type, data] of chunks) {
    writeUint32(png, offset, data.length)
    for (let i = 0; i < 4; i += 1)
      png[offset + 4 + i] = type.charCodeAt(i)
    png.set(data, offset + 8)
    writeUint32(png, offset + 8 + data.length, crc32(png, offset + 4, offset + 8 + data.length))
    offset += 12 + data.length
  }

  return png
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function toBase64 (bytes: Uint8Array): string {
  let out = ''
  let i = 0
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]
    out += BASE64[(n >>> 18) & 63] + BASE64[(n >>> 12) & 63] + BASE64[(n >>> 6) & 63] + BASE64[n & 63]
  }
  const rest = bytes.length - i
  if (rest === 1) {
    const n = bytes[i] << 16
    out += BASE64[(n >>> 18) & 63] + BASE64[(n >>> 12) & 63] + '=='
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8)
    out += BASE64[(n >>> 18) & 63] + BASE64[(n >>> 12) & 63] + BASE64[(n >>> 6) & 63] + '='
  }
  return out
}

const cache = new Map<string, string>()

/** The gradient for a phase as a `data:` URI, cached per color set and phase. */
export function getWallpaperUri (colors: string[], phase: number): string {
  const normalized = ((phase % WALLPAPER_PHASES) + WALLPAPER_PHASES) % WALLPAPER_PHASES
  const key = `${colors.join(',')}|${normalized}`
  let uri = cache.get(key)
  if (!uri) {
    const pixels = generateWallpaperPixels(colors, normalized)
    uri = `data:image/png;base64,${toBase64(encodePng(pixels, WALLPAPER_WIDTH, WALLPAPER_HEIGHT))}`
    cache.set(key, uri)
  }
  return uri
}
