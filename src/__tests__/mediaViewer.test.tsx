import { createMediaGallery } from '../components/mediaViewer/gallery'
import { IMessage } from '../Models'

const USER = { _id: 2, name: 'Alice' }
const message = (id: number, image?: string): IMessage =>
  ({ _id: id, text: '', createdAt: new Date(2024, 0, 1, 12, id), user: USER, image })

describe('media gallery', () => {
  // `Chat` holds its messages newest first; the viewer pages oldest first, as Telegram's does.
  const messages = [message(5, 'e'), message(4), message(3, 'c'), message(2, 'b'), message(1)]

  it('lists the photo messages oldest first', () => {
    const gallery = createMediaGallery()
    gallery.setMessages(messages)
    expect(gallery.getItems().map(item => item._id)).toEqual([2, 3, 5])
  })

  it('opens and closes on a message', () => {
    const gallery = createMediaGallery()
    const listener = jest.fn()
    gallery.openId.subscribe(listener)
    gallery.open(3)
    expect(gallery.openId.get()).toBe(3)
    gallery.close()
    expect(gallery.openId.get()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
