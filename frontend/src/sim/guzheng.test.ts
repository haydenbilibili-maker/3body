import { describe, expect, it } from 'vitest'
import { CREW, passChance, run, slices, successRate } from './guzheng'

describe('guzheng', () => {
  it('nothing gets through a mesh finer than itself', () => {
    expect(passChance(1.7, 1)).toBe(0)
    expect(Math.abs(passChance(0.3, 3) - 0.9) < 1e-9).toBe(true)
  })
  it('counts the slices', () => {
    expect(slices(0.5)).toBe(60)
  })
  it('a very fine mesh kills everyone but often cuts the drive too', () => {
    const r = run(0.2, 3)
    expect(r.survivors).toBe(0)
    expect(successRate(0.2)).toBeLessThan(successRate(0.4))
  })
  it('a coarse mesh leaves survivors who may wipe the data', () => {
    const r = run(3, 3)
    expect(r.survivors).toBeGreaterThan(CREW / 4)
    expect(successRate(3)).toBeLessThan(successRate(0.6))
  })
  it('the best spacing is somewhere around half a metre', () => {
    const rates = [0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1, 1.5, 2].map((s) => [s, successRate(s)] as const)
    const best = rates.reduce((a, b) => (b[1] > a[1] ? b : a))
    expect(best[0]).toBeGreaterThanOrEqual(0.3)
    expect(best[0]).toBeLessThanOrEqual(1)
  })
})
