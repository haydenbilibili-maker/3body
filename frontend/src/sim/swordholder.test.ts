import { describe, expect, it } from 'vitest'
import { BASE, SCENES, STRIKE_BELOW, deterrence, publicSupport, strikes } from './swordholder'

describe('swordholder', () => {
  it('starts from the base and clamps', () => {
    expect(deterrence([])).toBe(BASE)
    expect(deterrence(SCENES.map(() => 0))).toBe(99)
    expect(deterrence(SCENES.map((s) => s.choices.length - 1))).toBe(1)
  })
  it('the hawk deters, the gentle one invites the strike', () => {
    expect(strikes(deterrence(SCENES.map(() => 0)))).toBe(false)
    expect(strikes(deterrence(SCENES.map((s) => s.choices.length - 1)))).toBe(true)
  })
  it('voters prefer the one who would not press', () => {
    expect(publicSupport(10)).toBeGreaterThan(publicSupport(90))
  })
  it('a hesitant middle path does not reach the threshold', () => {
    expect(deterrence([1, 1, 1, 1])).toBeLessThan(STRIKE_BELOW)
  })
})
