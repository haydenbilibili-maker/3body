import { describe, expect, it } from 'vitest'
import { climate, createField, step } from './gravity'

describe('home gravity field', () => {
  it('integrates without blowing up', () => {
    const f = createField()
    for (let i = 0; i < 5000; i++) step(f, 0.01)
    for (const s of f.suns) expect(Number.isFinite(s.x) && Math.abs(s.x) < 50).toBe(true)
    expect(Math.hypot(f.planet.x, f.planet.y)).toBeLessThanOrEqual(6.5)
  })
  it('a held sun stays put', () => {
    const f = createField()
    const x = f.suns[0].x
    for (let i = 0; i < 100; i++) step(f, 0.01, 0)
    expect(Math.abs(f.suns[0].x - x)).toBeLessThan(0.05)
  })
  it('classifies the sky', () => {
    const f = createField()
    f.suns = [{ x: 0, y: 0, vx: 0, vy: 0, m: 1 }, { x: 30, y: 0, vx: 0, vy: 0, m: 1 }, { x: -30, y: 0, vx: 0, vy: 0, m: 1 }]
    f.planet.x = 1.5
    f.planet.y = 0
    expect(climate(f).kind).toBe('stable')
    f.planet.x = 0.05
    expect(climate(f).kind).toBe('scorched')
    f.planet.x = 15
    expect(['frozen', 'chaos']).toContain(climate(f).kind)
  })
})
