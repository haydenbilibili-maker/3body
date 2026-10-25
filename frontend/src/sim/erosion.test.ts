import { describe, expect, it } from 'vitest'
import { CARVE_SLOTS, VANTAGES, erode, toggleCarve } from './erosion'

describe('erosion', () => {
  const text = '叶文洁在红岸基地向太阳发射了信号，八年后收到回答。'
  it('leaves the present untouched and the far future blank', () => {
    expect(erode(text, 0, 1)).toBe(text)
    expect(erode(text, 1, 1)).toBe('')
  })
  it('is deterministic and keeps punctuation', () => {
    const a = erode(text, 0.5, 7)
    expect(a).toBe(erode(text, 0.5, 7))
    expect(a).toContain('，')
    expect(a.length).toBe(text.length)
  })
  it('erodes more the further you look', () => {
    const count = (s: string) => (s.match(/□/g) || []).length
    expect(count(erode(text, 0.75, 3))).toBeGreaterThan(count(erode(text, 0.3, 3)))
  })
  it('limits the stone to a few carvings', () => {
    let c: number[] = []
    for (let i = 0; i < CARVE_SLOTS + 3; i++) c = toggleCarve(c, i)
    expect(c.length).toBe(CARVE_SLOTS)
    expect(toggleCarve(c, 0)).not.toContain(0)
  })
  it('ends at the scale of the 647 universe', () => {
    expect(VANTAGES.at(-1)!.level).toBe(1)
  })
})
