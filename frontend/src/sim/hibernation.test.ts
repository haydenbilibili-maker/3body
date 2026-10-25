import { describe, expect, it } from 'vitest'
import { PEOPLE, STATIONS, alive, elapsed, formatYears, summary } from './hibernation'

describe('hibernation', () => {
  it('ends after the last waking', () => {
    expect(STATIONS[STATIONS.length - 1].canSleep).toBe(false)
  })
  it('accumulates the years skipped', () => {
    expect(elapsed(0)).toBe(0)
    expect(elapsed(1)).toBe(202)
  })
  it('people fall away one by one', () => {
    expect(alive(PEOPLE[0], 1, null)).toBe(false)
    expect(alive(PEOPLE[1], 1, null)).toBe(true)
    expect(alive(PEOPLE[1], 2, null)).toBe(false)
    expect(alive(PEOPLE[2], 1, null)).toBe(false)
  })
  it('a companion who sleeps with you is still there', () => {
    expect(alive(PEOPLE[2], 5, 'love')).toBe(true)
    expect(summary(5, 'love').left).toEqual(['母亲', '最好的朋友'])
  })
  it('formats deep time', () => {
    expect(formatYears(18_900_350)).toBe('1,890 万年')
    expect(formatYears(205)).toBe('205 年')
  })
})
