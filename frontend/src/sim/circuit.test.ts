import { describe, expect, it } from 'vitest'
import { circuit, dimensionAt, distanceFor } from './circuit'

describe('sophon circuit', () => {
  it('grows from the centre without overlapping', () => {
    const segs = circuit(40, 24, 3)
    expect(segs.length).toBeGreaterThan(50)
    const ends = new Set(segs.map((s) => `${s.x2},${s.y2}`))
    expect(ends.size).toBe(segs.length)
    for (const s of segs) expect(Math.abs(s.x2 - s.x1) + Math.abs(s.y2 - s.y1)).toBe(1)
  })
  it('stays inside the grid', () => {
    for (const s of circuit(20, 12, 5)) {
      expect(s.x2 >= 0 && s.x2 < 20 && s.y2 >= 0 && s.y2 < 12).toBe(true)
    }
  })
  it('maps the drag to dimensions', () => {
    expect(dimensionAt(0)).toBe(11)
    expect(dimensionAt(1)).toBe(2)
    expect(dimensionAt(1.2)).toBe(1)
    expect(dimensionAt(0.5)).toBeLessThan(11)
    for (let n = 1; n <= 11; n++) expect(dimensionAt(distanceFor(n))).toBe(n)
  })
})
