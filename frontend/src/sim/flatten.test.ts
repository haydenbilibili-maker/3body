import { describe, expect, it } from 'vitest'
import { LAYERS, flatExtent, slices } from './flatten'

describe('flatten', () => {
  it('stacks layers into the original square while three-dimensional', () => {
    const s = slices(240, false)
    expect(s).toHaveLength(LAYERS)
    expect(s.every((x) => x.x === 0)).toBe(true)
    expect(s.at(-1)!.y).toBe(240 - 240 / LAYERS)
  })
  it('lays every layer side by side once flat', () => {
    const s = slices(240, true)
    expect(s.every((x) => x.y === 0)).toBe(true)
    expect(s.at(-1)!.x).toBe(240 * (LAYERS - 1))
  })
  it('keeps the area but gives up the thickness', () => {
    const e = flatExtent(240)
    expect(e.width * e.height).toBe(240 * 240)
    expect(e.height).toBeLessThan(240)
  })
})
