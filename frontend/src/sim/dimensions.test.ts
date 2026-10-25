import { describe, expect, it } from 'vitest'
import { PRESENT_INDEX, STAGES, formatDuration, formatLight, roundTripYears } from './dimensions'

describe('dimensions', () => {
  it('runs from ten dimensions down to zero, one at a time', () => {
    expect(STAGES[0].dim).toBe(10)
    expect(STAGES[STAGES.length - 1].dim).toBe(0)
    STAGES.forEach((s, i) => {
      if (i > 0) expect(STAGES[i - 1].dim - s.dim).toBe(1)
    })
  })

  it('light never speeds up again', () => {
    STAGES.forEach((s, i) => {
      if (i > 0) expect(s.lightFactor).toBeLessThanOrEqual(STAGES[i - 1].lightFactor)
    })
  })

  it('marks our present at three dimensions', () => {
    expect(STAGES[PRESENT_INDEX].dim).toBe(3)
  })

  it('computes round trips between civilizations 100 light years apart', () => {
    expect(roundTripYears(STAGES[0])).toBe(0)
    expect(roundTripYears(STAGES[PRESENT_INDEX])).toBe(200)
    expect(roundTripYears(STAGES[STAGES.length - 1])).toBe(Infinity)
  })

  it('formats durations and light speeds for display', () => {
    expect(formatDuration(0)).toBe('瞬时')
    expect(formatDuration(Infinity)).toBe('永不抵达')
    expect(formatDuration(200)).toBe('200 年')
    expect(formatDuration(2)).toBe('2 年')
    expect(formatDuration(2e-5)).toMatch(/秒|小时/)
    expect(formatLight(STAGES[0])).toBe('近乎无限')
    expect(formatLight(STAGES[1])).toBe('今天的 10^7 倍')
  })
})
