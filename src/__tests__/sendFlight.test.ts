import {
  SEND_FLIGHT_EXPECT_MS,
  abandonSendFlight,
  expectSendFlight,
  finishSendFlight,
  isSendFlightExpected,
  landSendFlight,
  onSendFlightFinished,
  onSendFlightTarget,
  resetSendFlights,
} from '../components/sendFlight'

const voiceTarget = { x: 40, y: 500, radius: 22, color: '#fff' }

describe('sendFlight', () => {
  beforeEach(() => resetSendFlights())

  it('refuses a landing nobody expects', () => {
    expect(isSendFlightExpected('voice')).toBe(false)
    expect(landSendFlight('voice', voiceTarget)).toBe(false)
  })

  it('hands an expected target to the source, once', () => {
    const onTarget = jest.fn()
    onSendFlightTarget('voice', onTarget)
    expectSendFlight('voice', 1000)
    expect(isSendFlightExpected('voice', 1200)).toBe(true)

    expect(landSendFlight('voice', voiceTarget, 1200)).toBe(true)
    expect(onTarget).toHaveBeenCalledWith(voiceTarget)
    // A second message (or a remount) does not steal the flight.
    expect(landSendFlight('voice', voiceTarget, 1300)).toBe(false)
    expect(isSendFlightExpected('voice', 1300)).toBe(false)
  })

  it('replays a target that landed before the source subscribed', () => {
    expectSendFlight('round', 0)
    const target = { x: 10, y: 20, size: 200 }
    expect(landSendFlight('round', target, 10)).toBe(true)
    const onTarget = jest.fn()
    onSendFlightTarget('round', onTarget)
    expect(onTarget).toHaveBeenCalledWith(target)
  })

  it('expires an expectation', () => {
    expectSendFlight('voice', 0)
    expect(landSendFlight('voice', voiceTarget, SEND_FLIGHT_EXPECT_MS + 1)).toBe(false)
  })

  it('refuses a late landing once the source has given up', () => {
    expectSendFlight('voice', 0)
    abandonSendFlight('voice')
    expect(landSendFlight('voice', voiceTarget, 10)).toBe(false)
  })

  it('tells the target when the flight lands, and only the right kind', () => {
    const onVoice = jest.fn()
    const onRound = jest.fn()
    onSendFlightFinished('voice', onVoice)
    onSendFlightFinished('round', onRound)
    expectSendFlight('voice', 0)
    landSendFlight('voice', voiceTarget, 10)

    finishSendFlight('voice')
    expect(onVoice).toHaveBeenCalledTimes(1)
    expect(onRound).not.toHaveBeenCalled()
    // Listeners are one-shot.
    finishSendFlight('voice')
    expect(onVoice).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes', () => {
    const onTarget = jest.fn()
    const off = onSendFlightTarget('voice', onTarget)
    off()
    expectSendFlight('voice', 0)
    landSendFlight('voice', voiceTarget, 10)
    expect(onTarget).not.toHaveBeenCalled()
  })
})
