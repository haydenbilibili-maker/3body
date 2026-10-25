import { describe, expect, it } from 'vitest'
import { EPOCHS, SIZES, epochLabel, fit, wear, weathered } from './stone'

describe('stone', () => {
  it('bigger characters last longer but hold less', () => {
    for (let i = 1; i < SIZES.length; i++) {
      expect(SIZES[i].capacity).toBeLessThan(SIZES[i - 1].capacity)
      expect(SIZES[i].lifespan).toBeGreaterThan(SIZES[i - 1].lifespan)
    }
  })
  it('cuts what does not fit', () => {
    const r = fit('给岁月以文明，而不是给文明以岁月。', SIZES[4])
    expect(Array.from(r.kept)).toHaveLength(8)
    expect(r.kept + r.lost).toBe('给岁月以文明，而不是给文明以岁月。')
  })
  it('wears away by the end of its lifespan', () => {
    const s = SIZES[2]
    expect(wear(0, s)).toBe(0)
    expect(wear(s.lifespan / 20, s)).toBe(0)
    expect(wear(s.lifespan, s)).toBe(1)
    expect(weathered('人类', s.lifespan * 10, s)).toBe('')
  })
  it('only one-stone-per-character survives a billion years', () => {
    const last = EPOCHS[EPOCHS.length - 1]
    expect(SIZES.filter((s) => wear(last, s) < 1).map((s) => s.id)).toEqual([4])
    expect(epochLabel(last)).toBe('10 亿年后')
  })
})
