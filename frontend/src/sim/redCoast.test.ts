import { describe, expect, it } from 'vitest'
import { ALIGNED_AT, ALPHA_CEN_LY, LAUNCH_YEAR, REPLY_LINES, TRAVEL_BEATS, alignment, beatsUntil, transmit, travelAt } from './redCoast'

describe('red coast', () => {
  it('scores perfect alignment at 100 and drops with distance', () => {
    expect(alignment(180, 60, 180, 60)).toBe(100)
    expect(alignment(170, 60, 180, 60)).toBe(50)
    expect(alignment(0, 0, 180, 60)).toBe(0)
    expect(alignment(180.5, 60, 180, 60)).toBeGreaterThanOrEqual(ALIGNED_AT)
  })

  it('only a sun-amplified, aligned signal reaches another star', () => {
    expect(transmit(true, true)).toBe('reaches')
    expect(transmit(true, false)).toBe('fades')
    expect(transmit(false, true)).toBe('fades')
  })

  it('takes two light crossings to hear back', () => {
    expect(travelAt(0)).toEqual({ year: LAUNCH_YEAR, position: 0, returning: false })
    expect(travelAt(0.5).position).toBe(1)
    const end = travelAt(1)
    expect(end.position).toBe(0)
    expect(Math.abs(end.year - (LAUNCH_YEAR + 2 * ALPHA_CEN_LY))).toBeLessThan(1e-9)
    expect(Math.floor(end.year)).toBe(1979)
  })

  it('reveals story beats in order as the signal travels', () => {
    expect(beatsUntil(0)).toHaveLength(1)
    expect(beatsUntil(1)).toHaveLength(TRAVEL_BEATS.length)
  })

  it('carries the warning in the reply', () => {
    expect(REPLY_LINES.some((l) => l.includes('不要回答'))).toBe(true)
  })
})
