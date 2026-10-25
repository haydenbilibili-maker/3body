import { describe, expect, it } from 'vitest'
import { SITUATIONS, agreedBefore, allowed, compare, landing } from './stamp'

describe('stamp', () => {
  it('every situation has one choice on each side', () => {
    for (const s of SITUATIONS) expect(s.choices.map((c) => c.stance).sort()).toEqual(['lose', 'win'])
  })

  it('under a stamp, reaching for the other side lands on the stamped side', () => {
    const s = SITUATIONS[2]
    const lose = s.choices.find((c) => c.stance === 'lose')!
    expect(allowed('win', lose)).toBe(false)
    expect(landing('win', s, lose).stance).toBe('win')
    expect(landing('lose', s, lose).id).toBe(lose.id)
  })

  it('compare counts the answers the stamp changed', () => {
    const before = Object.fromEntries(SITUATIONS.map((s, i) => [s.id, s.choices[i % 2].id]))
    const after = Object.fromEntries(SITUATIONS.map((s) => [s.id, s.choices.find((c) => c.stance === 'win')!.id]))
    const d = compare(before, after)
    expect(d.filter((x) => x.changed)).toHaveLength(2)
    expect(agreedBefore('win', before)).toBe(3)
  })

  it('an unanswered situation is not counted as changed', () => {
    expect(compare({}, {}).some((x) => x.changed)).toBe(false)
  })
})
