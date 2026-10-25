import { describe, expect, it } from 'vitest'
import { STEPS, outcome, score } from './galaxy'

describe('galaxy humans', () => {
  it('has four decisions', () => {
    expect(STEPS).toHaveLength(4)
  })
  it('striking first and never returning keeps you alive but changes you', () => {
    const o = outcome([0, 0, 0, 1])
    expect(o.alive).toBe(true)
    expect(o.title).toBe('新的人类')
  })
  it('giving everything away means you do not arrive', () => {
    expect(outcome([1, 2, 1, 0]).alive).toBe(false)
  })
  it('scores add up', () => {
    expect(score([0, 0, 0, 1])).toEqual({ survive: 5, bond: -5 })
  })
  it('some humanity can survive the voyage', () => {
    expect(outcome([0, 0, 1, 0]).title).toBe('带着地球走')
  })
})
