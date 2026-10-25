import { describe, expect, it } from 'vitest'
import { ROUNDS, TOLERANCE, YOU, createReturn, ending, missing, nextRound, returnedMass, type YourMove } from './returners'

function play(seed: number, first: YourMove, later: YourMove = 'wait') {
  let s = createReturn(seed)
  for (let i = 0; i < ROUNDS; i++) s = nextRound(s, i === 0 ? first : later)
  return s
}

describe('returners', () => {
  it('starts with all the mass taken', () => {
    const s = createReturn(3)
    expect(returnedMass(s)).toBe(0)
    expect(Math.abs(s.civs.reduce((a, c) => a + c.share, 0) - 1) < 1e-9).toBe(true)
  })
  it('holding out always prevents the restart', () => {
    for (let seed = 1; seed < 20; seed++) expect(ending(play(seed, 'wait'))).toBe('held-out')
  })
  it('returning first helps others trust the broadcast', () => {
    let early = 0
    let late = 0
    for (let seed = 1; seed < 200; seed++) {
      if (ending(play(seed, 'all')) === 'restart') early++
      if (ending(play(seed, 'wait', 'all')) === 'restart') late++
    }
    expect(early).toBeGreaterThan(late)
    expect(early).toBeGreaterThan(0)
  })
  it('a message bottle is small enough to be tolerated', () => {
    const s = play(1, 'bottle')
    const you = s.civs.find((c) => c.id === YOU)!
    expect(you.bottle).toBe(true)
    expect(missing(s) >= 0).toBe(true)
    expect(TOLERANCE).toBeGreaterThan(0.001)
  })
})
