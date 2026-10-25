import { describe, expect, it } from 'vitest'
import { MAX_FUEL, PLANS, WARNING_SECONDS, correct, createBunker, inShadow, phase, shadowHalfAngle, tick } from './bunker'

const run = (s: ReturnType<typeof createBunker>, seconds: number, step = 0.1) => {
  for (let t = 0; t < seconds; t += step) s = tick(s, step)
  return s
}

describe('bunker', () => {
  it('starts with every city in shadow and full fuel', () => {
    const s = createBunker(2)
    expect(s.cities.every((c) => inShadow(c, s.giants))).toBe(true)
    expect(s.fuel).toBe(MAX_FUEL)
  })

  it('cities drift out of shadow if nobody corrects them', () => {
    const s = run(createBunker(3), 60)
    expect(s.struck).toBe(true)
    expect(s.cities.some((c) => !c.alive)).toBe(true)
  })

  it('a correction recentres a city and costs fuel', () => {
    let s = run(createBunker(4), 10)
    const id = s.cities[0].id
    s = correct(s, id)
    expect(s.cities[0].offset).toBe(0)
    expect(s.fuel).toBeLessThan(MAX_FUEL)
  })

  it('warns before the strike', () => {
    const s0 = createBunker(5)
    expect(s0.strikeAt - s0.alertAt).toBe(WARNING_SECONDS)
    const s = run(s0, s0.alertAt + 0.5)
    expect(phase(s)).toBe('alert')
  })

  it('bigger planets cast wider shadows', () => {
    const s = createBunker(1)
    const j = s.giants.find((g) => g.id === 'jupiter')!
    const n = s.giants.find((g) => g.id === 'neptune')!
    expect(shadowHalfAngle(j)).toBeGreaterThan(shadowHalfAngle(n))
  })

  it('offers the three plans humanity weighed', () => {
    expect(PLANS.map((p) => p.id)).toEqual(['bunker', 'domain', 'lightspeed'])
  })
})
