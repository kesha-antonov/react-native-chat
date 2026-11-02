// Demo photos, served by Unsplash's image CDN. picsum.photos answers "Geoblocked" (403) in some
// regions, which left the demo's photos, link previews and photo avatars blank there.
const PHOTOS = {
  abstract: '1626785774573-4b799315345d',
  beach: '1507525428034-b723cf961d3e',
  cat: '1514888286974-6c03e2ca1dba',
  code: '1461749280684-dccba630e2f6',
  designTools: '1561070791-2526d30994b5',
  designSketch: '1558655146-9f40138edfeb',
  fog: '1470071459604-3b5ec3a7fe05',
  hiking: '1551632811-561732d1e306',
  lake: '1501785888041-af3ef285b470',
  laptop: '1498050108023-c5249f4df085',
  mountain: '1464822759023-fed622ff2c3b',
  mountains: '1506905925346-21bda4d32df4',
  night: '1519681393784-d120267933ba',
  phone: '1512941937669-90a1b58e7e9c',
  phoneApps: '1551650975-87deedd944c3',
  sunset: '1495616811223-4d98c6e9c869',
} as const

export type DemoPhoto = keyof typeof PHOTOS

/** A demo photo, cropped to `width` x `height`. */
export const photo = (name: DemoPhoto, width = 800, height = 600) =>
  `https://images.unsplash.com/photo-${PHOTOS[name]}?w=${width}&h=${height}&fit=crop&auto=format&q=70`

/** A demo face, for avatars. */
export const face = (index: number, size = 200) => `https://i.pravatar.cc/${size}?img=${index}`
