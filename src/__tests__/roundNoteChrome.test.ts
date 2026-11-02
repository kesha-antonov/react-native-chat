import {
  RING_EDGE_INSET,
  RING_PAUSED_INSET,
  RING_PLAYING_INSET,
  angleToFraction,
  isSeekTouch,
  isWrap,
  knobPoint,
  overshoot,
  pausedAmount,
  ringRadius,
} from '../components/roundNoteChrome'

describe('round note chrome geometry', () => {
  it('overshoots past 1 before settling, like OvershootInterpolator', () => {
    expect(overshoot(0)).toBe(0)
    expect(overshoot(1)).toBe(1)
    expect(overshoot(0.7)).toBeGreaterThan(1)
  })

  it('only overshoots on the way into a pause', () => {
    expect(pausedAmount(0.7, 1)).toBeGreaterThan(1)
    expect(pausedAmount(0.7, 0)).toBe(0.7)
  })

  it('insets the ring from the edge, further while grown and paused', () => {
    expect(ringRadius(200, 0, 0)).toBe(100 - RING_EDGE_INSET)
    expect(ringRadius(200, 1, 0)).toBe(100 - RING_EDGE_INSET - RING_PLAYING_INSET)
    expect(ringRadius(200, 1, 1)).toBe(100 - RING_EDGE_INSET - RING_PLAYING_INSET - RING_PAUSED_INSET)
  })

  it('places the knob clockwise from 12 o\'clock', () => {
    const top = knobPoint(200, 80, 0)
    expect(top.x).toBeCloseTo(100)
    expect(top.y).toBeCloseTo(20)
    const right = knobPoint(200, 80, 0.25)
    expect(right.x).toBeCloseTo(180)
    expect(right.y).toBeCloseTo(100)
  })

  it('maps touches back to the same playhead', () => {
    expect(angleToFraction(200, 100, 0)).toBeCloseTo(0)
    expect(angleToFraction(200, 200, 100)).toBeCloseTo(0.25)
    expect(angleToFraction(200, 100, 200)).toBeCloseTo(0.5)
    expect(angleToFraction(200, 0, 100)).toBeCloseTo(0.75)
  })

  it('starts a scrub on the knob or the outer band, not in the middle', () => {
    const knob = knobPoint(200, 70, 0)
    // On the moved-in knob, which sits inside the outer band.
    expect(isSeekTouch(200, knob, knob.x + 15, knob.y + 15)).toBe(true)
    // In the outer band, away from the knob.
    expect(isSeekTouch(200, knob, 100, 190)).toBe(true)
    // The middle stays a tap.
    expect(isSeekTouch(200, knob, 100, 100)).toBe(false)
  })

  it('treats a jump of most of the circle as a wrap past 12 o\'clock', () => {
    expect(isWrap(0.98, 0.02)).toBe(true)
    expect(isWrap(0.4, 0.5)).toBe(false)
  })
})

describe('isCameraControlError', () => {
   
  const { isCameraControlError } = require('../components/visionCamera')

  it('treats a failed zoom or torch call as non-fatal', () => {
    expect(isCameraControlError(new Error('androidx.camera.core.CameraControl$OperationCanceledException: Camera is not active.'))).toBe(true)
    expect(isCameraControlError(new Error('java.lang.IllegalStateException: No flash unit'))).toBe(true)
  })

  it('keeps a real camera failure fatal', () => {
    expect(isCameraControlError(new Error('No camera available'))).toBe(false)
    expect(isCameraControlError(new Error('Camera session failed to configure'))).toBe(false)
    expect(isCameraControlError(undefined)).toBe(false)
  })
})
