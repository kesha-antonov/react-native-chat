import { dayItemId, isDayItem, withDayItems } from '../MessagesContainer/dayItems'
import { IMessage } from '../Models'

const USER = { _id: 1 }
const at = (day: number, hour: number) => new Date(2024, 0, day, hour)
const message = (id: number, createdAt?: Date): IMessage => ({ _id: id, text: '', createdAt: createdAt as Date, user: USER })

describe('withDayItems', () => {
  it('puts each day\'s date before its first message and lists where they are', () => {
    const { items, dayIndices } = withDayItems([
      message(1, at(1, 9)),
      message(2, at(1, 18)),
      message(3, at(2, 9)),
    ])
    expect(items.map(item => item._id)).toEqual([dayItemId(20240001), 1, 2, dayItemId(20240002), 3])
    expect(dayIndices).toEqual([0, 3])
    expect(isDayItem(items[0])).toBe(true)
    expect(isDayItem(items[1])).toBe(false)
  })

  // A message without a date opened no day before, and does not end the one it sits in.
  it('opens no day for a message without a date', () => {
    const { items, dayIndices } = withDayItems([message(1, at(1, 9)), message(2), message(3, at(1, 10))])
    expect(items.map(item => item._id)).toEqual([dayItemId(20240001), 1, 2, 3])
    expect(dayIndices).toEqual([0])
  })
})
