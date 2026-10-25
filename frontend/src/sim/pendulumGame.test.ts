import { describe, expect, it } from 'vitest'
import { AGES, FIRST_CIV, GROWTH_PER_DAY, SWITCH_DAYS, ageOf, createCiv, liveDay, order } from './pendulumGame'
import { advanceDay, classify, createSystem, flux, forecast } from './threeBody'

describe('pendulum civilization', () => {
  it('grows only while hydrated in a stable era', () => {
    let s = { ...createCiv(), hydrated: true }
    s = liveDay(s, 'stable')
    expect(s.progress).toBe(GROWTH_PER_DAY)
    s = order(s, false)
    for (let i = 0; i < SWITCH_DAYS; i += 1) s = liveDay(s, 'stable')
    expect(s.hydrated).toBe(false)
    const p = s.progress
    s = liveDay(s, 'stable')
    expect(s.progress).toBe(p)
  })

  it('a hydrated civilization falls in chaos; a dehydrated one survives', () => {
    let s = liveDay({ ...createCiv(), hydrated: true }, 'heat')
    expect(s.civ).toBe(FIRST_CIV + 1)
    expect(s.fallen[0].cause).toBe('heat')
    expect(s.hydrated).toBe(false)
    const before = s.civ
    s = liveDay(s, 'cold')
    expect(s.civ).toBe(before)
  })

  it('starts dehydrated, and switching takes time', () => {
    expect(createCiv().hydrated).toBe(false)
    let s = order(createCiv(), true)
    s = liveDay(s, 'stable')
    expect(s.hydrated).toBe(false)
    expect(s.pending?.days).toBe(SWITCH_DAYS - 1)
    s = liveDay(s, 'stable')
    expect(s.hydrated).toBe(true)
  })

  it('reaches the information age at full progress', () => {
    let s = { ...createCiv(), hydrated: true }
    while (!s.won) s = liveDay(s, 'stable')
    expect(ageOf(s.progress)).toBe(AGES[AGES.length - 1])
  })
})

describe('three-body sky', () => {
  it('produces all three eras and keeps the suns bound', () => {
    const sys = createSystem(3)
    const seen = new Set<string>()
    for (let d = 0; d < 300; d += 1) {
      advanceDay(sys)
      seen.add(classify(flux(sys)))
      for (const sun of sys.suns) expect(Math.hypot(sun.x, sun.y)).toBeLessThan(15)
    }
    expect(seen.size).toBe(3)
  })

  it('forecasts the right number of days', () => {
    expect(forecast(createSystem(1), 14)).toHaveLength(14)
  })
})
