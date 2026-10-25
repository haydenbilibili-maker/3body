import { describe, expect, it } from 'vitest'
import { BRANCH_FROM, HUMAN_TREE, STEPS, branchProfile, outcome, score } from './galaxy'

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

describe('human tree', () => {
  it('has six eras and the branch grows from the crisis era', () => {
    expect(HUMAN_TREE).toHaveLength(6)
    expect(HUMAN_TREE[BRANCH_FROM].era).toBe('危机纪元')
  })

  it('profiles stay between 0 and 1', () => {
    for (const c of [[0, 0, 0, 1], [1, 2, 1, 0], [0, 1, 1, 0]]) {
      const p = branchProfile(c)
      expect(p.survive).toBeGreaterThanOrEqual(0)
      expect(p.survive).toBeLessThanOrEqual(1)
      expect(p.bond).toBeGreaterThanOrEqual(0)
      expect(p.bond).toBeLessThanOrEqual(1)
    }
    expect(branchProfile([0, 0, 0, 1]).culture).toBe('集权 · 生存至上')
  })
})
