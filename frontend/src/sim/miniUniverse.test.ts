import { describe, expect, it } from 'vitest'
import { MASS_LIMIT, RELICS, canAdd, formatYears, legacyLines, outsideAt, returnedMass, toggleRelic, totalMass, UNIVERSE_MASS } from './miniUniverse'

describe('miniUniverse relics', () => {
  it('adds up mass with one decimal', () => {
    expect(totalMass(['bottle', 'ecosphere'])).toBe(3)
    expect(totalMass([])).toBe(0)
  })

  it('never lets the selection exceed the limit', () => {
    let sel: string[] = []
    for (const r of RELICS) sel = toggleRelic(sel, r.id)
    expect(totalMass(sel)).toBeLessThanOrEqual(MASS_LIMIT)
  })

  it('cannot leave yourself behind', () => {
    expect(canAdd([], 'self')).toBe(false)
    expect(toggleRelic([], 'self')).toEqual([])
  })

  it('toggling a selected relic removes it', () => {
    expect(toggleRelic(['bottle'], 'bottle')).toEqual([])
  })

  it('the choice is a real trade-off: not every unlocked relic fits', () => {
    const all = RELICS.filter((r) => !r.locked).reduce((a, r) => a + r.mass, 0)
    expect(all).toBeGreaterThan(MASS_LIMIT)
  })

  it('returns everything that is not left behind', () => {
    expect(returnedMass(['bottle'])).toBe(UNIVERSE_MASS - 0.4)
  })

  it('builds legacy lines only for chosen relics', () => {
    expect(legacyLines(['bottle', 'self'])).toHaveLength(1)
  })

  it('describes the dying universe and formats deep time', () => {
    expect(outsideAt(10)).toMatch(/膨胀/)
    expect(outsideAt(1e50)).toMatch(/黑暗/)
    expect(formatYears(1e20)).toBe('10^20 年')
  })
})
