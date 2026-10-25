import { describe, expect, it } from 'vitest'
import { FLIGHT, createLamp, step, tally } from './lamp'

describe('dark forest lamp', () => {
  it('reveals what the lamp touches', () => {
    let s = createLamp(2)
    const p = s.points[0]
    s = step(s, 0.1, { x: p.x, y: p.y })
    expect(s.points[0].seen).toBe(true)
  })
  it('darkness reveals nothing and draws no attention', () => {
    let s = createLamp(3)
    for (let i = 0; i < 100; i++) s = step(s, 0.1, null)
    expect(tally(s).stars).toBe(0)
    expect(s.strikes).toBe(0)
  })
  it('keeping the lamp near a hunter brings a strike', () => {
    let s = createLamp(4)
    const h = s.points.find((p) => p.kind === 'hunter')!
    for (let i = 0; i < 80; i++) s = step(s, 0.1, { x: h.x, y: h.y })
    expect(s.strikes).toBeGreaterThan(0)
  })
  it('switching off before the strike lands saves you', () => {
    let s = createLamp(5)
    const h = s.points.find((p) => p.kind === 'hunter')!
    while (s.incoming === null) s = step(s, 0.05, { x: h.x, y: h.y })
    for (let t = 0; t < FLIGHT + 0.5; t += 0.05) s = step(s, 0.05, null)
    expect(s.strikes).toBe(0)
  })
})
